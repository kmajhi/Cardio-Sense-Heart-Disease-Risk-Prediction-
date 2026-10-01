"""Password change and reset, data export and account deletion (QA L8, M5)."""

import re

import pytest
from django.contrib.auth import get_user_model
from django.core import mail
from django.urls import reverse
from rest_framework.test import APIClient

from predictor.models import Assessment, ConnectionEvent, Profile

pytestmark = pytest.mark.django_db

PASSWORD = "Correct-Horse-9"  # the conftest user's
NEW_PASSWORD = "Brand-New-Secret-42"


@pytest.fixture
def api(user):
    client = APIClient()
    client.force_login(user)
    return client


def test_change_password_keeps_the_session(api, user):
    res = api.post(reverse("auth-password"), {"current_password": PASSWORD, "new_password": NEW_PASSWORD},
                   format="json")
    assert res.status_code == 204
    user.refresh_from_db()
    assert user.check_password(NEW_PASSWORD)
    assert api.get(reverse("auth-me")).status_code == 200  # still signed in


@pytest.mark.parametrize("body, message", [
    ({"current_password": "wrong", "new_password": NEW_PASSWORD}, "current password is incorrect"),
    ({"current_password": PASSWORD, "new_password": "short"}, "too short"),
])
def test_change_password_validation(api, body, message):
    res = api.post(reverse("auth-password"), body, format="json")
    assert res.status_code == 400 and message in res.json()["detail"]


def reset_link():
    body = mail.outbox[-1].body
    uid, token = re.search(r"reset-password\?uid=([\w-]+)&token=([\w-]+)", body).groups()
    return uid, token


def test_password_reset_round_trip(anon, user):
    assert anon.post(reverse("auth-password-reset"), {"email": "NADIA@example.com"}, format="json").status_code == 204
    assert len(mail.outbox) == 1 and mail.outbox[0].to == ["nadia@example.com"]
    uid, token = reset_link()

    confirm = {"uid": uid, "token": token, "password": NEW_PASSWORD}
    assert anon.post(reverse("auth-password-reset-confirm"), confirm, format="json").status_code == 204
    user.refresh_from_db()
    assert user.check_password(NEW_PASSWORD)
    # The link works once.
    again = anon.post(reverse("auth-password-reset-confirm"), {**confirm, "password": "Another-One-77"}, format="json")
    assert again.status_code == 400 and "invalid or has expired" in again.json()["detail"]


def test_password_reset_does_not_reveal_accounts(anon):
    res = anon.post(reverse("auth-password-reset"), {"email": "nobody@example.com"}, format="json")
    assert res.status_code == 204 and mail.outbox == []


def test_password_reset_rejects_a_bad_token(anon, user):
    anon.post(reverse("auth-password-reset"), {"email": user.email}, format="json")
    uid, _ = reset_link()
    res = anon.post(reverse("auth-password-reset-confirm"), {"uid": uid, "token": "nope", "password": NEW_PASSWORD},
                    format="json")
    assert res.status_code == 400


def test_export_has_everything_about_the_user(trained, api, patient, profile_body):
    api.put(reverse("profile"), profile_body, format="json")
    api.post(reverse("predict"), patient, format="json")
    res = api.get(reverse("auth-export"))
    assert res.status_code == 200 and "attachment" in res["Content-Disposition"]
    data = res.json()
    assert data["account"]["email"] == "nadia@example.com"
    assert data["profile"]["full_name"] == "Rahim Uddin"
    assert len(data["assessments"]) == 1


def test_delete_account_removes_everything(trained, api, user, patient, profile_body):
    api.put(reverse("profile"), profile_body, format="json")
    api.post(reverse("predict"), patient, format="json")
    ConnectionEvent.objects.create(provider="x", action="started", profile=Profile.objects.get(user=user))

    assert api.delete(reverse("auth-account"), {"password": "wrong"}, format="json").status_code == 400
    assert api.delete(reverse("auth-account"), {"password": PASSWORD}, format="json").status_code == 204

    assert not get_user_model().objects.filter(pk=user.pk).exists()
    assert not Assessment.objects.filter(user__isnull=False).exists()
    assert not Profile.objects.filter(user__isnull=False).exists()
    assert ConnectionEvent.objects.get().profile is None  # the audit row stays, unlinked
    assert api.get(reverse("history")).status_code == 401  # signed out


def test_account_endpoints_need_an_account(anon):
    assert anon.get(reverse("auth-export")).status_code == 401
    assert anon.delete(reverse("auth-account"), {}, format="json").status_code == 401
    assert anon.post(reverse("auth-password"), {}, format="json").status_code == 401
