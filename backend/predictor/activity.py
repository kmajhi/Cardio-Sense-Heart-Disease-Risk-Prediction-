"""The activity log behind the admin console (ActivityEvent).

record() writes one row; the signal handlers below catch logins, logouts and
failed logins wherever they happen (password form, Google/X sign-in, admin).
Logging must never break the request it describes, so failures are swallowed.
"""

import logging

from django.contrib.auth.signals import user_logged_in, user_logged_out, user_login_failed
from django.dispatch import receiver

log = logging.getLogger(__name__)


def client_ip(request):
    """The caller's address; behind a proxy (Render), the first X-Forwarded-For hop."""
    if request is None:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    ip = forwarded.split(",")[0].strip() if forwarded else request.META.get("REMOTE_ADDR")
    return ip or None


def record(kind, summary, *, user=None, email="", request=None, **detail):
    """One activity row. Never pass passwords, tokens or health values in `detail`."""
    from .models import ActivityEvent

    try:
        if user is not None and getattr(user, "is_authenticated", False):
            email = email or user.email or user.username
        else:
            user = None
        ActivityEvent.objects.create(
            kind=kind, summary=str(summary)[:240], user=user, email=str(email)[:254],
            detail=detail, ip=client_ip(request),
        )
    except Exception:  # noqa: BLE001 (the log is secondary to the request)
        log.warning("Couldn't record %s activity", kind, exc_info=True)


@receiver(user_logged_in)
def _logged_in(sender, request, user, **kwargs):
    via = getattr(user, "backend", "") or ""
    social = request is not None and request.path.startswith("/api/connect/")
    record("social_login" if social else "login", f"{user.email or user.username} signed in",
           user=user, request=request, via=via.rsplit(".", 1)[-1])


@receiver(user_logged_out)
def _logged_out(sender, request, user, **kwargs):
    if user is not None:
        record("logout", f"{user.email or user.username} signed out", user=user, request=request)


@receiver(user_login_failed)
def _login_failed(sender, credentials, request=None, **kwargs):
    email = str((credentials or {}).get("username", ""))[:254]
    record("login_failed", f"Failed login for {email or 'unknown'}", email=email, request=request)
