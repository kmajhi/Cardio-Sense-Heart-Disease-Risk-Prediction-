from urllib.parse import parse_qs, urlparse

import pytest
from django.urls import reverse

from predictor import connections
from predictor.models import ConnectionEvent, Profile

pytestmark = pytest.mark.django_db

FRONTEND = "http://app.test"


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


@pytest.fixture(autouse=True)
def users_profile(user):
    """Give the seeded demo profile to the signed-in user, so they have one to link to."""
    Profile.objects.update(user=user)


@pytest.fixture
def provider_calls(monkeypatch):
    """Fakes the provider's token and identity endpoints; records what was sent."""
    calls = []

    def fake(url, *, data=None, headers=None):
        calls.append({"url": url, "data": data, "headers": headers or {}})
        if data is not None:
            return {"access_token": "tok"}
        if "google" in url:
            return {"email": "nadia@gmail.com"}
        return {"data": {"username": "nadia"}}

    monkeypatch.setattr(connections, "fetch_json", fake)
    return calls


def start(client, provider):
    res = client.get(reverse("connect-start", args=[provider]))
    return res, parse_qs(urlparse(res["Location"]).query)


def expire_deleted_profiles():
    """Move every soft-deleted profile past its undo window."""
    from datetime import timedelta

    from django.utils import timezone

    from predictor.profiles import UNDO_SECONDS

    Profile.objects.filter(deleted_at__isnull=False).update(
        deleted_at=timezone.now() - timedelta(seconds=UNDO_SECONDS + 1))


def landed(res):
    """The query the flow redirected back to /profile with."""
    url = urlparse(res["Location"])
    assert f"{url.scheme}://{url.netloc}{url.path}" == f"{FRONTEND}/profile"
    return {k: v[0] for k, v in parse_qs(url.query).items()}


def test_providers_lists_which_are_set_up(client):
    assert client.get(reverse("connect-providers")).json() == {
        "gmail": True, "x": True, "facebook": False, "linkedin": False,
    }


def test_start_redirects_to_the_provider_with_state_and_pkce(client):
    res, query = start(client, "gmail")
    assert res.status_code == 302
    assert res["Location"].startswith("https://accounts.google.com/o/oauth2/v2/auth?")
    assert query["client_id"] == ["g-id"]
    assert query["redirect_uri"] == [f"{FRONTEND}/api/connect/gmail/callback/"]
    assert query["code_challenge_method"] == ["S256"]
    assert query["state"][0] == client.session["oauth"]["state"]


def test_full_round_trip_links_the_account(client, provider_calls):
    _, query = start(client, "gmail")
    res = client.get(reverse("connect-callback", args=["gmail"]), {"code": "abc", "state": query["state"][0]})

    assert landed(res) == {"connected": "gmail"}
    link = Profile.objects.get().connections["gmail"]
    assert link["handle"] == "nadia@gmail.com" and link["connected_at"]
    token_call = provider_calls[0]
    assert token_call["data"]["code"] == "abc" and token_call["data"]["client_secret"] == "g-secret"
    assert token_call["data"]["code_verifier"]  # PKCE
    assert "tok" not in str(Profile.objects.get().connections)  # tokens are never stored


def test_x_uses_basic_auth_and_stores_the_username(client, provider_calls):
    _, query = start(client, "x")
    client.get(reverse("connect-callback", args=["x"]), {"code": "abc", "state": query["state"][0]})
    assert provider_calls[0]["headers"]["Authorization"].startswith("Basic ")
    assert "client_secret" not in provider_calls[0]["data"]
    assert Profile.objects.get().connections["x"]["handle"] == "@nadia"


def test_wrong_or_replayed_state_is_refused(client, provider_calls):
    _, query = start(client, "gmail")
    bad = client.get(reverse("connect-callback", args=["gmail"]), {"code": "abc", "state": "forged"})
    assert landed(bad)["connect_error"] == "expired"
    # The pending state was used up by that attempt, so the real one can't be replayed either.
    again = client.get(reverse("connect-callback", args=["gmail"]), {"code": "abc", "state": query["state"][0]})
    assert landed(again)["connect_error"] == "expired"
    assert provider_calls == [] and "gmail" not in Profile.objects.get().connections


def test_user_cancelling_at_the_provider(client):
    _, query = start(client, "gmail")
    res = client.get(reverse("connect-callback", args=["gmail"]), {"error": "access_denied", "state": query["state"][0]})
    assert landed(res)["connect_error"] == "denied"


def test_provider_failure_is_reported_not_raised(client, monkeypatch):
    def broken(*args, **kwargs):
        raise connections.ConnectError("failed", "invalid_client")

    monkeypatch.setattr(connections, "fetch_json", broken)
    _, query = start(client, "gmail")
    res = client.get(reverse("connect-callback", args=["gmail"]), {"code": "abc", "state": query["state"][0]})
    assert landed(res)["connect_error"] == "failed"


def test_unconfigured_provider_and_missing_profile(client):
    assert landed(client.get(reverse("connect-start", args=["facebook"])))["connect_error"] == "not_configured"
    Profile.objects.all().delete()
    assert landed(client.get(reverse("connect-start", args=["gmail"])))["connect_error"] == "no_profile"


def test_unknown_provider_is_404(client):
    assert client.get(reverse("connect-start", args=["myspace"])).status_code == 404


# ---------- Audit log ----------

def actions():
    return list(ConnectionEvent.objects.order_by("created_at", "id").values_list("action", flat=True))


