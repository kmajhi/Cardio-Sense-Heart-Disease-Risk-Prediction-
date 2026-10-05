"""The admin console's doctor management and review monitoring (staff only).

    GET   /api/admin/doctors/                     ?q &status=active|inactive &verified=1|0 &page
    POST  /api/admin/doctors/                     { name, email, password, phone, specialty, organization,
                                                    registration_number } → a new doctor account
    GET   /api/admin/doctors/<pk>/
    PATCH /api/admin/doctors/<pk>/                { name, phone, specialty, organization, registration_number,
                                                    status, is_verified, is_available }
    POST  /api/admin/doctors/<pk>/reset-password/ { password, require_change } → a new password (forgotten)
    GET   /api/admin/reviews/                     ?status &risk=high &q &page

The administrator types a temporary password; it is hashed at once, never sent
back, and the doctor must replace it on first sign-in. "Verified" means an
administrator checked the registration; changing the registration number
clears it. Every change is in the activity log.
"""

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response

from .accounts import password_problem
from .admin_api import StaffView, admin_log, bad, iso, paginate, user_sessions
from .models import DoctorProfile, ReviewRequest
from .reviews import request_row

User = get_user_model()
TEXT_FIELDS = {"phone": 20, "specialty": 80, "organization": 120, "registration_number": 40}


def doctors_queryset():
    return DoctorProfile.objects.select_related("user").annotate(
        n_active=Count("user__assigned_reviews", filter=Q(user__assigned_reviews__status=ReviewRequest.UNDER_REVIEW)),
        n_completed=Count("user__assigned_reviews", filter=Q(user__assigned_reviews__status=ReviewRequest.COMPLETED)),
    )


def doctor_row(d):
    return {
        "id": d.pk,
        "doctor_id": d.doctor_id,
        "user_id": d.user_id,
        "name": d.name,
        "email": d.user.email,
        "phone": d.phone,
        "specialty": d.specialty,
        "organization": d.organization,
        "registration_number": d.registration_number,
        "status": d.status,
        "account_active": d.user.is_active,
        "verified": d.is_verified,
        "verified_at": iso(d.verified_at),
        "verified_by": d.verified_by,
        "is_available": d.is_available,
        "must_change_password": d.must_change_password,
        "created_at": iso(d.created_at),
        "last_login": iso(d.user.last_login),
        "active_reviews": getattr(d, "n_active", None),
        "completed_reviews": getattr(d, "n_completed", None),
    }


def clean_text(data):
    """→ ({field: value}, error) for the text fields present in `data`."""
    out = {}
    for key, limit in TEXT_FIELDS.items():
        if key in data:
            value = str(data[key] or "").strip()
            if len(value) > limit:
                return None, f"{key.replace('_', ' ').capitalize()} must be at most {limit} characters."
            out[key] = value
    return out, None


