"""The admin console's API (frontend /console), staff only.

Every endpoint needs a signed-in staff user (`is_staff`). Changing another
account's staff role is limited to superusers, nobody can lock themselves out,
and the last active superuser can't be demoted, deactivated or deleted. Every
change made here is written to the activity log as an "admin" event.

    GET    /api/admin/overview/                   headline numbers, 30-day series, recent activity
    GET    /api/admin/users/                      ?q &status=active|inactive &role=staff|user &page
    GET    /api/admin/users/export/               the same filters, as CSV
    GET    /api/admin/users/<id>/                 profile, assessments, sign-ins, sessions, activity
    PATCH  /api/admin/users/<id>/                 { name, is_active, is_staff }
    DELETE /api/admin/users/<id>/
    POST   /api/admin/users/<id>/send-reset/      email a password-reset link
    POST   /api/admin/users/<id>/sign-out/        end every session of that user
    GET    /api/admin/assessments/                ?q &risk &low_confidence &user &date_from &date_to &page
    GET    /api/admin/assessments/export/         the same filters, as CSV
    GET    /api/admin/assessments/<ref>/
    PATCH  /api/admin/assessments/<ref>/          { notes }
    DELETE /api/admin/assessments/<ref>/
    GET    /api/admin/model/                      model card: metadata, comparison, files, state
    POST   /api/admin/model/check/                run the sample patients: does each land in its band?
    POST   /api/admin/model/test/                 one prediction from any payload, not saved
    POST   /api/admin/model/reload/               drop the cached model and load it again
    GET    /api/admin/activity/                   ?kind &q &date_from &date_to &page
    GET    /api/admin/activity/export/            as CSV
    GET    /api/admin/system/                     health checks, versions, configuration
    GET    /api/admin/maintenance/                what each task would clean up
    POST   /api/admin/maintenance/<task>/         run one task
    GET    /api/admin/backup/                     everything (no password hashes) as JSON
    GET    /api/admin/settings/                   site switches
    PATCH  /api/admin/settings/
"""

import csv
import io
import json
import os
import platform
import shutil
import sys
import time
from collections import Counter
from datetime import date, datetime, timedelta

import django
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.sessions.models import Session
from django.core.cache import cache
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .accounts import send_reset_email
from .activity import record
from .admin import cell
from .models import ActivityEvent, Assessment, ConnectionEvent, Profile, SiteSettings, SocialAccount
from .profiles import UNDO_SECONDS, purge_expired
from .samples import SAMPLES
from .serializers import ProfileSerializer
from .services import explainability_service, prediction_service
from .services.model_store import METADATA_PATH, MODEL_DIR, PIPELINE_PATH, SHAP_BACKGROUND_PATH
from .services.prediction_service import PredictionInputError

STARTED_AT = time.time()
PAGE_SIZE = 20
ACTIVITY_RETENTION_DAYS = 180
User = get_user_model()


# ---------------------------------------------------------------- helpers

class StaffView(APIView):
    permission_classes = [IsAdminUser]


def bad(detail, code=status.HTTP_400_BAD_REQUEST):
    return Response({"detail": detail}, status=code)


