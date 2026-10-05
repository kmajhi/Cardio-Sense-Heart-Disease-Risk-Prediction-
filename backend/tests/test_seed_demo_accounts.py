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


def test_creates_a_demo_doctor_who_can_sign_in_to_the_doctor_panel(settings):
    settings.DEBUG = True
    call_command("seed_demo_accounts")
    from predictor.models import DoctorProfile

    d = DoctorProfile.objects.get(user__username="doctor@example.com")
    assert d.is_verified and d.is_active and d.is_available and not d.must_change_password
    assert "TEST" in d.registration_number  # never a real-looking registration
    res = APIClient().post(reverse("doctor-login"), {"identifier": d.doctor_id, "password": "Heart-Review-2026"},
                           format="json")
    assert res.status_code == 200 and res.json()["doctor_id"] == d.doctor_id
    call_command("seed_demo_accounts")  # rerun: same doctor, not a second one
    assert DoctorProfile.objects.count() == 1


def test_no_demo_doctor_when_debug_is_off(settings):
    settings.DEBUG = False
    with pytest.raises(CommandError):
        call_command("seed_demo_accounts")
    from predictor.models import DoctorProfile

    assert not DoctorProfile.objects.exists()
