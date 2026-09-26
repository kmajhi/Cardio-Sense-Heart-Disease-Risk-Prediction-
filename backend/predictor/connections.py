"""Linked accounts: real OAuth 2.0 sign-in with Google (Gmail), X, Facebook and LinkedIn.

The browser goes to /api/connect/<provider>/start/, is sent to the provider's
own "authorize" page, and comes back to /api/connect/<provider>/callback/.
The code is swapped for an access token here (the app secret never reaches
the browser), used once to read who the account is, and then dropped: only the
handle and the link time are kept, in Profile.connections. Nothing is posted
or sent on the user's behalf, so no token needs storing.

Every attempt and its outcome is written to ConnectionEvent (the audit log in
the admin), without tokens or codes.

Each step is guarded by a one-time random `state` kept in the session (and by
PKCE where the provider supports it), so a callback can't be forged or replayed. The flow always ends with a
redirect to FRONTEND_URL/profile with ?connected=<provider> or
?connect_error=<code>; the frontend turns the code into a message.
"""

import base64
import hashlib
import json
import logging
import secrets
import time
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings
from django.http import Http404, HttpResponseRedirect, JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET

from .models import ConnectionEvent, Profile

log = logging.getLogger(__name__)

STATE_TTL_SECONDS = 600
HANDLE_MAX = 80

PROVIDERS = {
    # "Gmail" in the app is a Google account; OpenID Connect gives the address.
    "gmail": {
        "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "scope": "openid email",
        "pkce": True,
        "extra": {"prompt": "select_account"},
        "identity_url": "https://openidconnect.googleapis.com/v1/userinfo",
        "handle": lambda me: me.get("email"),
    },
    # X only issues OAuth 2.0 user tokens with PKCE; tweet.read is required for /users/me.
    "x": {
        "authorize_url": "https://x.com/i/oauth2/authorize",
        "token_url": "https://api.x.com/2/oauth2/token",
        "token_auth": "basic",
        "pkce": True,
        "scope": "users.read tweet.read",
        "identity_url": "https://api.x.com/2/users/me",
        "handle": lambda me: "@" + me["data"]["username"] if me.get("data", {}).get("username") else None,
    },
    # Unversioned Graph URLs use the app's default API version (set in the Meta app dashboard).
    "facebook": {
        "authorize_url": "https://www.facebook.com/dialog/oauth",
        "token_url": "https://graph.facebook.com/oauth/access_token",
        "scope": "public_profile",
        "identity_url": "https://graph.facebook.com/me?fields=name",
        "handle": lambda me: me.get("name"),
    },
    # "Sign In with LinkedIn using OpenID Connect" product.
    "linkedin": {
        "authorize_url": "https://www.linkedin.com/oauth/v2/authorization",
        "token_url": "https://www.linkedin.com/oauth/v2/accessToken",
        "scope": "openid profile email",
        "identity_url": "https://api.linkedin.com/v2/userinfo",
        "handle": lambda me: me.get("name") or me.get("email"),
    },
}


class ConnectError(Exception):
    """The provider refused or returned something unusable; `code` goes to the frontend."""

    def __init__(self, code, detail=""):
        super().__init__(detail or code)
        self.code = code


def client(provider):
    creds = settings.OAUTH_CLIENTS.get(provider, {})
    return creds if creds.get("client_id") and creds.get("client_secret") else None


def callback_url(provider):
    return f"{settings.OAUTH_REDIRECT_BASE}/api/connect/{provider}/callback/"


def back_to_profile(**params):
    return HttpResponseRedirect(f"{settings.FRONTEND_URL}/profile?{urlencode(params)}")


def pkce_challenge(verifier):
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def fetch_json(url, *, data=None, headers=None):
    body = urlencode(data).encode() if data is not None else None
    req = Request(url, data=body, headers={"Accept": "application/json", **(headers or {})})
    try:
        with urlopen(req, timeout=10) as res:
            return json.loads(res.read().decode("utf-8"))
    except (URLError, ValueError, TimeoutError) as err:
        # HTTPError is a URLError; its body names the problem (bad secret, wrong callback URL...).
        detail = getattr(err, "read", lambda: b"")()[:300]
        raise ConnectError("failed", f"{url}: {err} {detail!r}") from None


