"""Demo logins for local testing: an admin for /console and a regular patient account.

The passwords are published in the README, so this refuses to run unless DEBUG is on.
Running it again resets both accounts to the documented passwords.
"""

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

DEMO_ACCOUNTS = [
    # email, name, password, staff + superuser
    ("admin@example.com", "Administrator", "Admin-Demo-2026", True),
    ("sujon@example.com", "MD. Sujon Mahamud", "Sujon123", False),
]


class Command(BaseCommand):
    help = "Create (or reset) the demo admin and user accounts. Local development only."

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("Refusing to create accounts with published passwords while DEBUG is off.")
        User = get_user_model()
        for email, name, password, admin in DEMO_ACCOUNTS:
            user, created = User.objects.get_or_create(username=email, defaults={"email": email})
            user.email = email
            user.first_name = user.first_name or name
            user.is_active = True
            user.is_staff = user.is_superuser = admin
            user.set_password(password)
            user.save()
            role = "admin" if admin else "user"
            self.stdout.write(f"{'Created' if created else 'Reset'} {role}: {email}")
