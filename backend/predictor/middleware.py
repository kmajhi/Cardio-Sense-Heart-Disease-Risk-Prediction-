"""Maintenance mode (admin console → Site controls).

While it's on, every API call from someone who isn't staff gets 503 with the
admin's message, except what the app needs to show that message and let staff
sign in. The Django admin and the console's own API stay open to staff.
"""

from django.http import JsonResponse

from .models import SiteSettings

OPEN_DURING_MAINTENANCE = ("/api/site/", "/api/auth/me/", "/api/auth/login/", "/api/auth/logout/")


class MaintenanceMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path
        if path.startswith("/api/") and not path.startswith(OPEN_DURING_MAINTENANCE):
            site = SiteSettings.load()
            user = getattr(request, "user", None)
            if site.maintenance_mode and not (user is not None and user.is_authenticated and user.is_staff):
                return JsonResponse({"detail": site.maintenance_message, "maintenance": True}, status=503)
        return self.get_response(request)
