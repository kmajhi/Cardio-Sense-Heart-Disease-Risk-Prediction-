import pytest
from django.contrib.auth import get_user_model
from django.core.management import CommandError, call_command
from django.urls import reverse
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


def test_creates_demo_admin_and_user_that_can_log_in(settings):
    settings.DEBUG = True
    call_command("seed_demo_accounts")

    admin = get_user_model().objects.get(username="admin@example.com")
    user = get_user_model().objects.get(username="sujon@example.com")
    assert admin.is_staff and admin.is_superuser
    assert not user.is_staff and not user.is_superuser

    api = APIClient()
    res = api.post(reverse("auth-login"), {"email": "sujon@example.com", "password": "Sujon123"}, format="json")
    assert res.status_code == 200


def test_rerun_resets_the_password(settings):
    settings.DEBUG = True
    call_command("seed_demo_accounts")
    admin = get_user_model().objects.get(username="admin@example.com")
    admin.set_password("Something-Else-1")
    admin.save()

    call_command("seed_demo_accounts")
    admin.refresh_from_db()
    assert admin.check_password("Admin-Demo-2026")


def test_refuses_when_debug_is_off(settings):
    settings.DEBUG = False
    with pytest.raises(CommandError):
        call_command("seed_demo_accounts")
    assert not get_user_model().objects.filter(username="admin@example.com").exists()
