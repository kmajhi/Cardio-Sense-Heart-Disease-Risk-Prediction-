import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from predictor.models import Assessment, Profile

pytestmark = pytest.mark.django_db

PASSWORD = "Correct-Horse-9"


@pytest.fixture
def anon():
    return APIClient()


def register(api, email="rahim@example.com", name="Rahim Uddin", password=PASSWORD):
    return api.post(reverse("auth-register"), {"name": name, "email": email, "password": password}, format="json")


# ---------- Register / login / logout / me ----------

def test_register_creates_a_signed_in_account_with_a_hashed_password(anon):
    res = register(anon, email=" Rahim@Example.com ")
    assert res.status_code == 201
    assert res.json() == {"name": "Rahim Uddin", "email": "rahim@example.com", "has_password": True, "sign_in_with": [], "is_staff": False, "is_superuser": False}
    assert anon.get(reverse("auth-me")).json()["email"] == "rahim@example.com"

    user = get_user_model().objects.get(username="rahim@example.com")
    assert user.password != PASSWORD and user.check_password(PASSWORD)


def test_register_refuses_a_taken_email_in_any_case(anon, user):
    res = register(anon, email="NADIA@example.com")
    assert res.status_code == 400
    # Same message whatever the reason, so the form can't confirm who has an account.
    assert "couldn't create an account" in res.json()["detail"]
    assert "already exists" not in res.json()["detail"]


@pytest.mark.parametrize(
    "change, message",
    [
        ({"name": "  "}, "name"),
        ({"email": "not-an-email"}, "email"),
        ({"password": "short"}, "too short"),
        ({"password": "password123"}, "too common"),
        ({"password": "rahimuddin-x"}, "too similar"),
    ],
)
def test_register_validation(anon, change, message):
    body = {"name": "Rahim Uddin", "email": "rahim@example.com", "password": PASSWORD, **change}
    res = anon.post(reverse("auth-register"), body, format="json")
    assert res.status_code == 400
    assert message in res.json()["detail"].lower()
    assert not get_user_model().objects.exists()


def test_login_and_logout(anon, user):
    wrong = anon.post(reverse("auth-login"), {"email": user.email, "password": "nope"}, format="json")
    unknown = anon.post(reverse("auth-login"), {"email": "who@example.com", "password": PASSWORD}, format="json")
    # The same answer either way, so the form can't be used to find accounts.
    assert wrong.status_code == unknown.status_code == 400
    assert wrong.json() == unknown.json() == {"detail": "Incorrect email or password."}

    ok = anon.post(reverse("auth-login"), {"email": "Nadia@Example.com", "password": PASSWORD}, format="json")
    assert ok.json() == {"name": "Nadia Rahman", "email": "nadia@example.com", "has_password": True, "sign_in_with": [], "is_staff": False, "is_superuser": False}
    assert anon.get(reverse("auth-me")).status_code == 200

    assert anon.post(reverse("auth-logout")).status_code == 204
    assert anon.get(reverse("auth-me")).status_code == 401


def test_me_sets_the_csrf_cookie(anon):
    res = anon.get(reverse("auth-me"))
    assert res.status_code == 401
    assert "csrftoken" in res.cookies


def test_login_and_register_check_csrf():
    """A hostile page can't sign a visitor into an account it controls."""
    browser = APIClient(enforce_csrf_checks=True)
    assert register(browser).status_code == 403

    token = browser.get(reverse("auth-me")).cookies["csrftoken"].value
    assert browser.post(reverse("auth-register"),
                        {"name": "Rahim Uddin", "email": "rahim@example.com", "password": PASSWORD},
                        format="json", HTTP_X_CSRFTOKEN=token).status_code == 201


def test_login_is_rate_limited(anon, user):
    for _ in range(10):
        anon.post(reverse("auth-login"), {"email": user.email, "password": "guess"}, format="json")
    res = anon.post(reverse("auth-login"), {"email": user.email, "password": PASSWORD}, format="json")
    assert res.status_code == 429


# ---------- Signed out: nothing ----------

@pytest.mark.parametrize(
    "method, name",
    [("post", "predict"), ("get", "history"), ("get", "profile"), ("put", "profile"), ("delete", "profile")],
)
def test_data_endpoints_need_an_account(anon, method, name):
    # 401, not 403: the frontend treats it as "session ended, log in again".
    assert getattr(anon, method)(reverse(name), {}, format="json").status_code == 401


# ---------- Each user sees only their own ----------

def test_a_new_account_starts_empty(anon):
    register(anon)
    assert anon.get(reverse("history")).json() == []
    assert anon.get(reverse("profile")).status_code == 404  # not the seeded demo profile


def test_users_only_see_and_delete_their_own_records(trained, anon, user, patient, profile_body):
    nadia = APIClient()
    nadia.force_login(user)
    nadia.put(reverse("profile"), profile_body, format="json")
    nadia.post(reverse("predict"), patient, format="json")
    record_id = nadia.get(reverse("history")).json()[0]["id"]

    register(anon)  # Rahim
    assert anon.get(reverse("history")).json() == []
    assert anon.get(reverse("profile")).status_code == 404
    assert anon.delete(reverse("history-record", args=[record_id])).status_code == 404

    anon.post(reverse("predict"), {**patient, "age": 70}, format="json")
    assert [r["inputs"]["age"] for r in anon.get(reverse("history")).json()] == [70]
    assert [r["inputs"]["age"] for r in nadia.get(reverse("history")).json()] == [45]
    assert Assessment.objects.count() == 2


def test_records_are_kept_across_sessions(trained, anon, patient):
    register(anon)
    anon.post(reverse("predict"), patient, format="json")
    anon.post(reverse("auth-logout"))
    assert anon.get(reverse("history")).status_code == 401

    anon.post(reverse("auth-login"), {"email": "rahim@example.com", "password": PASSWORD}, format="json")
    assert len(anon.get(reverse("history")).json()) == 1


def test_saving_a_profile_gives_the_user_their_own(anon, user, profile_body):
    register(anon)
    anon.put(reverse("profile"), profile_body, format="json")
    rahim = get_user_model().objects.get(username="rahim@example.com")
    assert Profile.objects.get(user=rahim).full_name == "Rahim Uddin"
    assert not Profile.objects.filter(user=user).exists()
