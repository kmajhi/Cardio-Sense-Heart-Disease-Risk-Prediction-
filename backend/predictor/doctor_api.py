"""The Doctor Panel's API (frontend /doctor). Doctors only.

    POST  /api/doctor/login/                     { identifier: DR-0001 or email, password }
    GET   /api/doctor/me/                        profile, verification, workload counts
    PATCH /api/doctor/me/                        { is_available, photo } (photo: JPEG data URL, or "" to remove)
    POST  /api/doctor/password/                  { current_password, new_password }
    GET   /api/doctor/overview/                  counts + priority queue, active and recent completed
    GET   /api/doctor/requests/                  ?q &risk &age_min &age_max &date_from &date_to &sort &page
    GET   /api/doctor/requests/<R-id>/           a pending request's summary (no full record before accepting)
    POST  /api/doctor/requests/<R-id>/claim/     accept: one conditional UPDATE, so only one doctor wins
    GET   /api/doctor/reviews/                   ?scope=active|completed &q &page (my own)
    GET   /api/doctor/reviews/<R-id>/            the clinical workspace (assigned doctor only)
    PUT   /api/doctor/reviews/<R-id>/draft/      { decision, remarks, medications, action_plan, notes }
    POST  /api/doctor/reviews/<R-id>/submit/     the same, final: completes the request, new report version
    GET   /api/doctor/reviews/<R-id>/report/     the latest PDF of a review's assessment

Who may do what is decided here, never in the browser:
- a doctor is an account with a DoctorProfile, which only the admin console creates;
- an inactive doctor can sign in to read their profile, nothing more;
- until the temporary password is changed, only /me and /password answer;
- patient data needs an administrator-verified doctor; accepting new requests
  also needs "available"; a doctor never reviews their own assessment;
- the full record is shown only to the doctor the request is assigned to.
"""

from datetime import date

from django.contrib.auth import authenticate, login, update_session_auth_hash
from django.db import transaction
from django.db.models import Case, IntegerField, Q, Value, When
from django.http import HttpResponse
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from rest_framework import status
from rest_framework.permissions import AllowAny, BasePermission
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from . import reports
from .accounts import password_problem, public_user
from .serializers import MAX_PHOTO_CHARS, PHOTO_PREFIX
from .activity import record
from .models import ClinicalReview, DoctorProfile, ReportVersion, ReviewRequest
from .reviews import (DECISION_LABEL, bad, doctor_of, dr, ensure_first_report, iso, log_event, notify, patient_name,
                      pk_from, report_versions, request_row, review_for_report, timeline)

PAGE_SIZE = 15
TEXT_LIMITS = {"remarks": 5000, "action_plan": 5000, "notes": 3000}
# One prescribed medicine: each field and its length cap. Only the name is required.
MEDICATION_LIMITS = {"name": 120, "strength": 60, "frequency": 60, "timing": 60, "duration": 60, "instructions": 200}
MAX_MEDICATIONS = 12
RISK_RANK = Case(When(assessment__risk_level="high", then=Value(0)),
                 When(assessment__risk_level="moderate", then=Value(1)), default=Value(2), output_field=IntegerField())
LOGIN_REFUSED = "Incorrect Doctor ID, email or password."


class IsDoctor(BasePermission):
    """A signed-in account with an active doctor profile."""

    message = "This area is for Cardio Sense doctors."

    def has_permission(self, request, view):
        d = doctor_of(request.user)
        if d is None:
            return False
        if not d.is_active:
            self.message = "This doctor account is inactive. Contact an administrator."
            return getattr(view, "allow_inactive", False)
        if d.must_change_password and not getattr(view, "allow_before_password_change", False):
            self.message = "Choose a new password before using the Doctor Panel."
            return False
        return True


