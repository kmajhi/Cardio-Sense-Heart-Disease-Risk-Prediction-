"""The admin console's API (predictor/admin_api.py) and site switches."""

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.urls import reverse
from rest_framework.test import APIClient

from predictor.models import ActivityEvent, Assessment, SiteSettings

pytestmark = pytest.mark.django_db
User = get_user_model()

STAFF_ENDPOINTS = [
    ("get", "admin-overview"), ("get", "admin-users"), ("get", "admin-users-export"),
    ("get", "admin-assessments"), ("get", "admin-assessments-export"), ("get", "admin-model"),
    ("get", "admin-activity"), ("get", "admin-activity-export"), ("get", "admin-system"),
    ("get", "admin-maintenance"), ("get", "admin-backup"), ("get", "admin-settings"),
    ("get", "admin-search"), ("get", "admin-notifications"), ("get", "admin-security"),
]


def client_for(user):
    api = APIClient()
    api.force_login(user)
    return api


@pytest.fixture
def superuser(django_user_model):
    return django_user_model.objects.create_superuser(
        username="boss@example.com", email="boss@example.com", password="Boss-Pass-123", first_name="Boss")


@pytest.fixture
def staff(django_user_model):
    return django_user_model.objects.create_user(
        username="staff@example.com", email="staff@example.com", password="Staff-Pass-123", is_staff=True)


@pytest.fixture
def boss(superuser):
    return client_for(superuser)


# ---------- Access ----------

@pytest.mark.parametrize("method, name", STAFF_ENDPOINTS)
def test_signed_out_and_regular_users_are_kept_out(method, name, user):
    assert getattr(APIClient(), method)(reverse(name)).status_code == 401
    assert getattr(client_for(user), method)(reverse(name)).status_code == 403


@pytest.mark.parametrize("method, name", STAFF_ENDPOINTS)
def test_staff_can_open_every_section(method, name, staff):
    res = getattr(client_for(staff), method)(reverse(name))
    assert res.status_code == 200, (name, res.content[:200])


def test_me_tells_the_frontend_who_is_staff(superuser, user):
    assert client_for(superuser).get(reverse("auth-me")).json()["is_staff"] is True
    assert client_for(user).get(reverse("auth-me")).json()["is_staff"] is False


# ---------- Overview ----------

def test_overview_counts_and_series(trained, boss, user, patient):
    client_for(user).post(reverse("predict"), patient, format="json")
    body = boss.get(reverse("admin-overview")).json()
    assert body["users"]["total"] == 2
    assert body["assessments"]["total"] == 1 and body["assessments"]["today"] == 1
    assert sum(body["assessments"]["risk"].values()) == 1
    assert len(body["series"]) == 30
    assert sum(d["low"] + d["moderate"] + d["high"] for d in body["series"]) == 1
    assert any(e["kind"] == "prediction" for e in body["recent_activity"])


# ---------- Users ----------

def test_user_list_search_filter_and_detail(boss, user, staff):
    names = [u["email"] for u in boss.get(reverse("admin-users"), {"q": "nadia"}).json()["results"]]
    assert names == ["nadia@example.com"]
    staff_only = boss.get(reverse("admin-users"), {"role": "staff"}).json()["results"]
    assert {u["email"] for u in staff_only} == {"boss@example.com", "staff@example.com"}
    detail = boss.get(reverse("admin-user", args=[user.pk])).json()
    assert detail["email"] == "nadia@example.com" and detail["profile"] is None and "activity" in detail


def test_deactivating_a_user_signs_them_out_and_is_logged(boss, user):
    victim = client_for(user)
    assert victim.get(reverse("auth-me")).status_code == 200
    res = boss.patch(reverse("admin-user", args=[user.pk]), {"is_active": False}, format="json")
    assert res.status_code == 200 and res.json()["is_active"] is False
    assert victim.get(reverse("auth-me")).status_code == 401
    assert ActivityEvent.objects.filter(kind="admin", summary__icontains="deactivated").exists()


