"""The deployment's admin account, from environment variables set in the host's dashboard.

    ADMIN_EMAIL     the admin's login email
    ADMIN_PASSWORD  their first password (12+ characters, checked by Django's validators)
    ADMIN_NAME      optional display name (default "Administrator")

Runs on every deploy (render.yaml's build command) and is safe to repeat:
- no variables: does nothing, so a deployment without an admin still builds;
- no such account yet: creates it as staff + superuser with ADMIN_PASSWORD;
- the account exists: makes sure it's active, staff and superuser, but never
  touches its password, so a password changed later in the app stays changed.
  Pass --reset-password to set it back to ADMIN_PASSWORD (a lost password).

Nothing secret lives in the repository: the values come only from the environment.
"""

import os

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Create or update the admin account from ADMIN_EMAIL / ADMIN_PASSWORD (deployments)."

    def add_arguments(self, parser):
        parser.add_argument("--reset-password", action="store_true",
                            help="Set the existing account's password back to ADMIN_PASSWORD.")

    def handle(self, *args, **options):
        email = os.environ.get("ADMIN_EMAIL", "").strip().lower()
        password = os.environ.get("ADMIN_PASSWORD", "")
        name = os.environ.get("ADMIN_NAME", "").strip() or "Administrator"
        if not email and not password:
            self.stdout.write("ADMIN_EMAIL and ADMIN_PASSWORD aren't set: no admin account created.")
            return
        if not email or "@" not in email:
            raise CommandError("Set ADMIN_EMAIL to the admin's email address.")
        if not password:
            raise CommandError("Set ADMIN_PASSWORD (12 characters or more).")

        User = get_user_model()
        user = User.objects.filter(username__iexact=email).first() or User.objects.filter(email__iexact=email).first()
        created = user is None
        if created:
            user = User(username=email, email=email, first_name=name)
        if created or options["reset_password"]:
            if len(password) < 12:
                raise CommandError("ADMIN_PASSWORD must be 12 characters or more.")
            try:
                validate_password(password, user)
            except ValidationError as err:
                raise CommandError("ADMIN_PASSWORD isn't strong enough: " + " ".join(err.messages)) from err
            user.set_password(password)
        user.is_active = user.is_staff = user.is_superuser = True
        user.save()
        if created:
            self.stdout.write(f"Created admin account {email}.")
        else:
            self.stdout.write(f"Admin account {email} is active"
                              + (" and its password was reset." if options["reset_password"] else "."))
