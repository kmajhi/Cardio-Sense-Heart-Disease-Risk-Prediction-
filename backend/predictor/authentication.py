from rest_framework.authentication import SessionAuthentication as DRFSessionAuthentication


class SessionAuthentication(DRFSessionAuthentication):
    """DRF's session auth answers a signed-out request with 403, the same code as a
    CSRF failure. Naming a scheme here makes it 401, so the frontend can tell
    "your session ended, log in again" apart from "not allowed"."""

    def authenticate_header(self, request):
        return 'Session realm="api"'