def test_a_successful_link_is_logged_start_to_finish(client, provider_calls):
    _, query = start(client, "gmail")
    client.get(reverse("connect-callback", args=["gmail"]), {"code": "abc", "state": query["state"][0]})
    assert actions() == ["started", "linked"]
    linked = ConnectionEvent.objects.get(action="linked")
    assert linked.handle == "nadia@gmail.com" and linked.profile == Profile.objects.get()


def test_failures_are_logged_with_a_reason_but_no_code(client, monkeypatch):
    def broken(*args, **kwargs):
        raise connections.ConnectError("failed", "invalid_client")

    monkeypatch.setattr(connections, "fetch_json", broken)
    _, query = start(client, "gmail")
    client.get(reverse("connect-callback", args=["gmail"]), {"code": "SECRET-CODE", "state": query["state"][0]})
    failed = ConnectionEvent.objects.get(action="failed")
    assert "invalid_client" in failed.detail and "SECRET-CODE" not in failed.detail


def test_cancel_and_forged_state_are_logged(client):
    _, query = start(client, "gmail")
    client.get(reverse("connect-callback", args=["gmail"]), {"error": "access_denied", "state": query["state"][0]})
    start(client, "gmail")
    client.get(reverse("connect-callback", args=["gmail"]), {"code": "abc", "state": "forged"})
    assert actions() == ["started", "cancelled", "started", "expired"]
    assert "forged" in ConnectionEvent.objects.get(action="expired").detail


# ---------- Profile saves can't fake a link ----------

def linked_profile():
    profile = Profile.objects.get()
    profile.connections = {"gmail": {"handle": "real@gmail.com", "connected_at": "2026-01-01T00:00:00Z"}}
    profile.save()
    return client_body(profile)


def client_body(profile):
    from predictor.serializers import ProfileSerializer
    return ProfileSerializer(profile).data


def test_profile_save_cannot_add_or_alter_a_link(client):
    body = linked_profile()
    body["connections"] = {
        "gmail": {"handle": "attacker@gmail.com", "connected_at": "2020-01-01T00:00:00Z"},
        "x": {"handle": "@fake", "connected_at": "2020-01-01T00:00:00Z"},
    }
    saved = client.put(reverse("profile"), body, content_type="application/json").json()
    assert saved["connections"] == {"gmail": {"handle": "real@gmail.com", "connected_at": "2026-01-01T00:00:00Z"}}


def test_disconnecting_is_logged_and_omitting_the_field_keeps_links(client):
    body = linked_profile()
    kept = client.put(reverse("profile"), {k: v for k, v in body.items() if k != "connections"},
                      content_type="application/json").json()
    assert "gmail" in kept["connections"] and actions() == []

    client.put(reverse("profile"), {**body, "connections": {}}, content_type="application/json")
    assert Profile.objects.get().connections == {}
    event = ConnectionEvent.objects.get()
    assert (event.action, event.handle) == ("disconnected", "real@gmail.com")


def test_deleting_the_profile_logs_its_links_once_purged(client):
    linked_profile()
    client.delete(reverse("profile"))
    assert not ConnectionEvent.objects.exists()  # still restorable: nothing unlinked yet

    expire_deleted_profiles()
    assert client.get(reverse("profile")).status_code == 404
    event = ConnectionEvent.objects.get()
    assert event.action == "disconnected" and event.detail == "Profile deleted" and event.profile is None


def test_undoing_a_delete_keeps_the_links(client):
    linked_profile()
    body = client.get(reverse("profile")).json()
    client.delete(reverse("profile"))
    assert client.get(reverse("profile")).status_code == 404

    restored = client.put(reverse("profile"), body, content_type="application/json").json()
    assert "gmail" in restored["connections"]
    assert not ConnectionEvent.objects.exists()


def test_signed_out_start_goes_to_login_and_logs_nothing(anon):
    res = anon.get(reverse("connect-start", args=["x"]))
    url = urlparse(res["Location"])
    assert f"{url.scheme}://{url.netloc}{url.path}" == f"{FRONTEND}/"
    assert parse_qs(url.query) == {"auth": ["login"], "next": ["/profile"]}
    anon.get(reverse("connect-callback", args=["x"]), {"state": "forged", "code": "c"})
    assert not ConnectionEvent.objects.exists()


# ---------- Admin and logs ----------

def test_audit_log_admin_is_read_only(client, provider_calls, admin_client):
    _, query = start(client, "gmail")
    client.get(reverse("connect-callback", args=["gmail"]), {"code": "abc", "state": query["state"][0]})
    event = ConnectionEvent.objects.get(action="linked")
    assert admin_client.get(reverse("admin:predictor_connectionevent_changelist")).status_code == 200
    assert admin_client.get(reverse("admin:predictor_connectionevent_change", args=[event.pk])).status_code == 200
    assert admin_client.get(reverse("admin:predictor_connectionevent_add")).status_code == 403
    export = admin_client.post(reverse("admin:predictor_connectionevent_changelist"),
                               {"action": "export_csv", "_selected_action": [event.pk]})
    assert b"nadia@gmail.com" in export.content


def test_request_log_hides_codes_and_states():
    import logging

    from predictor.logfilters import RedactOAuthParams

    rec = logging.LogRecord("django.server", logging.INFO, "", 0, '"%s" %s %s',
                            ("GET /api/connect/gmail/callback/?state=S3cr3t&iss=x&code=4%2F0AXl HTTP/1.1", 302, 0), None)
    RedactOAuthParams().filter(rec)
    line = rec.getMessage()
    assert "S3cr3t" not in line and "4%2F0AXl" not in line
    assert "state=[hidden]" in line and "code=[hidden]" in line and "iss=x" in line