def paginate(request, queryset, serialize):
    """?page=1.. → { results, count, page, pages, page_size }."""
    try:
        page = max(1, int(request.query_params.get("page", 1)))
    except ValueError:
        page = 1
    count = queryset.count()
    pages = max(1, -(-count // PAGE_SIZE))
    page = min(page, pages)
    rows = queryset[(page - 1) * PAGE_SIZE: page * PAGE_SIZE]
    return {"results": [serialize(r) for r in rows], "count": count, "page": page, "pages": pages,
            "page_size": PAGE_SIZE}


def parse_day(value):
    try:
        return date.fromisoformat(value) if value else None
    except ValueError:
        return None


def date_filter(queryset, request, field="created_at"):
    start, end = parse_day(request.query_params.get("date_from")), parse_day(request.query_params.get("date_to"))
    if start:
        queryset = queryset.filter(**{f"{field}__date__gte": start})
    if end:
        queryset = queryset.filter(**{f"{field}__date__lte": end})
    return queryset


def csv_response(filename, header, rows):
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(header)
    for row in rows:
        writer.writerow([cell(v) for v in row])
    response = HttpResponse(buffer.getvalue(), content_type="text/csv")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def admin_log(request, summary, **detail):
    record("admin", summary, user=request.user, request=request, **detail)


def iso(value):
    return value.isoformat() if value else None


def user_sessions(user_id):
    """Unexpired sessions that belong to this user."""
    now = timezone.now()
    return [s for s in Session.objects.filter(expire_date__gt=now)
            if str(s.get_decoded().get("_auth_user_id")) == str(user_id)]


def user_name(user):
    return user.first_name or user.email or user.username


# ---------------------------------------------------------------- overview

class OverviewView(StaffView):
    def get(self, request):
        now = timezone.now()
        today = timezone.localdate()
        since30 = today - timedelta(days=29)
        week_ago = now - timedelta(days=7)
        assessments = Assessment.objects.all()

        risk_counts = {r: 0 for r in ("low", "moderate", "high")}
        for row in assessments.values("risk_level").annotate(n=Count("id")):
            risk_counts[row["risk_level"]] = row["n"]
        total = sum(risk_counts.values())

        # 30-day series: sign-ups and predictions by band, one row per day.
        days = [since30 + timedelta(days=i) for i in range(30)]
        series = {d: {"date": d.isoformat(), "signups": 0, "low": 0, "moderate": 0, "high": 0} for d in days}
        for row in (User.objects.filter(date_joined__date__gte=since30).annotate(day=TruncDate("date_joined"))
                    .values("day").annotate(n=Count("id"))):
            if row["day"] in series:
                series[row["day"]]["signups"] = row["n"]
        for row in (assessments.filter(created_at__date__gte=since30).annotate(day=TruncDate("created_at"))
                    .values("day", "risk_level").annotate(n=Count("id"))):
            if row["day"] in series:
                series[row["day"]][row["risk_level"]] = row["n"]

        # What most often raised recent estimates (positive top factors, last 30 days).
        raised = Counter()
        for factors in assessments.filter(created_at__date__gte=since30).values_list("top_factors", flat=True):
            for f in (factors or [])[:3]:
                if f.get("contribution", 0) > 0:
                    raised[f["name"]] += 1

        active_ids = set(ActivityEvent.objects.filter(created_at__gte=week_ago, user__isnull=False,
                                                      kind__in=["login", "social_login", "prediction"])
                         .values_list("user_id", flat=True))
        site = SiteSettings.load()
        return Response({
            "users": {
                "total": User.objects.count(),
                "active": User.objects.filter(is_active=True).count(),
                "staff": User.objects.filter(is_staff=True).count(),
                "new_7d": User.objects.filter(date_joined__gte=week_ago).count(),
                "active_7d": len(active_ids),
                "with_profile": Profile.objects.filter(user__isnull=False, deleted_at__isnull=True).count(),
                "google_or_x": SocialAccount.objects.values("user").distinct().count(),
            },
            "assessments": {
                "total": total,
                "today": assessments.filter(created_at__date=today).count(),
                "last_7d": assessments.filter(created_at__gte=week_ago).count(),
                "low_confidence": assessments.filter(low_confidence=True).count(),
                "risk": risk_counts,
            },
            "security": {
                "failed_logins_24h": ActivityEvent.objects.filter(
                    kind="login_failed", created_at__gte=now - timedelta(hours=24)).count(),
                "sessions_active": Session.objects.filter(expire_date__gt=now).count(),
            },
            "series": list(series.values()),
            "top_raising_factors": [{"name": n, "count": c} for n, c in raised.most_common(6)],
            "recent_activity": [activity_row(e) for e in ActivityEvent.objects.select_related("user")[:8]],
            "site": site_payload(site),
            "model": {
                "loaded": prediction_service.load_model.cache_info().currsize > 0,
                "name": model_metadata().get("selected_model", ""),
                "trained_at": model_metadata().get("trained_at", ""),
            },
            "generated_at": now.isoformat(),
        })


# ---------------------------------------------------------------- users

def user_row(user):
    return {
        "id": user.pk,
        "name": user_name(user),
        "email": user.email,
        "username": user.username,
        "is_active": user.is_active,
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "date_joined": iso(user.date_joined),
        "last_login": iso(user.last_login),
        "assessments": getattr(user, "n_assessments", None),
        "has_password": user.has_usable_password(),
        "sign_in_with": sorted({s.provider for s in user.social_accounts.all()}),
    }


def users_queryset(request):
    qs = User.objects.annotate(n_assessments=Count("assessments")).prefetch_related("social_accounts")
    q = request.query_params.get("q", "").strip()
    if q:
        qs = qs.filter(Q(email__icontains=q) | Q(first_name__icontains=q) | Q(username__icontains=q))
    status_ = request.query_params.get("status")
    if status_ == "active":
        qs = qs.filter(is_active=True)
    elif status_ == "inactive":
        qs = qs.filter(is_active=False)
    role = request.query_params.get("role")
    if role == "staff":
        qs = qs.filter(is_staff=True)
    elif role == "user":
        qs = qs.filter(is_staff=False)
    sort = request.query_params.get("sort", "-date_joined")
    allowed = {"date_joined", "-date_joined", "last_login", "-last_login", "email", "-email",
               "n_assessments", "-n_assessments"}
    return qs.order_by(sort if sort in allowed else "-date_joined", "pk")


class UsersView(StaffView):
    def get(self, request):
        return Response(paginate(request, users_queryset(request), user_row))


class UsersExportView(StaffView):
    def get(self, request):
        rows = ([u.pk, user_name(u), u.email, u.is_active, u.is_staff, u.is_superuser, iso(u.date_joined),
                 iso(u.last_login), u.n_assessments] for u in users_queryset(request))
        return csv_response("cardio-sense-users.csv",
                            ["id", "name", "email", "active", "staff", "superuser", "joined", "last_login",
                             "assessments"], rows)


def guard_change(request, target, *, deactivate=False, demote=False, delete=False):
    """Why this change isn't allowed, or ''."""
    me = request.user
    if target.pk == me.pk and (deactivate or demote or delete):
        return "You can't deactivate, demote or delete your own account here."
    if (demote or (target.is_staff and (deactivate or delete))) and not me.is_superuser:
        return "Only a superuser can change or remove a staff account."
    if target.is_superuser and (deactivate or demote or delete):
        others = User.objects.filter(is_superuser=True, is_active=True).exclude(pk=target.pk).count()
        if others == 0:
            return "This is the last active superuser; keep at least one."
    return ""


class UserDetailView(StaffView):
    def get_user(self, pk):
        return User.objects.filter(pk=pk).prefetch_related("social_accounts").first()

    def get(self, request, pk):
        user = self.get_user(pk)
        if user is None:
            return bad("No such user.", 404)
        user.n_assessments = user.assessments.count()
        profile = Profile.objects.filter(user=user).first()
        return Response({
            **user_row(user),
            "profile": ProfileSerializer(profile).data if profile else None,
            "profile_deleted": bool(profile and profile.deleted_at),
            "assessments_recent": [assessment_row(a) for a in user.assessments.order_by("-created_at")[:10]],
            "sessions": len(user_sessions(user.pk)),
            "social_accounts": [{"provider": s.provider, "handle": s.handle, "created_at": iso(s.created_at),
                                 "last_login_at": iso(s.last_login_at)} for s in user.social_accounts.all()],
            "activity": [activity_row(e) for e in user.activity.all()[:15]],
        })

    def patch(self, request, pk):
        user = self.get_user(pk)
        if user is None:
            return bad("No such user.", 404)
        data = request.data if isinstance(request.data, dict) else {}
        changes = []
        if "is_active" in data and bool(data["is_active"]) != user.is_active:
            problem = guard_change(request, user, deactivate=not data["is_active"])
            if problem:
                return bad(problem, 403)
            user.is_active = bool(data["is_active"])
            changes.append("activated" if user.is_active else "deactivated")
        if "is_staff" in data and bool(data["is_staff"]) != user.is_staff:
            if not request.user.is_superuser:
                return bad("Only a superuser can grant or remove staff access.", 403)
            problem = guard_change(request, user, demote=not data["is_staff"])
            if problem:
                return bad(problem, 403)
            user.is_staff = bool(data["is_staff"])
            changes.append("made staff" if user.is_staff else "removed from staff")
        if "name" in data:
            name = str(data["name"]).strip()
            if not name or len(name) > 80:
                return bad("Enter a name of 1 to 80 characters.")
            if name != user.first_name:
                user.first_name = name
                changes.append("renamed")
        if changes:
            user.save()
            if not user.is_active:  # a deactivated account is signed out everywhere
                for s in user_sessions(user.pk):
                    s.delete()
            admin_log(request, f"{', '.join(changes).capitalize()}: {user.email or user.username}",
                      target_user=user.pk, changes=changes)
        user.n_assessments = user.assessments.count()
        return Response(user_row(user))

    def delete(self, request, pk):
        user = self.get_user(pk)
        if user is None:
            return bad("No such user.", 404)
        problem = guard_change(request, user, delete=True)
        if problem:
            return bad(problem, 403)
        email = user.email or user.username
        for s in user_sessions(user.pk):
            s.delete()
        user.delete()
        admin_log(request, f"Deleted account {email}", target_email=email)
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserSendResetView(StaffView):
    def post(self, request, pk):
        user = User.objects.filter(pk=pk).first()
        if user is None:
            return bad("No such user.", 404)
        if not user.email or not user.is_active:
            return bad("This account has no email address or is inactive.")
        send_reset_email(user)
        admin_log(request, f"Sent a password-reset link to {user.email}", target_user=user.pk)
        return Response({"detail": f"A reset link was emailed to {user.email}."})


class UserSignOutView(StaffView):
    def post(self, request, pk):
        user = User.objects.filter(pk=pk).first()
        if user is None:
            return bad("No such user.", 404)
        sessions = user_sessions(user.pk)
        for s in sessions:
            s.delete()
        admin_log(request, f"Signed {user.email or user.username} out everywhere", target_user=user.pk,
                  sessions=len(sessions))
        return Response({"detail": f"Ended {len(sessions)} session(s)."})


# ---------------------------------------------------------------- assessments

def assessment_row(a):
    return {
        "id": a.reference,
        "pk": a.pk,
        "created_at": iso(a.created_at),
        "user": {"id": a.user_id, "email": a.user.email if a.user else "", "name": user_name(a.user) if a.user else ""},
        "age": a.age,
        "sex": a.sex,
        "probability": a.probability,
        "risk_level": a.risk_level,
        "low_confidence": a.low_confidence,
        "missing": len(a.missing_fields or []),
        "outside": len(a.outside_training or []),
        "model_name": a.model_name,
        "has_notes": bool(a.notes),
    }


def assessments_queryset(request):
    qs = Assessment.objects.select_related("user").order_by("-created_at")
    q = request.query_params.get("q", "").strip()
    if q:
        ref = q.upper().removeprefix("A-")
        cond = Q(user__email__icontains=q) | Q(user__first_name__icontains=q) | Q(notes__icontains=q)
        if ref.isdigit():
            cond |= Q(pk=int(ref))
        qs = qs.filter(cond)
    risk = request.query_params.get("risk")
    if risk in ("low", "moderate", "high"):
        qs = qs.filter(risk_level=risk)
    if request.query_params.get("low_confidence") in ("1", "true"):
        qs = qs.filter(low_confidence=True)
    user = request.query_params.get("user")
    if user and user.isdigit():
        qs = qs.filter(user_id=int(user))
    return date_filter(qs, request)


def find_assessment(ref):
    pk = str(ref).upper().removeprefix("A-")
    return Assessment.objects.select_related("user").filter(pk=int(pk)).first() if pk.isdigit() else None


class AssessmentsView(StaffView):
    def get(self, request):
        return Response(paginate(request, assessments_queryset(request), assessment_row))


class AssessmentsExportView(StaffView):
    def get(self, request):
        rows = ([a.reference, iso(a.created_at), a.user.email if a.user else "", a.age, a.sex, a.probability,
                 a.risk_level, a.low_confidence, "; ".join(a.missing_fields or []),
                 "; ".join(o["name"] for o in a.outside_training or []), a.model_name, json.dumps(a.inputs),
                 json.dumps(a.top_factors), a.notes] for a in assessments_queryset(request))
        return csv_response("cardio-sense-assessments.csv",
                            ["reference", "created_at", "user", "age", "sex", "probability", "risk_level",
                             "low_confidence", "missing_fields", "outside_training", "model", "inputs",
                             "top_factors", "notes"], rows)


class AssessmentDetailView(StaffView):
    def get(self, request, ref):
        a = find_assessment(ref)
        if a is None:
            return bad("No such assessment.", 404)
        return Response({
            **assessment_row(a),
            "inputs": a.inputs,
            "top_factors": a.top_factors,
            "missing_fields": a.missing_fields,
            "outside_training": a.outside_training,
            "model_trained_at": a.model_trained_at,
            "notes": a.notes,
        })

    def patch(self, request, ref):
        a = find_assessment(ref)
        if a is None:
            return bad("No such assessment.", 404)
        notes = str((request.data or {}).get("notes", ""))
        if len(notes) > 4000:
            return bad("Keep notes under 4,000 characters.")
        a.notes = notes
        a.save(update_fields=["notes"])
        admin_log(request, f"Updated staff notes on {a.reference}", assessment=a.reference)
        return Response({"notes": a.notes})

    def delete(self, request, ref):
        a = find_assessment(ref)
        if a is None:
            return bad("No such assessment.", 404)
        reference = a.reference
        a.delete()
        admin_log(request, f"Deleted assessment {reference}", assessment=reference)
        return Response(status=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------- model

def model_metadata():
    try:
        with open(METADATA_PATH, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def file_info(path):
    try:
        st = os.stat(path)
        return {"name": os.path.basename(path), "size": st.st_size,
                "modified": datetime.fromtimestamp(st.st_mtime, tz=timezone.get_current_timezone()).isoformat()}
    except OSError:
        return {"name": os.path.basename(path), "size": None, "modified": None}


class ModelView(StaffView):
    def get(self, request):
        meta = model_metadata()
        comparison = []
        try:
            with open(MODEL_DIR / meta.get("artifacts", {}).get("comparison", "model_comparison_results.csv"),
                      encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    comparison.append({k: row[k] for k in (
                        "Model", "CV ROC-AUC Mean", "CV Recall Mean", "CV F1 Mean", "CV Brier Mean",
                        "Test ROC-AUC", "Test Accuracy", "Test Recall") if k in row})
        except OSError:
            pass
        return Response({
            "loaded": prediction_service.load_model.cache_info().currsize > 0,
            "available": PIPELINE_PATH.exists(),
            "metadata": {k: meta.get(k) for k in (
                "selected_model", "trained_at", "sklearn_version", "dataset", "modeling_rows", "train_rows",
                "test_rows", "class_balance", "selection_rule", "validation", "decision_threshold",
                "deployment_excluded_columns", "deployment_exclusion_reason", "best_parameters",
                "selected_model_metrics", "calibration", "raw_input_features", "dataset_sha256")},
            "feature_ranges": [e for e in meta.get("feature_schema", []) if "min" in e],
            "comparison": comparison,
            "files": [file_info(p) for p in (PIPELINE_PATH, METADATA_PATH, SHAP_BACKGROUND_PATH)],
            "risk_bands": [{"level": label, "below": upper} for upper, label in prediction_service.RISK_BANDS],
            "model_dir": str(MODEL_DIR),
        })


class ModelCheckView(StaffView):
    """Run the three sample patients; each should land in its own band."""

    def post(self, request):
        started = time.time()
        results = []
        for expected, payload in SAMPLES.items():
            r = prediction_service.predict(payload)
            results.append({"sample": expected, "expected": expected, "probability": r["probability"],
                            "risk_level": r["risk_level"], "ok": r["risk_level"] == expected})
        ok = all(r["ok"] for r in results)
        admin_log(request, f"Ran the model check: {'all samples in their bands' if ok else 'samples out of band'}",
                  ok=ok)
        return Response({"ok": ok, "results": results, "seconds": round(time.time() - started, 2)})


class ModelTestView(StaffView):
    """One prediction from any payload. Not saved, not counted as an assessment."""

    def post(self, request):
        payload = request.data if isinstance(request.data, dict) else {}
        if "sample" in payload:
            payload = SAMPLES.get(payload["sample"], {})
        try:
            return Response({"result": prediction_service.predict(payload), "payload": payload})
        except PredictionInputError as err:
            return bad(str(err))


class ModelReloadView(StaffView):
    def post(self, request):
        started = time.time()
        prediction_service.load_model.cache_clear()
        explainability_service._explainer.cache_clear()
        prediction_service.predict(SAMPLES["low"])  # load and warm the explainer again
        admin_log(request, "Reloaded the prediction model")
        return Response({"detail": "Model reloaded.", "seconds": round(time.time() - started, 2)})


# ---------------------------------------------------------------- activity

def activity_row(e):
    return {"id": e.pk, "created_at": iso(e.created_at), "kind": e.kind, "kind_label": e.get_kind_display(),
            "summary": e.summary, "email": e.email, "user_id": e.user_id, "ip": e.ip, "detail": e.detail}


def activity_queryset(request):
    qs = ActivityEvent.objects.select_related("user")
    kind = request.query_params.get("kind")
    if kind in dict(ActivityEvent.KINDS):
        qs = qs.filter(kind=kind)
    q = request.query_params.get("q", "").strip()
    if q:
        qs = qs.filter(Q(email__icontains=q) | Q(summary__icontains=q) | Q(ip__startswith=q))
    return date_filter(qs, request)


class ActivityView(StaffView):
    def get(self, request):
        data = paginate(request, activity_queryset(request), activity_row)
        data["kinds"] = [{"value": k, "label": label} for k, label in ActivityEvent.KINDS]
        return Response(data)


class ActivityExportView(StaffView):
    def get(self, request):
        rows = ([iso(e.created_at), e.get_kind_display(), e.email, e.summary, e.ip or ""]
                for e in activity_queryset(request))
        return csv_response("cardio-sense-activity.csv", ["time", "kind", "email", "summary", "ip"], rows)


# ---------------------------------------------------------------- system health

def check(name, ok, detail, warn=False):
    return {"name": name, "status": "ok" if ok and not warn else ("warn" if ok else "fail"), "detail": detail}


def git_commit():
    head = settings.BASE_DIR.parent / ".git" / "HEAD"
    try:
        ref = head.read_text().strip()
        if ref.startswith("ref:"):
            ref_path = settings.BASE_DIR.parent / ".git" / ref.split(" ", 1)[1]
            return ref.rsplit("/", 1)[-1], (ref_path.read_text().strip()[:7] if ref_path.exists() else "")
        return "detached", ref[:7]
    except OSError:
        return "", ""


def versions():
    out = {"python": platform.python_version(), "django": django.get_version()}
    for name in ("rest_framework", "sklearn", "shap", "numpy", "pandas"):
        module = sys.modules.get(name)
        if module is None:
            try:
                module = __import__(name)
            except ImportError:
                continue
        out[name.replace("rest_framework", "djangorestframework").replace("sklearn", "scikit-learn")] = getattr(
            module, "__version__", getattr(module, "VERSION", "?"))
    return {k: (".".join(map(str, v)) if isinstance(v, tuple) else str(v)) for k, v in out.items()}


class SystemView(StaffView):
    def get(self, request):
        checks = []
        # Database
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            db = settings.DATABASES["default"]
            size = os.path.getsize(db["NAME"]) if db["ENGINE"].endswith("sqlite3") and os.path.exists(str(db["NAME"])) else None
            detail = f"{connection.vendor}" + (f", {size / 1024 / 1024:.1f} MB" if size is not None else "")
            checks.append(check("Database", True, detail, warn=connection.vendor == "sqlite" and not settings.DEBUG))
        except Exception as err:  # noqa: BLE001
            checks.append(check("Database", False, str(err)[:200]))
        # Migrations
        try:
            plan = MigrationExecutor(connection).migration_plan(MigrationExecutor(connection).loader.graph.leaf_nodes())
            checks.append(check("Migrations", not plan, "all applied" if not plan else f"{len(plan)} pending"))
        except Exception as err:  # noqa: BLE001
            checks.append(check("Migrations", False, str(err)[:200]))
        # Cache (throttling and site settings live here)
        try:
            cache.set("cardio:health", "ok", 10)
            ok = cache.get("cardio:health") == "ok"
            backend = settings.CACHES["default"]["BACKEND"].rsplit(".", 1)[-1]
            checks.append(check("Cache", ok, backend, warn=backend == "LocMemCache" and not settings.DEBUG))
        except Exception as err:  # noqa: BLE001
            checks.append(check("Cache", False, str(err)[:200]))
        # Model
        loaded = prediction_service.load_model.cache_info().currsize > 0
        checks.append(check("Prediction model", PIPELINE_PATH.exists(),
                            ("loaded in memory" if loaded else "on disk, loads on first use")
                            if PIPELINE_PATH.exists() else f"missing: {PIPELINE_PATH}", warn=not loaded))
        # Email
        # Every backend class is called EmailBackend; the module says which one it is.
        kind = settings.EMAIL_BACKEND.rsplit(".", 2)[-2]
        email_detail = {
            "smtp": f"SMTP via {getattr(settings, 'EMAIL_HOST', '')}",
            "console": "printed to the server console (no real mail is sent)",
            "locmem": "kept in memory (tests)",
        }.get(kind, kind)
        checks.append(check("Email", True, email_detail, warn=kind != "smtp"))
        # Sign-in providers
        providers = {p: bool(c.get("client_id") and c.get("client_secret")) for p, c in settings.OAUTH_CLIENTS.items()}
        configured = [("Google" if p == "gmail" else p.title()) for p, on in providers.items() if on]
        checks.append(check("Google / X sign-in", True, ", ".join(configured) or "none configured",
                            warn=not (providers.get("gmail") or providers.get("x"))))
        # Security posture
        checks.append(check("Debug mode", True, "on (development)" if settings.DEBUG else "off", warn=settings.DEBUG))
        default_key = settings.SECRET_KEY == "dev-only-insecure-key"
        checks.append(check("Secret key", True, "development key" if default_key else "set from the environment",
                            warn=default_key))
        # Disk
        try:
            usage = shutil.disk_usage(settings.BASE_DIR)
            free_pct = usage.free / usage.total * 100
            checks.append(check("Disk space", free_pct > 5, f"{usage.free / 1024 ** 3:.1f} GB free ({free_pct:.0f}%)",
                                warn=free_pct < 15))
        except OSError as err:
            checks.append(check("Disk space", False, str(err)[:200]))

        branch, commit = git_commit()
        site = SiteSettings.load()
        return Response({
            "status": "fail" if any(c["status"] == "fail" for c in checks)
            else "warn" if any(c["status"] == "warn" for c in checks) else "ok",
            "checks": checks,
            "versions": versions(),
            "build": {"branch": branch, "commit": commit},
            "uptime_seconds": int(time.time() - STARTED_AT),
            "server_time": timezone.now().isoformat(),
            "timezone": settings.TIME_ZONE,
            "counts": {
                "users": User.objects.count(), "profiles": Profile.objects.count(),
                "assessments": Assessment.objects.count(), "activity_events": ActivityEvent.objects.count(),
                "link_events": ConnectionEvent.objects.count(), "sessions": Session.objects.count(),
            },
            "config": {
                "allowed_hosts": settings.ALLOWED_HOSTS,
                "frontend_url": settings.FRONTEND_URL,
                "throttle_rates": settings.REST_FRAMEWORK.get("DEFAULT_THROTTLE_RATES", {}),
                "session_hours": settings.SESSION_COOKIE_AGE / 3600,
                "https_redirect": getattr(settings, "SECURE_SSL_REDIRECT", False),
                "maintenance_mode": site.maintenance_mode,
            },
            "django_admin_url": request.build_absolute_uri("/admin/"),
        })


# ---------------------------------------------------------------- maintenance

def maintenance_counts():
    now = timezone.now()
    return {
        "purge_deleted_profiles": Profile.objects.filter(
            deleted_at__lt=now - timedelta(seconds=UNDO_SECONDS)).count(),
        "purge_orphans": Profile.objects.filter(user__isnull=True).count()
        + Assessment.objects.filter(user__isnull=True).count(),
        "clear_expired_sessions": Session.objects.filter(expire_date__lt=now).count(),
        "purge_old_activity": ActivityEvent.objects.filter(
            created_at__lt=now - timedelta(days=ACTIVITY_RETENTION_DAYS)).count(),
        "clear_cache": None,
        "warm_model": None,
    }


TASKS = {
    "purge_deleted_profiles": "Purge profiles deleted more than 10 minutes ago",
    "purge_orphans": "Delete profiles and assessments that belong to no account",
    "clear_expired_sessions": "Delete expired login sessions",
    "purge_old_activity": f"Delete activity older than {ACTIVITY_RETENTION_DAYS} days",
    "clear_cache": "Clear the cache (throttle counters, cached settings)",
    "warm_model": "Load the model and explainer into memory",
}


class MaintenanceView(StaffView):
    def get(self, request):
        counts = maintenance_counts()
        return Response([{"task": t, "label": label, "pending": counts[t]} for t, label in TASKS.items()])


class MaintenanceRunView(StaffView):
    def post(self, request, task):
        if task not in TASKS:
            return bad("Unknown task.", 404)
        now = timezone.now()
        started = time.time()
        if task == "purge_deleted_profiles":
            n = purge_expired()
        elif task == "purge_orphans":
            n = Assessment.objects.filter(user__isnull=True).delete()[0]
            n += Profile.objects.filter(user__isnull=True).delete()[0]
        elif task == "clear_expired_sessions":
            n = Session.objects.filter(expire_date__lt=now).delete()[0]
        elif task == "purge_old_activity":
            n = ActivityEvent.objects.filter(created_at__lt=now - timedelta(days=ACTIVITY_RETENTION_DAYS)).delete()[0]
        elif task == "clear_cache":
            cache.clear()
            n = None
        else:  # warm_model
            prediction_service.predict(SAMPLES["low"])
            n = None
        summary = TASKS[task] + (f": {n} removed" if n is not None else ": done")
        record("maintenance", summary, user=request.user, request=request, task=task, removed=n)
        return Response({"detail": summary, "removed": n, "seconds": round(time.time() - started, 2)})


class BackupView(StaffView):
    """Everything the app stores, as one JSON download (password hashes are never included)."""

    def get(self, request):
        data = {
            "exported_at": timezone.now().isoformat(),
            "exported_by": request.user.email,
            "users": [{"id": u.pk, "email": u.email, "name": u.first_name, "is_active": u.is_active,
                       "is_staff": u.is_staff, "date_joined": iso(u.date_joined), "last_login": iso(u.last_login)}
                      for u in User.objects.order_by("pk")],
            "profiles": [{"user": p.user_id, **ProfileSerializer(p).data} for p in Profile.objects.order_by("pk")],
            "assessments": [{"user": a.user_id, **a.as_record(), "notes": a.notes, "model": a.model_name}
                            for a in Assessment.objects.order_by("pk")],
            "social_accounts": [{"user": s.user_id, "provider": s.provider, "handle": s.handle}
                                for s in SocialAccount.objects.order_by("pk")],
            "site_settings": site_payload(SiteSettings.load()),
        }
        admin_log(request, "Downloaded a full data backup")
        response = HttpResponse(json.dumps(data, indent=2, default=str), content_type="application/json")
        response["Content-Disposition"] = f'attachment; filename="cardio-sense-backup-{timezone.localdate()}.json"'
        return response


# ---------------------------------------------------------------- site settings

SETTINGS_FIELDS = ("maintenance_mode", "maintenance_message", "announcement", "announcement_level",
                   "registration_open", "predictions_open")


def site_payload(site):
    return {**{f: getattr(site, f) for f in SETTINGS_FIELDS}, "updated_at": iso(site.updated_at),
            "updated_by": site.updated_by}


class SettingsView(StaffView):
    def get(self, request):
        return Response(site_payload(SiteSettings.load()))

    def patch(self, request):
        site, _ = SiteSettings.objects.get_or_create(pk=1)
        data = request.data if isinstance(request.data, dict) else {}
        changed = []
        for field in SETTINGS_FIELDS:
            if field not in data:
                continue
            value = data[field]
            if field in ("maintenance_mode", "registration_open", "predictions_open"):
                value = bool(value)
            elif field == "announcement_level":
                if value not in dict(SiteSettings.LEVELS):
                    return bad("Choose information, warning or critical.")
            else:
                value = str(value).strip()
                if len(value) > 300:
                    return bad("Keep messages under 300 characters.")
            if getattr(site, field) != value:
                setattr(site, field, value)
                changed.append(field)
        if changed:
            site.updated_by = request.user.email
            site.save()
            admin_log(request, "Changed site settings: " + ", ".join(f.replace("_", " ") for f in changed),
                      fields=changed)
        return Response(site_payload(site))


class PublicSiteView(APIView):
    """GET /api/site/ (anyone): the banner and switches every page needs."""

    permission_classes = []
    authentication_classes = []

    def get(self, request):
        site = SiteSettings.load()
        return Response({
            "announcement": site.announcement,
            "announcement_level": site.announcement_level,
            "maintenance_mode": site.maintenance_mode,
            "maintenance_message": site.maintenance_message if site.maintenance_mode else "",
            "registration_open": site.registration_open,
            "predictions_open": site.predictions_open,
        })