def test_only_superusers_change_staff_roles(boss, user, staff):
    staffer = client_for(staff)
    assert staffer.patch(reverse("admin-user", args=[user.pk]), {"is_staff": True}, format="json").status_code == 403
    assert boss.patch(reverse("admin-user", args=[user.pk]), {"is_staff": True}, format="json").json()["is_staff"]


def test_nobody_locks_themselves_out(boss, superuser):
    for change in ({"is_active": False}, {"is_staff": False}):
        res = boss.patch(reverse("admin-user", args=[superuser.pk]), change, format="json")
        assert res.status_code == 403
    assert boss.delete(reverse("admin-user", args=[superuser.pk])).status_code == 403


def test_one_superuser_can_deactivate_another(superuser, django_user_model):
    other = django_user_model.objects.create_superuser(username="two@example.com", email="two@example.com",
                                                       password="Two-Pass-1234")
    res = client_for(other).patch(reverse("admin-user", args=[superuser.pk]), {"is_active": False}, format="json")
    assert res.status_code == 200
    superuser.refresh_from_db()
    assert superuser.is_active is False


def test_the_last_active_superuser_is_protected(superuser, django_user_model):
    """Defence in depth: even if some route let another account act on it, the last
    active superuser can't be deactivated, demoted or deleted."""
    from types import SimpleNamespace

    from predictor.admin_api import guard_change

    acting = django_user_model.objects.create_superuser(username="old@example.com", email="old@example.com",
                                                        password="Old-Pass-1234", is_active=False)
    request = SimpleNamespace(user=acting)
    for change in ({"deactivate": True}, {"demote": True}, {"delete": True}):
        assert "last active superuser" in guard_change(request, superuser, **change)


def test_send_reset_sign_out_and_delete(boss, user):
    assert boss.post(reverse("admin-user-reset", args=[user.pk])).status_code == 200
    assert mail.outbox and mail.outbox[-1].to == ["nadia@example.com"]
    client_for(user)
    assert "Ended 1 session" in boss.post(reverse("admin-user-sign-out", args=[user.pk])).json()["detail"]
    assert boss.delete(reverse("admin-user", args=[user.pk])).status_code == 204
    assert not User.objects.filter(pk=user.pk).exists()


def test_users_export_is_csv(boss, user):
    res = boss.get(reverse("admin-users-export"))
    assert res["Content-Type"] == "text/csv" and b"nadia@example.com" in res.content


# ---------- Assessments ----------

def test_assessments_filter_detail_notes_delete(trained, boss, user, patient):
    client_for(user).post(reverse("predict"), patient, format="json")
    ref = Assessment.objects.get().reference
    listed = boss.get(reverse("admin-assessments"), {"q": "nadia"}).json()
    assert listed["count"] == 1 and listed["results"][0]["id"] == ref
    assert boss.get(reverse("admin-assessments"), {"risk": "high", "q": "nobody"}).json()["count"] == 0
    detail = boss.get(reverse("admin-assessment", args=[ref])).json()
    assert detail["inputs"]["age"] == 45 and detail["top_factors"]
    assert boss.patch(reverse("admin-assessment", args=[ref]), {"notes": "Reviewed"}, format="json").json() == {
        "notes": "Reviewed"}
    export = boss.get(reverse("admin-assessments-export"))
    assert ref.encode() in export.content and b"Reviewed" in export.content
    assert boss.delete(reverse("admin-assessment", args=[ref])).status_code == 204
    assert not Assessment.objects.exists()


# ---------- Model ----------

def test_model_card_check_test_and_reload(trained, boss):
    card = boss.get(reverse("admin-model")).json()
    assert card["available"] and card["metadata"]["selected_model"] == "Random Forest"
    assert {f["name"] for f in card["files"]} >= {"heart_disease_inference_pipeline.joblib"}
    check = boss.post(reverse("admin-model-check")).json()
    assert check["ok"] is True and [r["risk_level"] for r in check["results"]] == ["low", "moderate", "high"]
    test = boss.post(reverse("admin-model-test"), {"sample": "moderate"}, format="json").json()
    assert test["result"]["risk_level"] == "moderate"
    assert not Assessment.objects.exists()  # test predictions are never saved
    assert boss.post(reverse("admin-model-test"), {"age": 10, "sex": "M"}, format="json").status_code == 400
    assert boss.post(reverse("admin-model-reload")).json()["detail"] == "Model reloaded."