def exchange_code(provider, code, verifier):
    conf, creds = PROVIDERS[provider], client(provider)
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": callback_url(provider),
        "client_id": creds["client_id"],
    }
    if conf.get("pkce"):
        data["code_verifier"] = verifier
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    if conf.get("token_auth") == "basic":
        pair = f"{creds['client_id']}:{creds['client_secret']}".encode()
        headers["Authorization"] = "Basic " + base64.b64encode(pair).decode("ascii")
    else:
        data["client_secret"] = creds["client_secret"]
    token = fetch_json(conf["token_url"], data=data, headers=headers).get("access_token")
    if not token:
        raise ConnectError("failed", f"{provider}: no access_token in the token response")
    return token


def identify(provider, token):
    me = fetch_json(PROVIDERS[provider]["identity_url"], headers={"Authorization": f"Bearer {token}"})
    try:
        handle = PROVIDERS[provider]["handle"](me)
    except (KeyError, TypeError):
        handle = None
    if not handle:
        raise ConnectError("failed", f"{provider}: identity response had no usable name")
    return str(handle)[:HANDLE_MAX]


def current_profile():
    return Profile.objects.filter(user__isnull=True).first()


def record(provider, action, *, profile=None, handle="", detail=""):
    """One audit-log row. Never pass tokens, codes or secrets in `detail`."""
    ConnectionEvent.objects.create(
        provider=provider, action=action, profile=profile, handle=handle[:80], detail=str(detail)[:300])


# Error code for the frontend → audit-log action.
ERROR_ACTIONS = {"denied": "cancelled"}


def fail(provider, code, *, profile=None, detail=""):
    """Log the failed attempt and send the user back to /profile with the error code."""
    record(provider, ERROR_ACTIONS.get(code, code), profile=profile, detail=detail)
    return back_to_profile(connect_error=code, provider=provider)


@require_GET
def providers(request):
    """GET /api/connect/ → { provider: true | false } (false = app keys not set on the server)."""
    return JsonResponse({p: client(p) is not None for p in PROVIDERS})


@require_GET
def start(request, provider):
    """GET /api/connect/<provider>/start/ → 302 to the provider's authorize page."""
    if provider not in PROVIDERS:
        raise Http404
    if client(provider) is None:
        return fail(provider, "not_configured", detail="Client ID or secret missing on the server")
    profile = current_profile()
    if profile is None:
        return fail(provider, "no_profile")

    state, verifier = secrets.token_urlsafe(32), secrets.token_urlsafe(64)
    request.session["oauth"] = {"provider": provider, "state": state, "verifier": verifier, "at": time.time()}

    conf = PROVIDERS[provider]
    query = {
        "response_type": "code",
        "client_id": client(provider)["client_id"],
        "redirect_uri": callback_url(provider),
        "scope": conf["scope"],
        "state": state,
        **conf.get("extra", {}),
    }
    if conf.get("pkce"):
        query.update(code_challenge=pkce_challenge(verifier), code_challenge_method="S256")
    record(provider, "started", profile=profile)
    return HttpResponseRedirect(f"{conf['authorize_url']}?{urlencode(query)}")


@require_GET
def callback(request, provider):
    """GET /api/connect/<provider>/callback/?code&state → link it, then 302 back to /profile."""
    if provider not in PROVIDERS:
        raise Http404
    pending = request.session.pop("oauth", None)  # one-time: a replayed callback finds nothing

    profile = current_profile()

    fresh = pending and time.time() - pending["at"] < STATE_TTL_SECONDS
    state = request.GET.get("state", "")
    if not pending:
        return fail(provider, "expired", profile=profile, detail="No sign-in pending (replayed or new browser session)")
    if not fresh:
        return fail(provider, "expired", profile=profile, detail=f"Took over {STATE_TTL_SECONDS // 60} minutes")
    if pending["provider"] != provider or not secrets.compare_digest(pending["state"], state):
        return fail(provider, "expired", profile=profile, detail="State didn't match: possible forged callback")
    if request.GET.get("error"):  # e.g. access_denied: the user pressed Cancel
        return fail(provider, "denied", profile=profile, detail=request.GET["error"][:60])
    if not request.GET.get("code"):
        return fail(provider, "failed", profile=profile, detail="Callback had no code")

    try:
        token = exchange_code(provider, request.GET["code"], pending["verifier"])
        handle = identify(provider, token)
    except ConnectError as err:
        log.warning("Linking %s failed: %s", provider, err)
        return fail(provider, err.code, profile=profile, detail=str(err))

    if profile is None:
        return fail(provider, "no_profile")
    profile.connections = {
        **(profile.connections or {}),
        provider: {"handle": handle, "connected_at": timezone.now().isoformat()},
    }
    profile.save(update_fields=["connections", "updated_at"])
    record(provider, "linked", profile=profile, handle=handle)
    return back_to_profile(connected=provider)
