"""The deployment admin account (manage.py ensure_admin)."""

import pytest
from django.contrib.auth import get_user_model
from django.core.management import CommandError, call_command

pytestmark = pytest.mark.django_db
User = get_user_model()
STRONG = "Kite-Harbour-Lantern-27"


def test_does_nothing_without_variables(monkeypatch):
    monkeypatch.delenv("ADMIN_EMAIL", raising=False)
    monkeypatch.delenv("ADMIN_PASSWORD", raising=False)
    call_command("ensure_admin")
    assert not User.objects.exists()


def test_creates_a_superuser_once_and_keeps_a_changed_password(monkeypatch):
    monkeypatch.setenv("ADMIN_EMAIL", "Owner@Clinic.org")
    monkeypatch.setenv("ADMIN_PASSWORD", STRONG)
    call_command("ensure_admin")
    user = User.objects.get(username="owner@clinic.org")
    assert user.is_staff and user.is_superuser and user.check_password(STRONG)

    user.set_password("Changed-In-The-App-99")
    user.is_staff = False
    user.save()
    call_command("ensure_admin")  # the next deploy
    user.refresh_from_db()
    assert user.is_staff and user.check_password("Changed-In-The-App-99")

    call_command("ensure_admin", reset_password=True)
    user.refresh_from_db()
    assert user.check_password(STRONG)


@pytest.mark.parametrize("email, password, message", [
    ("owner@clinic.org", "", "Set ADMIN_PASSWORD"),
    ("not-an-email", STRONG, "Set ADMIN_EMAIL"),
    ("owner@clinic.org", "short", "12 characters"),
    ("owner@clinic.org", "password1234", "strong enough"),
])
def test_refuses_bad_settings(monkeypatch, email, password, message):
    monkeypatch.setenv("ADMIN_EMAIL", email)
    monkeypatch.setenv("ADMIN_PASSWORD", password)
    with pytest.raises(CommandError, match=message):
        call_command("ensure_admin")
    assert not User.objects.exists()
