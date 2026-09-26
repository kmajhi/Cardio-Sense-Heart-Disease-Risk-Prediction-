"""Seeds a made-up demo profile, so the site isn't empty before accounts exist.

Runs once, on `migrate`, and only when there's no profile yet. Deleting the
profile from the app or the admin keeps it deleted. The frontend's mock mode
seeds the same person (frontend/src/pages/Profile/demoProfile.js).
"""

import base64
from datetime import date
from pathlib import Path

from django.db import migrations

PHOTO = Path(__file__).resolve().parent.parent / "demo" / "demo-avatar.jpg"

DEMO_PROFILE = {
    "full_name": "Nadia Rahman",
    "email": "nadia.rahman@example.com",
    "phone": "+880 1700 000000",
    "date_of_birth": date(1989, 5, 14),
    "sex": "F",
    "height_cm": 162,
    "weight_kg": 61,
    "blood_group": "B+",
    "hypertension": 0,
    "diabetes": 0,
    "family_history": 1,
    "chest_pain_history": 0,
    "smoker": "never",
    "activity": "moderate",
    "medications": ["Vitamin D3 1000 IU daily"],
    "allergies": ["Penicillin"],
    "emergency_name": "Karim Rahman",
    "emergency_phone": "+880 1800 000000",
    "connections": {},
}


def seed(apps, schema_editor):
    Profile = apps.get_model("predictor", "Profile")
    if Profile.objects.exists():
        return
    photo = "data:image/jpeg;base64," + base64.b64encode(PHOTO.read_bytes()).decode("ascii")
    Profile.objects.create(photo=photo, **DEMO_PROFILE)


def unseed(apps, schema_editor):
    Profile = apps.get_model("predictor", "Profile")
    Profile.objects.filter(user__isnull=True, email=DEMO_PROFILE["email"]).delete()


class Migration(migrations.Migration):
    dependencies = [("predictor", "0001_initial")]
    operations = [migrations.RunPython(seed, unseed)]
