"""Doctor reviews, patient side, and what the doctor and admin APIs share.

    GET    /api/reviews/                    the signed-in patient's requests, newest first
    POST   /api/reviews/                    { assessment, topic, question } → 201 (one open request per assessment)
    DELETE /api/reviews/<id>/               withdraw, only while no doctor has accepted it
    GET    /api/notifications/              { results, unread } (patients and doctors alike)
    POST   /api/notifications/read/         { ids } or {} for all → 204

A request needs the assessment's frozen guidance (Assessment.guidance): the
doctor reviews exactly what the patient was shown, never a recomputation. The
browser records it first (PUT /api/history/<ref>/guidance/), as it does for
the PDF. Patients see the doctor's decision, remarks and action plan once the
review is submitted; a draft and the doctor's internal notes never reach them.
"""

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (Assessment, ClinicalReview, DoctorProfile, Notification, Profile, ReportVersion,
                     ReviewEvent, ReviewRequest)

MAX_QUESTION = 1000
TOPICS = {k for k, _ in ReviewRequest.TOPICS}
DECISION_LABEL = dict(ClinicalReview.DECISIONS)
RISK_ORDER = {"high": 0, "moderate": 1, "low": 2}


def iso(value):
    return value.isoformat() if value else None


def bad(detail, http=status.HTTP_400_BAD_REQUEST, **extra):
    """{ detail } plus any extra keys, e.g. code="taken" for the frontend to branch on."""
    return Response({"detail": detail, **extra}, status=http)


def pk_from(ref, prefix):
    """"R-0012" or "12" → 12, else None."""
    raw = str(ref).upper().removeprefix(prefix)
    return int(raw) if raw.isascii() and raw.isdigit() else None


# ---------------------------------------------------------------- people

def dr(name):
    """"Dr. Sarah Rahman", without doubling a title already typed into the name."""
    return name if name.lower().startswith(("dr ", "dr.")) else f"Dr. {name}"


def doctor_of(user):
    """The account's DoctorProfile, or None."""
    if user is None or not getattr(user, "is_authenticated", False):
        return None
    try:
        return user.doctor
    except DoctorProfile.DoesNotExist:
        return None


def doctor_card(user, photo=False):
    """Who reviewed: always read from the doctor's account, never from free text.
    `photo` adds the doctor's photo (left out of lists: it is ~30 KB)."""
    d = doctor_of(user) if user is not None else None
    if d is None:
        return None
    return {
        **({"photo": d.photo} if photo else {}),
        "name": d.name,
        "doctor_id": d.doctor_id,
        "specialty": d.specialty,
        "organization": d.organization,
        "registration_number": d.registration_number,
        "verified": d.is_verified,
    }


def patient_name(a):
    profile = Profile.objects.filter(user_id=a.user_id, deleted_at__isnull=True).only("full_name").first()
    return (profile.full_name if profile else "") or (a.user.first_name if a.user_id else "") or "Patient"


# ---------------------------------------------------------------- events, notifications, report versions

def log_event(req, kind, actor=None, **detail):
    name = ""
    if actor is not None:
        d = doctor_of(actor)
        name = dr(d.name) if d else (actor.first_name or actor.email)
    return ReviewEvent.objects.create(request=req, kind=kind, actor=actor, actor_name=name[:120], detail=detail)


def notify(user, kind, title, body="", link="", req=None):
    return Notification.objects.create(user=user, kind=kind, title=title[:120], body=body[:400], link=link[:200],
                                       request=req)


def ensure_first_report(a):
    """Version 1 (the automated report) exists once the assessment's guidance is recorded."""
    if a.guidance and not ReportVersion.objects.filter(assessment=a, version=1).exists():
        try:
            with transaction.atomic():
                ReportVersion.objects.create(assessment=a, version=1)
        except IntegrityError:
            pass  # another request recorded it first


def report_versions(a):
    return [{"version": v.version, "label": v.label, "generated_at": iso(v.generated_at), "reviewed": bool(v.review_id)}
            for v in ReportVersion.objects.filter(assessment=a)]


def review_for_report(review):
    """A submitted ClinicalReview → the keys reports.render(review=...) prints."""
    d = doctor_of(review.doctor)
    return {
        "status": "Doctor Review Completed",
        "reviewed_by": dr(d.name) if d else review.doctor.email,
        "doctor_id": d.doctor_id if d else "",
        "specialty": d.specialty if d else "",
        "organization": d.organization if d else "",
        "registration_number": d.registration_number if d else "",
        "verified": bool(d and d.is_verified),
        "decision": DECISION_LABEL.get(review.decision, review.decision),
        "remarks": review.remarks,
        "action_plan": review.action_plan or "No further action recorded.",
        "submitted_at": review.submitted_at,
        "review_id": f"CR-{review.pk:04d}",
    }


# ---------------------------------------------------------------- shapes

def key_findings(a, limit=3):
    """The flagged measurements, most serious first, from the frozen guidance only."""
    rank = {"urgent": 0, "high": 1, "elevated": 2}
    flagged = [f for f in (a.guidance or {}).get("findings", []) if f.get("status") == "flagged"]
    flagged.sort(key=lambda f: (f.get("kind") == "history", rank.get(f.get("level"), 3)))
    return [{"label": f.get("label", ""), "level": f.get("level"), "dir": f.get("dir")} for f in flagged[:limit]]


def status_label(req, review=None):
    if req.status == ReviewRequest.COMPLETED and review is not None and review.decision == "needs_more_information":
        return "More Information Required"
    return req.get_status_display()


