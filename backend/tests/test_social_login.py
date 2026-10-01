"""Sign in / sign up with Google or X (predictor/social_login.py)."""

from urllib.parse import parse_qs, urlparse

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from predictor import connections
from predictor.models import ConnectionEvent, SocialAccount

pytestmark = pytest.mark.django_db

FRONTEND = "http://app.test"
GOOGLE_ME = {"sub": "g-123", "email": "Faisal.Ahmed@Gmail.com", "email_verified": True, "name": "Faisal Ahmed"}
X_ME = {"data": {"id": "x-987", "username": "faisal", "name": "Faisal A."}}


@pytest.fixture(autouse=True)
def oauth_settings(settings):
    settings.FRONTEND_URL = FRONTEND
    settings.OAUTH_REDIRECT_BASE = FRONTEND
    settings.OAUTH_CLIENTS = {
        "gmail": {"client_id": "g-id", "client_secret": "g-secret"},
        "x": {"client_id": "x-id", "client_secret": "x-secret"},
        "facebook": {"client_id": "", "client_secret": ""},
        "linkedin": {"client_id": "", "client_secret": ""},
    }


@pytest.fixture
def identity(monkeypatch):
    """Fakes the providers' token and identity endpoints; `identity.me` is what they return."""

    class Fake:
        me = {"gmail": GOOGLE_ME, "x": X_ME}
        token_calls = []

        def __call__(self, url, *, data=None, headers=None):
            if data is not None:
                self.token_calls.append(data)
                return {"access_token": "tok"}
            return self.me["gmail" if "google" in url else "x"]

    fake = Fake()
    monkeypatch.setattr(connections, "fetch_json", fake)
    monkeypatch.setattr("predictor.social_login.fetch_json", fake)
    return fake


def sign_in(client, provider, **callback_params):
    """Start the sign-in, then come back from the provider with that state."""
    start = client.get(reverse("auth-oauth-start", args=[provider]))
    query = parse_qs(urlparse(start["Location"]).query)
    params = {"state": query["state"][0], "code": "the-code", **callback_params}
    return start, client.get(reverse("connect-callback", args=[provider]), params)


def landed(res):
    url = urlparse(res["Location"])
    return f"{url.scheme}://{url.netloc}{url.path}", {k: v[0] for k, v in parse_qs(url.query).items()}


def me(client):
    return client.get(reverse("auth-me"))


def test_start_asks_google_for_email_and_name_with_pkce():
    client = APIClient()
    res = client.get(reverse("auth-oauth-start", args=["gmail"]))
    url = urlparse(res["Location"])
    query = parse_qs(url.query)
    assert url.netloc == "accounts.google.com"
    assert query["scope"] == ["openid email profile"]
    assert query["redirect_uri"] == [f"{FRONTEND}/api/connect/gmail/callback/"]  # the already-registered URL
    assert query["code_challenge_method"] == ["S256"]


def test_new_google_user_gets_an_account_and_is_signed_in(identity):
    client = APIClient()
    _, res = sign_in(client, "gmail")
    assert landed(res)[0] == f"{FRONTEND}/dashboard"

    body = me(client).json()
    assert body["email"] == "faisal.ahmed@gmail.com" and body["name"] == "Faisal Ahmed"
    assert body["has_password"] is False and body["sign_in_with"] == ["gmail"]
    user = get_user_model().objects.get(username="faisal.ahmed@gmail.com")
    assert not user.has_usable_password()
    assert SocialAccount.objects.get(user=user).uid == "g-123"
    assert not ConnectionEvent.objects.exists()  # sign-in isn't account linking


def test_returning_google_user_signs_in_to_the_same_account(identity):
    sign_in(APIClient(), "gmail")
    identity.me = {**identity.me, "gmail": {**GOOGLE_ME, "email": "new-address@gmail.com"}}  # email changed
    client = APIClient()
    _, res = sign_in(client, "gmail")
    assert landed(res)[0] == f"{FRONTEND}/dashboard"
    assert me(client).json()["email"] == "faisal.ahmed@gmail.com"  # matched on Google's id, not the email
    assert get_user_model().objects.count() == 1