class DoctorView(APIView):
    permission_classes = [IsDoctor]

    @property
    def doctor(self):
        return self.request.user.doctor

    def require_reviewer(self):
        """None, or the response that says why this doctor can't see patient data."""
        if not self.doctor.is_verified:
            return bad("Your account is waiting for verification by an administrator.", status.HTTP_403_FORBIDDEN,
                       code="not_verified")
        return None


def page_of(request, queryset, serialize):
    try:
        page = max(1, int(request.query_params.get("page", 1)))
    except ValueError:
        page = 1
    count = queryset.count()
    pages = max(1, -(-count // PAGE_SIZE))
    page = min(page, pages)
    rows = queryset[(page - 1) * PAGE_SIZE: page * PAGE_SIZE]
    return {"results": [serialize(r) for r in rows], "count": count, "page": page, "pages": pages}


def base_requests():
    return ReviewRequest.objects.select_related("assessment", "assessment__user", "doctor__doctor")


def open_queue(doctor):
    """Requests this doctor could accept: pending, not their own assessment."""
    return base_requests().filter(status=ReviewRequest.PENDING).exclude(patient=doctor.user)


def needs_attention(qs):
    """Higher model-estimated risk, or values the app flagged for prompt attention."""
    return qs.filter(Q(assessment__risk_level="high") | Q(assessment__guidance__urgent=True))


def doctor_me(d):
    mine = ReviewRequest.objects.filter(doctor=d.user)
    return {
        **public_user(d.user),
        "doctor_id": d.doctor_id,
        "phone": d.phone,
        "specialty": d.specialty,
        "organization": d.organization,
        "registration_number": d.registration_number,
        "photo": d.photo,
        "status": d.status,
        "is_active": d.is_active,
        "verified": d.is_verified,
        "verified_at": iso(d.verified_at),
        "is_available": d.is_available,
        "must_change_password": d.must_change_password,
        "created_at": iso(d.created_at),
        "last_login": iso(d.user.last_login),
        "active_reviews": mine.filter(status=ReviewRequest.UNDER_REVIEW).count(),
        "completed_reviews": mine.filter(status=ReviewRequest.COMPLETED).count(),
    }


# ---------------------------------------------------------------- account

@method_decorator(csrf_protect, name="dispatch")
class DoctorLoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        ident = str(data.get("identifier", "")).strip()
        password = str(data.get("password", ""))
        email = ident.lower()
        pk = pk_from(ident, "DR-") if ident.upper().startswith("DR-") else None
        if pk:
            d = DoctorProfile.objects.filter(pk=pk).select_related("user").first()
            email = d.user.username if d else ""
        user = authenticate(request, username=email, password=password) if email else None
        # Same answer for a wrong password and for an account that isn't a doctor.
        if user is None or doctor_of(user) is None:
            return bad(LOGIN_REFUSED)
        login(request, user)
        return Response(doctor_me(user.doctor))


class DoctorMeView(DoctorView):
    allow_inactive = True
    allow_before_password_change = True

    def get(self, request):
        return Response(doctor_me(self.doctor))

    def patch(self, request):
        d = self.doctor
        if not d.is_active:
            return bad("This doctor account is inactive. Contact an administrator.", status.HTTP_403_FORBIDDEN)
        data = request.data if isinstance(request.data, dict) else {}
        if "photo" in data:
            photo = data["photo"] if isinstance(data["photo"], str) else None
            if photo is None or (photo and (not photo.startswith(PHOTO_PREFIX) or len(photo) > MAX_PHOTO_CHARS)):
                return bad("The photo must be a small JPEG image. Choose it again from the Profile page.")
            had = bool(d.photo)
            d.photo = photo
            d.save(update_fields=["photo", "updated_at"])
            what = "removed their photo" if not photo else "changed their photo" if had else "added a photo"
            record("doctor", f"{d.doctor_id} {what}", user=request.user, request=request)
        if "is_available" in data:
            d.is_available = bool(data["is_available"])
            d.save(update_fields=["is_available", "updated_at"])
            record("doctor", f"{d.doctor_id} set themselves {'available' if d.is_available else 'unavailable'}",
                   user=request.user, request=request)
        return Response(doctor_me(d))


@method_decorator(csrf_protect, name="dispatch")
class DoctorPasswordView(DoctorView):
    allow_inactive = True
    allow_before_password_change = True
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        user = request.user
        current = str(data.get("current_password", ""))
        new = str(data.get("new_password", ""))
        if not user.check_password(current):
            return bad("Your current password is incorrect.")
        if new == current:
            return bad("Choose a password different from your current one.")
        problem = password_problem(new, user)
        if problem:
            return bad(problem)
        user.set_password(new)
        user.save(update_fields=["password"])
        update_session_auth_hash(request, user)  # this session stays valid, others end
        DoctorProfile.objects.filter(pk=self.doctor.pk).update(must_change_password=False, updated_at=timezone.now())
        record("password_changed", f"{user.email} (doctor {self.doctor.doctor_id}) changed their password",
               user=user, request=request)
        return Response(doctor_me(DoctorProfile.objects.select_related("user").get(pk=self.doctor.pk)))


# ---------------------------------------------------------------- queue

class OverviewView(DoctorView):
    def get(self, request):
        refused = self.require_reviewer()
        if refused:
            return refused
        d = self.doctor
        queue = open_queue(d)
        mine = base_requests().filter(doctor=d.user)
        active = mine.filter(status=ReviewRequest.UNDER_REVIEW)
        completed = mine.filter(status=ReviewRequest.COMPLETED)
        week_ago = timezone.now() - timezone.timedelta(days=7)
        return Response({
            "counts": {
                "awaiting": queue.count(),
                "active": active.count(),
                "attention": needs_attention(queue).count() + needs_attention(active).count(),
                "completed": completed.count(),
                "completed_week": completed.filter(completed_at__gte=week_ago).count(),
            },
            "priority": [request_row(r) for r in queue.annotate(rank=RISK_RANK).order_by("rank", "requested_at")[:5]],
            "active": [request_row(r) for r in active.order_by("claimed_at")[:5]],
            "completed": [request_row(r) for r in completed.order_by("-completed_at")[:5]],
        })


def parse_day(value):
    try:
        return date.fromisoformat(value) if value else None
    except ValueError:
        return None


def filtered(request, qs):
    p = request.query_params
    q = p.get("q", "").strip()
    if q:
        ref = pk_from(q, "A-") if q.upper().startswith("A-") or q.isdigit() else None
        cond = Q(assessment__user__first_name__icontains=q) | Q(assessment__profile__full_name__icontains=q)
        qs = qs.filter(cond | Q(assessment_id=ref) if ref else cond)
    if p.get("risk") in ("low", "moderate", "high"):
        qs = qs.filter(assessment__risk_level=p["risk"])
    if p.get("attention") == "1":
        qs = needs_attention(qs)
    for key, lookup in (("age_min", "assessment__age__gte"), ("age_max", "assessment__age__lte")):
        try:
            qs = qs.filter(**{lookup: int(p[key])}) if p.get(key) else qs
        except ValueError:
            pass
    start, end = parse_day(p.get("date_from")), parse_day(p.get("date_to"))
    if start:
        qs = qs.filter(requested_at__date__gte=start)
    if end:
        qs = qs.filter(requested_at__date__lte=end)
    return qs


class RequestsView(DoctorView):
    def get(self, request):
        refused = self.require_reviewer()
        if refused:
            return refused
        qs = filtered(request, open_queue(self.doctor))
        sort = request.query_params.get("sort", "priority")
        qs = (qs.order_by("-requested_at") if sort == "newest" else qs.order_by("requested_at") if sort == "oldest"
              else qs.annotate(rank=RISK_RANK).order_by("rank", "requested_at"))
        return Response(page_of(request, qs, request_row))


class RequestDetailView(DoctorView):
    """Enough to decide whether to accept; the full record opens after accepting."""

    def get(self, request, ref):
        refused = self.require_reviewer()
        if refused:
            return refused
        req = base_requests().filter(pk=pk_from(ref, "R-")).first()
        if req is None or req.status == ReviewRequest.CANCELLED or req.patient_id == request.user.pk:
            return bad("No such request.", status.HTTP_404_NOT_FOUND)
        if req.status != ReviewRequest.PENDING and req.doctor_id != request.user.pk:
            return bad("This assessment has already been assigned to another doctor.", status.HTTP_409_CONFLICT,
                       code="taken")
        return Response({**request_row(req), "question": req.question})


@method_decorator(csrf_protect, name="dispatch")
class ClaimView(DoctorView):
    def post(self, request, ref):
        refused = self.require_reviewer()
        if refused:
            return refused
        d = self.doctor
        if not d.is_available:
            return bad("You're marked unavailable. Set yourself available to accept new reviews.",
                       status.HTTP_403_FORBIDDEN, code="unavailable")
        pk = pk_from(ref, "R-")
        req = ReviewRequest.objects.filter(pk=pk).first() if pk else None
        if req is None or req.status == ReviewRequest.CANCELLED or req.patient_id == request.user.pk:
            return bad("No such request.", status.HTTP_404_NOT_FOUND)
        now = timezone.now()
        # The whole race is decided by this one statement: whoever's UPDATE matches
        # the still-pending row gets it; everyone else changes nothing.
        won = ReviewRequest.objects.filter(pk=pk, status=ReviewRequest.PENDING, doctor__isnull=True).update(
            status=ReviewRequest.UNDER_REVIEW, doctor=request.user, claimed_at=now, updated_at=now)
        if not won:
            return bad("This assessment has already been assigned to another doctor.", status.HTTP_409_CONFLICT,
                       code="taken")
        req.refresh_from_db()
        log_event(req, "claimed", request.user)
        notify(req.patient, "review_claimed", "A doctor is reviewing your assessment",
               f"{dr(d.name)} has started reviewing assessment {req.assessment.reference}.", "/ask-a-doctor", req)
        record("doctor", f"{d.doctor_id} accepted review {req.reference} ({req.assessment.reference})",
               user=request.user, request=request, request_id=req.reference)
        return Response(request_row(base_requests().get(pk=pk)))


# ---------------------------------------------------------------- my reviews and the workspace

class MyReviewsView(DoctorView):
    def get(self, request):
        refused = self.require_reviewer()
        if refused:
            return refused
        scope = request.query_params.get("scope", "active")
        mine = filtered(request, base_requests().filter(doctor=request.user))
        if scope == "completed":
            qs = mine.filter(status=ReviewRequest.COMPLETED).order_by("-completed_at")
        else:
            qs = mine.filter(status=ReviewRequest.UNDER_REVIEW).order_by("claimed_at")
        return Response(page_of(request, qs, request_row))


def assigned(request, ref):
    """The request if it is assigned to this doctor, else None (another's looks missing)."""
    pk = pk_from(ref, "R-")
    return base_requests().filter(pk=pk, doctor=request.user).exclude(status=ReviewRequest.CANCELLED).first() \
        if pk else None


def model_info(a):
    meta = reports.model_metadata()
    method = (meta.get("calibration") or {}).get("method", "")
    same = meta.get("trained_at") == a.model_trained_at
    return {"name": a.model_name, "trained_at": a.model_trained_at,
            "calibration": method.split(",")[0] if method and same else ""}


def review_payload(rv, *, include_notes=True):
    if rv is None:
        return None
    body = {"id": f"CR-{rv.pk:04d}", "status": rv.status, "decision": rv.decision,
            "decision_label": DECISION_LABEL.get(rv.decision, ""), "remarks": rv.remarks,
            "medications": rv.medications or [], "action_plan": rv.action_plan, "updated_at": iso(rv.updated_at),
            "submitted_at": iso(rv.submitted_at)}
    if include_notes:
        body["notes"] = rv.notes
    return body


def workspace(req):
    a = req.assessment
    latest = req.reviews.order_by("-created_at").first()
    return {
        **request_row(req, review=latest if latest and latest.status == ClinicalReview.SUBMITTED else None),
        "question": req.question,
        "topic_label": req.get_topic_display(),
        "assessment_detail": {
            "id": a.reference,
            "created_at": iso(a.created_at),
            "inputs": a.inputs,
            "result": {"probability": a.probability, "risk_level": a.risk_level, "top_factors": a.top_factors,
                       "missing_fields": a.missing_fields, "outside_training": a.outside_training,
                       "low_confidence": a.low_confidence},
            "model": model_info(a),
            "guidance": a.guidance or {},
        },
        "patient": {"name": patient_name(a), "age": a.age, "sex": a.sex},
        "review": review_payload(latest),
        "timeline": timeline(req),
        "reports": report_versions(a),
    }


class ReviewDetailView(DoctorView):
    def get(self, request, ref):
        refused = self.require_reviewer()
        if refused:
            return refused
        req = assigned(request, ref)
        if req is None:
            return bad("No such review, or it isn't assigned to you.", status.HTTP_404_NOT_FOUND)
        if req.status == ReviewRequest.UNDER_REVIEW and not req.events.filter(kind="opened").exists():
            log_event(req, "opened", request.user)
        return Response(workspace(req))


def clean_form(data):
    """→ (fields, error). Lengths are capped; nothing is invented or prefilled."""
    if not isinstance(data, dict):
        return None, "Send the review as a JSON object."
    fields = {}
    for key, limit in TEXT_LIMITS.items():
        value = data.get(key, "")
        if not isinstance(value, str):
            return None, f"{key.replace('_', ' ').capitalize()} must be text."
        value = value.strip()
        if len(value) > limit:
            return None, f"{key.replace('_', ' ').capitalize()} is too long (at most {limit:,} characters)."
        fields[key] = value
    decision = str(data.get("decision", "") or "")
    if decision and decision not in DECISION_LABEL:
        return None, "Choose one of the listed review decisions."
    fields["decision"] = decision
    medications, error = clean_medications(data.get("medications", []))
    if error:
        return None, error
    fields["medications"] = medications
    return fields, None


def clean_medications(items):
    """→ (medicines, error). Blank rows are dropped; a row with anything in it needs a name."""
    if items is None:
        return [], None
    if not isinstance(items, list):
        return None, "Send the medicines as a list."
    medicines = []
    for n, item in enumerate(items, 1):
        if not isinstance(item, dict):
            return None, f"Medicine {n} must be an object."
        med = {}
        for key, limit in MEDICATION_LIMITS.items():
            value = item.get(key, "")
            if not isinstance(value, str):
                return None, f"Medicine {n}: {key} must be text."
            value = " ".join(value.split())
            if len(value) > limit:
                return None, f"Medicine {n}: {key} is too long (at most {limit} characters)."
            med[key] = value
        if not any(med.values()):
            continue
        if not med["name"]:
            return None, f"Enter the name of medicine {n}, or remove that row."
        medicines.append(med)
    if len(medicines) > MAX_MEDICATIONS:
        return None, f"A prescription can list at most {MAX_MEDICATIONS} medicines."
    return medicines, None


def completeness(fields):
    """The first missing item for a final submission, or ''."""
    if not fields["decision"]:
        return "Select a review decision."
    if not fields["remarks"]:
        return "Write the diagnosis and advice in the prescription."
    if fields["decision"] in ClinicalReview.NEEDS_ACTION_PLAN and not fields["action_plan"]:
        return f"Add a clinical action plan for “{DECISION_LABEL[fields['decision']]}”."
    return ""


@method_decorator(csrf_protect, name="dispatch")
class DraftView(DoctorView):
    def put(self, request, ref):
        refused = self.require_reviewer()
        if refused:
            return refused
        req = assigned(request, ref)
        if req is None:
            return bad("No such review, or it isn't assigned to you.", status.HTTP_404_NOT_FOUND)
        if req.status != ReviewRequest.UNDER_REVIEW:
            return bad("This review has been submitted and can no longer be edited.", status.HTTP_409_CONFLICT)
        fields, error = clean_form(request.data)
        if error:
            return bad(error)
        with transaction.atomic():
            draft = req.reviews.select_for_update().filter(status=ClinicalReview.DRAFT, doctor=request.user).first()
            if draft is None:
                draft = ClinicalReview(request=req, assessment=req.assessment, doctor=request.user)
            for key, value in fields.items():
                setattr(draft, key, value)
            draft.save()
        log_event(req, "draft_saved", request.user)
        return Response(review_payload(draft))


@method_decorator(csrf_protect, name="dispatch")
class SubmitView(DoctorView):
    def post(self, request, ref):
        refused = self.require_reviewer()
        if refused:
            return refused
        req = assigned(request, ref)
        if req is None:
            return bad("No such review, or it isn't assigned to you.", status.HTTP_404_NOT_FOUND)
        fields, error = clean_form(request.data)
        if error:
            return bad(error)
        missing = completeness(fields)
        if missing:
            return bad(missing, code="incomplete")
        now = timezone.now()
        with transaction.atomic():
            # Conditional, so a double click or a second tab can't submit twice.
            won = ReviewRequest.objects.filter(pk=req.pk, doctor=request.user,
                                               status=ReviewRequest.UNDER_REVIEW).update(
                status=ReviewRequest.COMPLETED, completed_at=now, updated_at=now)
            if not won:
                return bad("This review has already been submitted.", status.HTTP_409_CONFLICT, code="submitted")
            review = req.reviews.filter(status=ClinicalReview.DRAFT, doctor=request.user).first() or ClinicalReview(
                request=req, assessment=req.assessment, doctor=request.user)
            for key, value in fields.items():
                setattr(review, key, value)
            review.status = ClinicalReview.SUBMITTED
            review.submitted_at = now
            review.save()
            ensure_first_report(req.assessment)
            last = ReportVersion.objects.filter(assessment=req.assessment).order_by("-version").first()
            version = ReportVersion.objects.create(assessment=req.assessment, version=(last.version if last else 0) + 1,
                                                   review=review, doctor=request.user)
        req.refresh_from_db()
        log_event(req, "submitted", request.user, decision=review.decision)
        log_event(req, "report_updated", None, version=version.version)
        notify(req.patient, "review_completed", "Clinical Review Completed",
               "Your health assessment has been reviewed by a doctor. Your updated clinical summary is now available.",
               "/ask-a-doctor", req)
        log_event(req, "patient_notified", None, channel="in_app")
        record("doctor", f"{self.doctor.doctor_id} submitted review {req.reference} ({req.assessment.reference})",
               user=request.user, request=request, request_id=req.reference, decision=review.decision)
        return Response(workspace(base_requests().get(pk=req.pk)))


class ReviewReportView(DoctorView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "report"

    def get(self, request, ref):
        refused = self.require_reviewer()
        if refused:
            return refused
        req = assigned(request, ref)
        if req is None:
            return bad("No such review, or it isn't assigned to you.", status.HTTP_404_NOT_FOUND)
        a = req.assessment
        if not a.guidance:
            return bad("This assessment's analysis hasn't been recorded.", status.HTTP_409_CONFLICT)
        review = req.submitted_review
        data = reports.render(a, review=review_for_report(review) if review else None,
                              version=reports.latest_version(a))
        response = HttpResponse(data, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="cardio-sense-report-{a.reference}.pdf"'
        response["Cache-Control"] = "no-store"
        return response