class DoctorsView(StaffView):
    def get(self, request):
        qs = doctors_queryset()
        p = request.query_params
        q = p.get("q", "").strip()
        if q:
            cond = Q(user__first_name__icontains=q) | Q(user__email__icontains=q) | Q(specialty__icontains=q)
            raw = q.upper().removeprefix("DR-")
            qs = qs.filter(cond | Q(pk=int(raw)) if raw.isdigit() else cond)
        if p.get("status") in ("active", "inactive"):
            qs = qs.filter(status=p["status"])
        if p.get("verified") in ("1", "0"):
            qs = qs.filter(is_verified=p["verified"] == "1")
        return Response(paginate(request, qs.order_by("pk"), doctor_row))

    def post(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        name = str(data.get("name", "")).strip()
        email = str(data.get("email", "")).strip().lower()
        password = str(data.get("password", ""))
        if not name or len(name) > 80:
            return bad("Enter the doctor's name (1 to 80 characters).")
        try:
            validate_email(email)
        except ValidationError:
            return bad("Enter a valid email address.")
        if User.objects.filter(username=email).exists():
            return bad("An account with this email already exists. Doctor accounts are created new.")
        fields, error = clean_text(data)
        if error:
            return bad(error)
        user = User(username=email, email=email, first_name=name)
        problem = password_problem(password, user)
        if problem:
            return bad(f"Temporary password: {problem}")
        with transaction.atomic():
            user.set_password(password)
            user.save()
            d = DoctorProfile.objects.create(user=user, must_change_password=True, **fields)
        admin_log(request, f"Created doctor account {d.doctor_id} for {email}", target_user=user.pk,
                  doctor_id=d.doctor_id)
        return Response(doctor_row(doctors_queryset().get(pk=d.pk)), status=status.HTTP_201_CREATED)


class DoctorDetailView(StaffView):
    def get(self, request, pk):
        d = doctors_queryset().filter(pk=pk).first()
        if d is None:
            return bad("No such doctor.", 404)
        recent = ReviewRequest.objects.filter(doctor=d.user).select_related("assessment", "assessment__user",
                                                                            "doctor__doctor")[:10]
        return Response({**doctor_row(d), "recent_reviews": [request_row(r) for r in recent]})

    def patch(self, request, pk):
        d = DoctorProfile.objects.select_related("user").filter(pk=pk).first()
        if d is None:
            return bad("No such doctor.", 404)
        data = request.data if isinstance(request.data, dict) else {}
        fields, error = clean_text(data)
        if error:
            return bad(error)
        changes = []
        if "name" in data:
            name = str(data["name"]).strip()
            if not name or len(name) > 80:
                return bad("Enter a name of 1 to 80 characters.")
            if name != d.user.first_name:
                d.user.first_name = name
                d.user.save(update_fields=["first_name"])
                changes.append("renamed")
        for key, value in fields.items():
            if getattr(d, key) != value:
                setattr(d, key, value)
                changes.append(f"{key.replace('_', ' ')} updated")
                if key == "registration_number" and d.is_verified:
                    # A verification covers the registration that was checked, not a new one.
                    d.is_verified, d.verified_at, d.verified_by = False, None, ""
                    changes.append("verification cleared")
        if data.get("status") in ("active", "inactive") and data["status"] != d.status:
            d.status = data["status"]
            changes.append("activated" if d.status == "active" else "deactivated")
            if d.status == "inactive":
                for s in user_sessions(d.user_id):
                    s.delete()
        if "is_verified" in data and bool(data["is_verified"]) != d.is_verified:
            d.is_verified = bool(data["is_verified"])
            d.verified_at = timezone.now() if d.is_verified else None
            d.verified_by = (request.user.email or request.user.username) if d.is_verified else ""
            changes.append("verified" if d.is_verified else "verification removed")
        if "is_available" in data and bool(data["is_available"]) != d.is_available:
            d.is_available = bool(data["is_available"])
            changes.append("set available" if d.is_available else "set unavailable")
        if changes:
            d.save()
            admin_log(request, f"Doctor {d.doctor_id}: {', '.join(changes)}", target_user=d.user_id,
                      doctor_id=d.doctor_id, changes=changes)
        return Response(doctor_row(doctors_queryset().get(pk=d.pk)))


class DoctorResetPasswordView(StaffView):
    """POST { password, require_change=true } → a new password for a doctor who forgot theirs.

    The password is hashed at once and never returned. Every session of the doctor
    ends. With require_change (the default) it is temporary: the doctor must choose
    their own at next sign-in."""

    def post(self, request, pk):
        d = DoctorProfile.objects.select_related("user").filter(pk=pk).first()
        if d is None:
            return bad("No such doctor.", 404)
        data = request.data if isinstance(request.data, dict) else {}
        password = str(data.get("password", ""))
        require_change = data.get("require_change", True) is not False
        problem = password_problem(password, d.user)
        if problem:
            return bad(f"New password: {problem}")
        if d.user.check_password(password):
            return bad("New password: choose a password different from the current one.")
        d.user.set_password(password)
        d.user.save(update_fields=["password"])
        d.must_change_password = require_change
        d.save(update_fields=["must_change_password", "updated_at"])
        ended = user_sessions(d.user_id)
        for s in ended:
            s.delete()
        admin_log(request, f"Set a new password for doctor {d.doctor_id}"
                           f"{' (must change at next sign-in)' if require_change else ''}",
                  target_user=d.user_id, doctor_id=d.doctor_id, require_change=require_change)
        then = ("They must choose their own at next sign-in." if require_change
                else "They can sign in with it now.")
        return Response({"detail": f"New password set for {d.name} ({d.doctor_id}). {then}",
                         "require_change": require_change, "sessions_ended": len(ended)})


class ReviewsMonitorView(StaffView):
    def get(self, request):
        qs = ReviewRequest.objects.select_related("assessment", "assessment__user", "doctor__doctor")
        p = request.query_params
        if p.get("status") in dict(ReviewRequest.STATUSES):
            qs = qs.filter(status=p["status"])
        elif p.get("status") == "needs_more_information":
            qs = qs.filter(reviews__decision="needs_more_information", reviews__status="submitted")
        if p.get("risk") == "high":
            qs = qs.filter(assessment__risk_level="high")
        q = p.get("q", "").strip()
        if q:
            raw = q.upper().removeprefix("A-").removeprefix("R-")
            cond = Q(assessment__user__email__icontains=q) | Q(assessment__user__first_name__icontains=q) | Q(
                doctor__first_name__icontains=q)
            qs = qs.filter(cond | Q(assessment_id=int(raw)) | Q(pk=int(raw)) if raw.isdigit() else cond)
        counts = {s: ReviewRequest.objects.filter(status=s).count() for s, _ in ReviewRequest.STATUSES}
        return Response({**paginate(request, qs.order_by("-requested_at"), request_row), "counts": counts})
