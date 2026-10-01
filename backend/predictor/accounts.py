"""User accounts: register / login / logout / me, password change and reset,
and the user's own data rights (export everything, delete the account).

Django's own users and password hashing, signed in with a session cookie.
The email (lower-cased) is the username. Every other endpoint needs a
signed-in user and only ever sees that user's data (views.py).

CSRF: the browser gets the csrftoken cookie from GET /api/auth/me/ and sends
it back as X-CSRFToken (frontend/src/api/client.js). Register, login and
logout check it even though no one is signed in yet, which stops a hostile
page from signing a visitor into an account it controls.
"""

import logging

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model, login, logout, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .activity import record
from .models import Assessment, SiteSettings
from .profiles import current_profile
from .serializers import ProfileSerializer

log = logging.getLogger(__name__)

NAME_MAX = 80
# Shown for any email that can't be registered. It doesn't say "already exists",
# so the form can't be used to check who has an account.
REGISTER_REFUSED = (
    "We couldn't create an account with that email. If you already have one, log in or reset your password."
)


def public_user(user):
    """What the frontend knows about the signed-in user. Accounts made with Google
    or X sign-in (social_login.py) have no password until they set one."""
    return {
        "name": user.first_name or user.email,
        "email": user.email,
        "has_password": user.has_usable_password(),
        "sign_in_with": sorted(user.social_accounts.values_list("provider", flat=True)),
        # Staff see the admin console link (frontend /console).
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
    }


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
        if not SiteSettings.load().registration_open:
            return bad_request("New accounts can't be created right now. Please try again later.")
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
            log.info("Registration refused for an existing account")
            return bad_request(REGISTER_REFUSED)

        user = User(username=email, email=email, first_name=name)
        try:
            validate_password(password, user)  # the AUTH_PASSWORD_VALIDATORS in settings.py
        except ValidationError as err:
            return bad_request(err.messages[0])
        user.set_password(password)
        user.save()
        record("signup", f"{email} created an account", user=user, request=request)

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


def password_problem(password, user):
    """The first AUTH_PASSWORD_VALIDATORS message, or ''."""
    try:
        validate_password(password, user)
    except ValidationError as err:
        return err.messages[0]
    return ""


@method_decorator(csrf_protect, name="dispatch")
class ChangePasswordView(APIView):
    """POST /api/auth/password/ { current_password, new_password } → 204. Stays signed in.
    An account made with Google or X sign-in has no password yet: it sets its first
    one without `current_password`."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        has_password = request.user.has_usable_password()
        if has_password and not request.user.check_password(str(data.get("current_password", ""))):
            return bad_request("Your current password is incorrect.")
        new = str(data.get("new_password", ""))
        problem = password_problem(new, request.user)
        if problem:
            return bad_request(problem)
        request.user.set_password(new)
        request.user.save(update_fields=["password"])
        update_session_auth_hash(request, request.user)  # this session stays valid, others end
        record("password_changed", f"{request.user.email} {'changed' if has_password else 'set'} their password",
               user=request.user, request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)


RESET_EMAIL = """Someone asked to reset the password for this Cardio Sense account.

Set a new password here. The link works once and expires in {hours} hours:
{link}

If it wasn't you, ignore this email: your password hasn't changed.
"""


def send_reset_email(user):
    """Email `user` a one-time link to FRONTEND_URL/reset-password (also used by the admin console)."""
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    link = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"
    body = RESET_EMAIL.format(hours=settings.PASSWORD_RESET_TIMEOUT // 3600, link=link)
    send_mail("Reset your Cardio Sense password", body, None, [user.email])


@method_decorator(csrf_protect, name="dispatch")
class PasswordResetRequestView(APIView):
    """POST /api/auth/password-reset/ { email } → 204, always, so it never reveals whether
    the email has an account. If it does, a one-time link to FRONTEND_URL/reset-password is emailed."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        email = str(data.get("email", "")).strip().lower()
        user = get_user_model().objects.filter(username=email, is_active=True).first()
        if user is not None:
            send_reset_email(user)
            record("password_reset", f"Reset link requested for {user.email}", user=user, request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)


@method_decorator(csrf_protect, name="dispatch")
class PasswordResetConfirmView(APIView):
    """POST /api/auth/password-reset/confirm/ { uid, token, password } → 204; then they log in."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        User = get_user_model()
        try:
            pk = force_str(urlsafe_base64_decode(str(data.get("uid", ""))))
            user = User.objects.get(pk=pk, is_active=True)
        except (ValueError, TypeError, OverflowError, User.DoesNotExist):
            user = None
        if user is None or not default_token_generator.check_token(user, str(data.get("token", ""))):
            return bad_request("This reset link is invalid or has expired. Ask for a new one.")
        password = str(data.get("password", ""))
        problem = password_problem(password, user)
        if problem:
            return bad_request(problem)
        user.set_password(password)  # also invalidates the token, so the link works once
        user.save(update_fields=["password"])
        record("password_reset", f"{user.email} set a new password from a reset link", user=user, request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ExportView(APIView):
    """GET /api/auth/export/ → everything stored about the signed-in user, as a JSON download."""

    def get(self, request):
        profile = current_profile(request.user)
        body = {
            "exported_at": timezone.now().isoformat(),
            "account": {**public_user(request.user), "joined": request.user.date_joined.isoformat()},
            "profile": ProfileSerializer(profile).data if profile else None,
            "assessments": [a.as_record() for a in Assessment.objects.filter(user=request.user)],
        }
        response = Response(body)
        response["Content-Disposition"] = 'attachment; filename="cardio-sense-my-data.json"'
        return response


DELETE_WORD = "DELETE"


@method_decorator(csrf_protect, name="dispatch")
class AccountView(APIView):
    """DELETE /api/auth/account/ { password } → 204. Deletes the account, its profile and
    every assessment at once, and signs out. Audit rows keep no link to the person.
    An account without a password (Google or X sign-in) confirms with { confirm: "DELETE" }."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def delete(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        if request.user.has_usable_password():
            if not request.user.check_password(str(data.get("password", ""))):
                return bad_request("Your password is incorrect.")
        elif str(data.get("confirm", "")).strip() != DELETE_WORD:
            return bad_request(f"Type {DELETE_WORD} to confirm.")
        user = request.user
        email = user.email or user.username
        logout(request)
        user.delete()  # cascades to the profile and assessments
        record("account_deleted", f"{email} deleted their account", email=email, request=request)
        return Response(status=status.HTTP_204_NO_CONTENT)