# ---------- Activity ----------

def test_logins_and_failed_logins_are_recorded(boss):
    anon = APIClient()
    anon.post(reverse("auth-login"), {"email": "boss@example.com", "password": "wrong"}, format="json")
    anon.post(reverse("auth-login"), {"email": "boss@example.com", "password": "Boss-Pass-123"}, format="json")
    kinds = [e["kind"] for e in boss.get(reverse("admin-activity")).json()["results"]]
    assert "login_failed" in kinds and "login" in kinds
    failed = boss.get(reverse("admin-activity"), {"kind": "login_failed"}).json()
    assert failed["count"] == 1 and failed["results"][0]["email"] == "boss@example.com"


# ---------- System, maintenance, backup ----------

def test_system_health(boss):
    body = boss.get(reverse("admin-system")).json()
    names = {c["name"] for c in body["checks"]}
    assert {"Database", "Migrations", "Cache", "Prediction model", "Email", "Debug mode"} <= names
    assert next(c for c in body["checks"] if c["name"] == "Migrations")["status"] == "ok"
    assert body["versions"]["django"] and body["django_admin_url"].endswith("/admin/")


def test_maintenance_tasks(boss):
    tasks = {t["task"] for t in boss.get(reverse("admin-maintenance")).json()}
    assert tasks == {"purge_deleted_profiles", "purge_orphans", "clear_expired_sessions", "purge_old_activity",
                     "clear_cache", "warm_model"}
    res = boss.post(reverse("admin-maintenance-run", args=["purge_orphans"])).json()
    assert res["removed"] >= 1  # the seeded demo profile
    assert boss.post(reverse("admin-maintenance-run", args=["nope"])).status_code == 404
    assert ActivityEvent.objects.filter(kind="maintenance").exists()


def test_backup_has_no_password_hashes(boss, user):
    res = boss.get(reverse("admin-backup"))
    assert "attachment" in res["Content-Disposition"]
    assert b"nadia@example.com" in res.content and b"pbkdf2" not in res.content


# ---------- Site switches ----------

def test_maintenance_mode_blocks_users_but_not_staff(trained, boss, user, patient):
    boss.patch(reverse("admin-settings"), {"maintenance_mode": True, "maintenance_message": "Back at 5pm"},
               format="json")
    regular = client_for(user)
    blocked = regular.post(reverse("predict"), patient, format="json")
    assert blocked.status_code == 503 and blocked.json() == {"detail": "Back at 5pm", "maintenance": True}
    assert regular.get(reverse("auth-me")).status_code == 200  # the app can still show the message
    assert APIClient().get(reverse("site")).json()["maintenance_message"] == "Back at 5pm"
    assert boss.get(reverse("admin-overview")).status_code == 200  # staff keep working
    boss.patch(reverse("admin-settings"), {"maintenance_mode": False}, format="json")
    assert regular.post(reverse("predict"), patient, format="json").status_code == 200


def test_registration_and_predictions_can_be_paused(trained, boss, user, patient):
    boss.patch(reverse("admin-settings"), {"registration_open": False, "predictions_open": False}, format="json")
    anon = APIClient()
    res = anon.post(reverse("auth-register"), {"name": "N", "email": "n@example.com", "password": "Long-Enough-1"},
                    format="json")
    assert res.status_code == 400 and "can't be created" in res.json()["detail"]
    assert client_for(user).post(reverse("predict"), patient, format="json").status_code == 503


def test_announcement_validation_and_public_view(boss):
    assert boss.patch(reverse("admin-settings"), {"announcement_level": "panic"}, format="json").status_code == 400
    boss.patch(reverse("admin-settings"), {"announcement": "New model live", "announcement_level": "info"},
               format="json")
    public = APIClient().get(reverse("site")).json()
    assert public["announcement"] == "New model live" and public["maintenance_message"] == ""
    assert SiteSettings.load().updated_by == "boss@example.com"


