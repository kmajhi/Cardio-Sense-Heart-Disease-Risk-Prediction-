"""Demo logins for local testing: an admin for /console, a regular patient account and a
demo doctor for the Doctor Panel (/doctor).

The passwords are published in the README, so this refuses to run unless DEBUG is on.
Running it again resets the accounts to the documented passwords. The doctor is fictional:
its details and registration number are marked as test data, and it is verified only so the
review queue can be tried locally.
"""

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from predictor.models import DoctorProfile

DEMO_ACCOUNTS = [
    # email, name, password, staff + superuser
    ("admin@example.com", "Administrator", "Admin-Demo-2026", True),
    ("sujon@example.com", "MD. Sujon Mahamud", "Sujon123", False),
]
# A fictional doctor (not a real person or registration): email, name, password, profile.
DEMO_DOCTOR = ("doctor@example.com", "Dr. Farhana Rahman", "Heart-Review-2026", {
    "specialty": "Cardiology (Interventional Cardiologist)",
    "organization": "Dhaka Heart Care Hospital (Test)",
    "registration_number": "BMDC-TEST-00001",
    "phone": "+880 1700-000000",
})


class Command(BaseCommand):
    help = "Create (or reset) the demo admin, user and doctor accounts. Local development only."

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

        email, name, password, details = DEMO_DOCTOR
        user, created = User.objects.get_or_create(username=email, defaults={"email": email})
        user.email = email
        user.first_name = user.first_name or name
        user.is_active = True
        user.is_staff = user.is_superuser = False
        user.set_password(password)
        user.save()
        doctor, _ = DoctorProfile.objects.get_or_create(user=user)
        for key, value in details.items():
            setattr(doctor, key, getattr(doctor, key) or value)
        doctor.status = "active"
        doctor.is_verified = True
        doctor.verified_by = doctor.verified_by or "seed_demo_accounts (local demo)"
        doctor.is_available = True
        doctor.must_change_password = False
        doctor.save()
        self.stdout.write(f"{'Created' if created else 'Reset'} doctor: {email} ({doctor.doctor_id})")