def test_google_email_of_a_password_account_is_not_linked(identity, django_user_model):
    django_user_model.objects.create_user(username="faisal.ahmed@gmail.com", email="faisal.ahmed@gmail.com",
                                          password="Someone-Elses-1")
    client = APIClient()
    _, res = sign_in(client, "gmail")
    page, query = landed(res)
    assert page == f"{FRONTEND}/" and query == {"auth": "login", "auth_error": "email_exists", "provider": "gmail"}
    assert me(client).status_code == 401
    assert not SocialAccount.objects.exists()


def test_unverified_google_email_is_refused(identity):
    identity.me = {**identity.me, "gmail": {**GOOGLE_ME, "email_verified": False}}
    client = APIClient()
    _, res = sign_in(client, "gmail")
    assert landed(res)[1]["auth_error"] == "no_email"
    assert me(client).status_code == 401


def test_x_sign_in_creates_an_account_without_email(identity):
    client = APIClient()
    _, res = sign_in(client, "x")
    assert landed(res)[0] == f"{FRONTEND}/dashboard"
    body = me(client).json()
    assert body["name"] == "Faisal A." and body["email"] == "" and body["sign_in_with"] == ["x"]
    assert get_user_model().objects.get().username == "x:x-987"


@pytest.mark.parametrize("params, code", [
    ({"state": "forged"}, "expired"),
    ({"error": "access_denied"}, "denied"),
    ({"code": ""}, "failed"),
])
def test_bad_callbacks_are_refused(identity, params, code):
    client = APIClient()
    _, res = sign_in(client, "gmail", **params)
    assert landed(res)[1]["auth_error"] == code
    assert me(client).status_code == 401


def test_a_replayed_callback_signs_nobody_in(identity):
    client = APIClient()
    start, _ = sign_in(client, "gmail")
    client.post(reverse("auth-logout"))
    state = parse_qs(urlparse(start["Location"]).query)["state"][0]
    res = client.get(reverse("connect-callback", args=["gmail"]), {"state": state, "code": "the-code"})
    assert me(client).status_code == 401
    assert "connect_error" in res["Location"]  # no sign-in pending: handled as a stale connect callback


def test_provider_failure_goes_back_to_login(identity, monkeypatch):
    def broken(url, *, data=None, headers=None):
        raise connections.ConnectError("failed", "token endpoint down")

    monkeypatch.setattr("predictor.social_login.exchange_code", lambda *a: broken(""))
    client = APIClient()
    _, res = sign_in(client, "gmail")
    assert landed(res)[1]["auth_error"] == "failed"


def test_unconfigured_provider_and_unknown_provider(settings):
    settings.OAUTH_CLIENTS = {**settings.OAUTH_CLIENTS, "x": {"client_id": "", "client_secret": ""}}
    client = APIClient()
    res = client.get(reverse("auth-oauth-start", args=["x"]))
    assert landed(res)[1] == {"auth": "login", "auth_error": "not_configured", "provider": "x"}
    assert client.get(reverse("auth-oauth-start", args=["facebook"])).status_code == 404


def test_already_signed_in_goes_straight_to_the_dashboard(user):
    client = APIClient()
    client.force_login(user)
    assert landed(client.get(reverse("auth-oauth-start", args=["gmail"])))[0] == f"{FRONTEND}/dashboard"


def test_password_less_account_can_set_a_password_and_delete_itself(identity):
    client = APIClient()
    sign_in(client, "gmail")
    res = client.post(reverse("auth-password"), {"new_password": "Now-I-Have-One-42"}, format="json")
    assert res.status_code == 204
    assert me(client).json()["has_password"] is True

    other = APIClient()
    identity.me = {**identity.me, "x": {"data": {"id": "x-2", "username": "b", "name": "B"}}}
    sign_in(other, "x")
    assert other.delete(reverse("auth-account"), {}, format="json").status_code == 400
    assert other.delete(reverse("auth-account"), {"confirm": "DELETE"}, format="json").status_code == 204
    assert not get_user_model().objects.filter(username="x:x-2").exists()
    assert not SocialAccount.objects.filter(uid="x-2").exists()


def test_connect_flow_still_links_accounts(identity, user):
    """The shared callback still serves the Profile page's account linking."""
    from predictor.models import Profile

    Profile.objects.update(user=user)
    client = APIClient()
    client.force_login(user)
    start = client.get(reverse("connect-start", args=["gmail"]))
    state = parse_qs(urlparse(start["Location"]).query)["state"][0]
    res = client.get(reverse("connect-callback", args=["gmail"]), {"state": state, "code": "c"})
    assert "connected=gmail" in res["Location"]