# ---------- Console extras: periods, bulk actions, search, notifications, security ----------

def test_overview_periods_kpis_and_funnel(trained, boss, user, patient):
    client_for(user).post(reverse("predict"), patient, format="json")
    for days in (7, 30, 90):
        body = boss.get(reverse("admin-overview"), {"days": days}).json()
        assert len(body["series"]) == days and body["period"]["days"] == days
    assert len(boss.get(reverse("admin-overview"), {"days": 12}).json()["series"]) == 30  # unknown → default
    kpis = body["period"]["kpis"]
    assert kpis["assessments"] == {"current": 1, "previous": 0}
    assert kpis["signups"]["current"] == 2
    funnel = {s["step"]: s["count"] for s in body["funnel"]}
    assert funnel["Signed up"] == 1  # staff are left out
    assert funnel["Ran a first assessment"] == 1 and funnel["Came back for another"] == 0
    counts = [s["count"] for s in body["funnel"]]
    assert counts == sorted(counts, reverse=True)  # every step is a subset of the one before


def test_bulk_actions_respect_the_guards(boss, superuser, user, django_user_model):
    other = django_user_model.objects.create_user(username="o@example.com", email="o@example.com", password="x-Pass-123")
    res = boss.post(reverse("admin-users-bulk"), {"ids": [user.pk, other.pk, superuser.pk], "action": "deactivate"},
                    format="json").json()
    assert res["done"] == 2 and len(res["skipped"]) == 1  # not yourself
    user.refresh_from_db()
    superuser.refresh_from_db()
    assert not user.is_active and superuser.is_active
    assert ActivityEvent.objects.filter(kind="admin", summary__contains="in bulk").exists()
    assert boss.post(reverse("admin-users-bulk"), {"ids": [user.pk], "action": "activate"}, format="json").json()["done"] == 1
    assert boss.post(reverse("admin-users-bulk"), {"ids": [user.pk], "action": "explode"}, format="json").status_code == 400
    assert boss.post(reverse("admin-users-bulk"), {"ids": [], "action": "sign_out"}, format="json").status_code == 400


def test_bulk_needs_staff(user):
    assert client_for(user).post(reverse("admin-users-bulk"), {"ids": [user.pk], "action": "activate"},
                                 format="json").status_code == 403


def test_search_finds_users_and_assessments(trained, boss, user, patient):
    client_for(user).post(reverse("predict"), patient, format="json")
    ref = Assessment.objects.get().reference
    body = boss.get(reverse("admin-search"), {"q": "nadia"}).json()
    assert [u["email"] for u in body["users"]] == ["nadia@example.com"]
    assert body["assessments"][0]["id"] == ref
    assert boss.get(reverse("admin-search"), {"q": ref}).json()["assessments"][0]["id"] == ref
    assert boss.get(reverse("admin-search"), {"q": "n"}).json() == {"users": [], "assessments": []}


def test_notifications_flag_failed_logins_and_site_switches(boss, user):
    for _ in range(10):
        APIClient().post(reverse("auth-login"), {"email": user.email, "password": "wrong"}, format="json")
    SiteSettings.objects.update_or_create(pk=1, defaults={"maintenance_mode": True})
    from django.core.cache import cache
    cache.clear()
    items = boss.get(reverse("admin-notifications")).json()["items"]
    titles = [i["title"] for i in items]
    assert any("10 failed logins" in t for t in titles)
    assert "Maintenance mode is on" in titles
    assert items[0]["level"] == "danger"  # most serious first
    assert len({i["id"] for i in items}) == len(items)


def test_security_groups_failed_logins(boss, user):
    for _ in range(3):
        APIClient().post(reverse("auth-login"), {"email": user.email, "password": "wrong"}, format="json")
    body = boss.get(reverse("admin-security")).json()
    assert body["summary"]["failed_24h"] == 3
    assert body["by_email"][0] == {**body["by_email"][0], "email": user.email, "count": 3}
    assert len(body["trend"]) == 14 and body["trend"][-1]["failed"] == 3
    assert any(s["email"] == "boss@example.com" for s in body["sessions"])
