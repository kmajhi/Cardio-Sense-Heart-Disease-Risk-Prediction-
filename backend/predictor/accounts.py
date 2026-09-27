"""User accounts: POST register / login / logout, GET me.

Django's own users and password hashing, signed in with a session cookie.
The email (lower-cased) is the username. Every other endpoint needs a
signed-in user and only ever sees that user's data (views.py).

CSRF: the browser gets the csrftoken cookie from GET /api/auth/me/ and sends
it back as X-CSRFToken (frontend/src/api/client.js). Register, login and
logout check it even though no one is signed in yet, which stops a hostile
page from signing a visitor into an account it controls.
"""

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

NAME_MAX = 80


def public_user(user):
    """What the frontend knows about the signed-in user."""
    return {"name": user.first_name or user.email, "email": user.email}


def bad_request(detail):
    return Response({"detail": detail}, status=status.HTTP_400_BAD_REQUEST)


class MeView(APIView):
    """GET /api/auth/me/ → { name, email } | 401. Also sets the CSRF cookie."""

    permission_classes = [AllowAny]

    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        if not request.user.is_authenticated:
            return Response({"detail": "Not signed in."}, status=status.HTTP_401_UNAUTHORIZED)
        return Response(public_user(request.user))


@method_decorator(csrf_protect, name="dispatch")
class RegisterView(APIView):
    """POST /api/auth/register/ { name, email, password } → 201 { name, email }, signed in."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        name = str(data.get("name", "")).strip()
        email = str(data.get("email", "")).strip().lower()
        password = str(data.get("password", ""))

        if not name:
            return bad_request("Enter your name.")
        if len(name) > NAME_MAX:
            return bad_request(f"Keep your name under {NAME_MAX} characters.")
        try:
            validate_email(email)
        except ValidationError:
            return bad_request("Enter a valid email address.")

        User = get_user_model()
        if User.objects.filter(username=email).exists():
            return bad_request("An account with this email already exists. Log in instead.")

        user = User(username=email, email=email, first_name=name)
        try:
            validate_password(password, user)  # the AUTH_PASSWORD_VALIDATORS in settings.py
        except ValidationError as err:
            return bad_request(err.messages[0])
        user.set_password(password)
        user.save()

        login(request, user)
        return Response(public_user(user), status=status.HTTP_201_CREATED)


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    """POST /api/auth/login/ { email, password } → { name, email }, signed in."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        email = str(data.get("email", "")).strip().lower()
        password = str(data.get("password", ""))

        user = authenticate(request, username=email, password=password)
        if user is None:
            # One message for both cases, so the form doesn't reveal which emails have accounts.
            return bad_request("Incorrect email or password.")
        login(request, user)  # a new session id, so an old one can't be reused
        return Response(public_user(user))


@method_decorator(csrf_protect, name="dispatch")
class LogoutView(APIView):
    """POST /api/auth/logout/ → 204. Safe to call when already signed out."""

    permission_classes = [AllowAny]

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)