def request_row(req, *, review=None):
    """One request as lists show it (queue, my reviews, the admin's monitor)."""
    a = req.assessment
    review = review if review is not None else (req.submitted_review if req.status == ReviewRequest.COMPLETED else None)
    return {
        "id": req.reference,
        "assessment": a.reference,
        "assessment_date": iso(a.created_at),
        "patient": {"name": patient_name(a), "age": a.age, "sex": a.sex},
        "risk": {"probability": a.probability, "level": a.risk_level},
        "urgent": bool((a.guidance or {}).get("urgent")),
        "findings": key_findings(a),
        "topic": req.topic,
        "status": req.status,
        "status_label": status_label(req, review),
        "doctor": doctor_card(req.doctor),
        "requested_at": iso(req.requested_at),
        "claimed_at": iso(req.claimed_at),
        "completed_at": iso(req.completed_at),
        "decision": review.decision if review else "",
        "decision_label": DECISION_LABEL.get(review.decision, "") if review else "",
    }


def timeline(req):
    return [{"kind": e.kind, "label": e.get_kind_display(), "at": iso(e.created_at), "by": e.actor_name}
            for e in req.events.all()]


def patient_view(req):
    """What the patient sees: status, who is reviewing, and the review once submitted."""
    review = req.submitted_review if req.status == ReviewRequest.COMPLETED else None
    row = request_row(req, review=review)
    row.update({
        "doctor": doctor_card(req.doctor, photo=True),
        "question": req.question,
        "timeline": [t for t in timeline(req) if t["kind"] != "draft_saved"],
        "review": None if review is None else {
            "decision": review.decision,
            "decision_label": DECISION_LABEL.get(review.decision, ""),
            "remarks": review.remarks,
            "action_plan": review.action_plan,
            "submitted_at": iso(review.submitted_at),
            "doctor": doctor_card(review.doctor, photo=True),
        },
        "reports": report_versions(req.assessment),
    })
    return row


# ---------------------------------------------------------------- patient API

class ReviewsView(APIView):
    def get(self, request):
        reqs = (ReviewRequest.objects.filter(patient=request.user).exclude(status=ReviewRequest.CANCELLED)
                .select_related("assessment", "assessment__user", "doctor__doctor").prefetch_related("events"))
        return Response([patient_view(r) for r in reqs[:50]])

    def post(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        pk = pk_from(data.get("assessment", ""), "A-")
        a = Assessment.objects.filter(pk=pk, user=request.user).first() if pk else None
        if a is None:
            return bad("No such assessment.", status.HTTP_404_NOT_FOUND)
        if not a.guidance:
            return bad("This assessment's analysis hasn't been recorded yet. Open it in the app and try again.",
                       status.HTTP_409_CONFLICT)
        topic = str(data.get("topic", "result"))
        if topic not in TOPICS:
            topic = "other"
        question = str(data.get("question", "")).strip()[:MAX_QUESTION]
        try:
            with transaction.atomic():
                req = ReviewRequest.objects.create(assessment=a, patient=request.user, topic=topic, question=question)
        except IntegrityError:
            return bad("This assessment already has a doctor review in progress.", status.HTTP_409_CONFLICT)
        ensure_first_report(a)
        log_event(req, "requested", request.user)
        # Doctors who can take it now hear about it; the bell never names the patient.
        doctors = DoctorProfile.objects.filter(status="active", is_verified=True, is_available=True,
                                               must_change_password=False, user__is_active=True).exclude(
            user=request.user).select_related("user")
        for d in doctors:
            notify(d.user, "review_requested", "New assessment available for review",
                   f"Assessment {a.reference} · {a.get_risk_level_display()} model-estimated risk.",
                   "/doctor/requests", req)
        req = ReviewRequest.objects.select_related("assessment", "doctor").get(pk=req.pk)
        return Response(patient_view(req), status=status.HTTP_201_CREATED)


class ReviewDetailView(APIView):
    def delete(self, request, ref):
        pk = pk_from(ref, "R-")
        # Conditional: once a doctor has accepted it, it can no longer be withdrawn.
        changed = ReviewRequest.objects.filter(pk=pk, patient=request.user, status=ReviewRequest.PENDING).update(
            status=ReviewRequest.CANCELLED, updated_at=timezone.now()) if pk else 0
        if not changed:
            exists = pk and ReviewRequest.objects.filter(pk=pk, patient=request.user).exists()
            return (bad("A doctor has already started this review, so it can't be withdrawn.", status.HTTP_409_CONFLICT)
                    if exists else bad("No such request.", status.HTTP_404_NOT_FOUND))
        log_event(ReviewRequest.objects.get(pk=pk), "cancelled", request.user)
        Notification.objects.filter(request_id=pk, kind="review_requested", read_at__isnull=True).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------- notifications (everyone)

def notification_row(n):
    return {"id": n.pk, "kind": n.kind, "title": n.title, "body": n.body, "link": n.link,
            "created_at": iso(n.created_at), "read": n.read_at is not None}


class NotificationsView(APIView):
    def get(self, request):
        mine = Notification.objects.filter(user=request.user)
        return Response({"results": [notification_row(n) for n in mine[:40]],
                         "unread": mine.filter(read_at__isnull=True).count()})


class NotificationsReadView(APIView):
    def post(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        mine = Notification.objects.filter(user=request.user, read_at__isnull=True)
        ids = data.get("ids")
        if isinstance(ids, list):
            mine = mine.filter(pk__in=[i for i in ids if isinstance(i, int)])
        mine.update(read_at=timezone.now())
        return Response(status=status.HTTP_204_NO_CONTENT)

