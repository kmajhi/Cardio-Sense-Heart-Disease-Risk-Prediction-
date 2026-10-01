"""Sign in, or sign up, with Google or X.

GET /api/auth/oauth/<gmail|x>/start/ sends the browser to the provider. It comes
back to the same callback URL the Profile page's account linking uses
(/api/connect/<provider>/callback/, see connections.py), so nothing new has to
be registered with the provider. The session remembers that this round trip is
a sign-in, and connections.callback hands it to finish() below.

Who the person is comes from the provider's stable id (Google's `sub`, X's user
id), kept in SocialAccount, never from the email or handle:

- A known id signs in to its account.
- A new Google id creates an account from its verified email. If a password
  account already uses that email, nothing is linked: they're asked to log in
  with the password instead. Registration doesn't verify emails, so linking
  would let whoever registered the address first into the Google user's account.
- A new X id creates an account named after the X profile, with no email (X
  doesn't share one by default).

Accounts made this way have no password (set_unusable_password). They can set
one from the Profile page, and they confirm deleting the account by typing
DELETE (accounts.py).

The flow always ends with a redirect: to FRONTEND_URL/dashboard when signed in,
or to FRONTEND_URL/?auth=login&auth_error=<code>&provider=<provider>, which the
login dialog turns into a message.
"""

import logging
import secrets
import time
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth import get_user_model, login
from django.db import IntegrityError, transaction
from django.http import Http404, HttpResponseRedirect
from django.utils import timezone
from django.views.decorators.http import require_GET

from .connections import PROVIDERS, STATE_TTL_SECONDS, ConnectError, authorize_redirect, client, exchange_code, fetch_json
from .models import SocialAccount

log = logging.getLogger(__name__)

# Providers offered on the login page, and what each sign-in asks for.
# Google: "profile" adds the person's name to the email.
LOGIN_SCOPES = {"gmail": "openid email profile", "x": None}
NAME_MAX = 80


class LoginRefused(Exception):
    """A sign-in that can't go ahead; `code` goes to the login dialog."""

    def __init__(self, code, detail=""):
        super().__init__(detail or code)
        self.code = code


def back_to_login(code, provider):
    query = urlencode({"auth": "login", "auth_error": code, "provider": provider})
    return HttpResponseRedirect(f"{settings.FRONTEND_URL}/?{query}")


def signed_in():
    return HttpResponseRedirect(f"{settings.FRONTEND_URL}/dashboard")


@require_GET
def start(request, provider):
    """GET /api/auth/oauth/<provider>/start/ → 302 to the provider's sign-in page."""
    if provider not in LOGIN_SCOPES:
        raise Http404
    if request.user.is_authenticated:
        return signed_in()
    if client(provider) is None:
        return back_to_login("not_configured", provider)
    return authorize_redirect(request, provider, purpose="login", scope=LOGIN_SCOPES[provider])


def identity(provider, me):
    """The provider's identity response → (uid, email or None, email verified, display name)."""
    if provider == "gmail":
        email = (me.get("email") or "").strip().lower() or None
        verified = me.get("email_verified") in (True, "true")
        return me.get("sub"), email, verified, me.get("name") or email or ""
    data = me.get("data") or {}
    username = data.get("username")
    return data.get("id"), None, False, data.get("name") or (f"@{username}" if username else "")


def account_for(provider, uid, email, verified, name):
    """The user this identity signs in as: an existing one, or a new account."""
    known = SocialAccount.objects.select_related("user").filter(provider=provider, uid=uid).first()
    if known:
        if not known.user.is_active:
            raise LoginRefused("failed", "account is deactivated")
        known.last_login_at = timezone.now()
        known.save(update_fields=["last_login_at"])
        return known.user

    User = get_user_model()
    if provider == "gmail":
        if not (email and verified):
            raise LoginRefused("no_email", "Google returned no verified email")
        if User.objects.filter(username=email).exists() or User.objects.filter(email__iexact=email).exists():
            raise LoginRefused("email_exists", "a password account already uses this email")
        user = User(username=email, email=email, first_name=name[:NAME_MAX])
        handle = email
    else:
        user = User(username=f"x:{uid}", email="", first_name=name[:NAME_MAX])
        handle = name

    user.set_unusable_password()
    try:
        with transaction.atomic():
            user.save()
            SocialAccount.objects.create(
                user=user, provider=provider, uid=uid, handle=handle[:150], last_login_at=timezone.now())
    except IntegrityError:
        # The same identity finished signing up in another tab a moment ago.
        return SocialAccount.objects.select_related("user").get(provider=provider, uid=uid).user
    log.info("New account created with %s sign-in", provider)
    return user


def finish(request, provider, pending):
    """The provider's callback for a sign-in (dispatched from connections.callback)."""
    fresh = time.time() - pending.get("at", 0) < STATE_TTL_SECONDS
    if not fresh or pending.get("provider") != provider or not secrets.compare_digest(
        pending.get("state", ""), request.GET.get("state", "")
    ):
        return back_to_login("expired", provider)
    if request.GET.get("error"):  # e.g. access_denied: they pressed Cancel
        return back_to_login("denied", provider)
    if not request.GET.get("code"):
        return back_to_login("failed", provider)

    try:
        token = exchange_code(provider, request.GET["code"], pending["verifier"])
        uid, email, verified, name = identity(provider, fetch_json(
            PROVIDERS[provider]["identity_url"], headers={"Authorization": f"Bearer {token}"}))
        if not uid:
            raise LoginRefused("failed", "identity response had no id")
        user = account_for(provider, str(uid), email, verified, name)
    except (ConnectError, LoginRefused) as err:
        log.warning("Sign-in with %s refused: %s", provider, err)
        return back_to_login(err.code, provider)

    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    return signed_in()
