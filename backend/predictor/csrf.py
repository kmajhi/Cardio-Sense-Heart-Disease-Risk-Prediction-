"""CSRF failures as JSON the app can explain (settings.CSRF_FAILURE_VIEW).

Django's default is an HTML page, which the React app can only show as
"failed with status 403". The commonest cause in a deployment is the site's
address not being trusted (FRONTEND_URL doesn't match where the app is
served from), so the response says which origin was refused.
"""

from django.conf import settings
from django.http import JsonResponse
from django.views.csrf import csrf_failure as html_csrf_failure


def csrf_failure(request, reason=""):
    if not request.path.startswith("/api/"):
        return html_csrf_failure(request, reason)  # Django admin keeps its own page
    origin = request.META.get("HTTP_ORIGIN", "")
    if origin and origin not in settings.CSRF_TRUSTED_ORIGINS:
        detail = (
            f"The server doesn't accept requests from {origin}. An administrator needs to set "
            "FRONTEND_URL on the API to this site's address."
        )
    else:
        detail = "Your session's security check failed. Refresh the page and try again."
    return JsonResponse({"detail": detail, "code": "csrf_failed"}, status=403)
