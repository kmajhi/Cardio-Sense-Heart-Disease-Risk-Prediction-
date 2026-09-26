"""What the API stores: the user's health profile and every risk assessment.

There are no user accounts yet, so the site has one profile (user = None) and
assessments aren't tied to a login. `Profile.user` is there for when accounts
arrive; everything is editable from the Django admin in the meantime.
"""

from django.conf import settings
from django.db import models

YES_NO = [(0, "No"), (1, "Yes")]


class Profile(models.Model):
    """The Profile page's data. Field names match the frontend's profileFields.js."""

    SEX = [("M", "Male"), ("F", "Female")]
    SMOKER = [("never", "Never"), ("former", "Former"), ("current", "Current")]
    ACTIVITY = [("low", "Low"), ("moderate", "Moderate"), ("high", "High")]
    BLOOD_GROUPS = [(g, g) for g in ("A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−")]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE,
        help_text="Empty until user accounts exist; the site then has a single profile.",
    )
    full_name = models.CharField(max_length=80)
    # Small square JPEG as a data URL (the frontend crops and scales it to 320 px).
    photo = models.TextField(blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    sex = models.CharField(max_length=1, choices=SEX, blank=True)
    height_cm = models.FloatField(null=True, blank=True)
    weight_kg = models.FloatField(null=True, blank=True)
    blood_group = models.CharField(max_length=3, choices=BLOOD_GROUPS, blank=True)

    # 0 | 1, or empty when not answered (same coding as the /api/predict/ payload).
    hypertension = models.PositiveSmallIntegerField(choices=YES_NO, null=True, blank=True)
    diabetes = models.PositiveSmallIntegerField(choices=YES_NO, null=True, blank=True)
    family_history = models.PositiveSmallIntegerField(
        choices=YES_NO, null=True, blank=True, verbose_name="family history of heart disease")
    chest_pain_history = models.PositiveSmallIntegerField(
        choices=YES_NO, null=True, blank=True, verbose_name="history of chest pain")
    smoker = models.CharField(max_length=10, choices=SMOKER, blank=True)
    activity = models.CharField(max_length=10, choices=ACTIVITY, blank=True, verbose_name="activity level")

    medications = models.JSONField(default=list, blank=True, help_text="List of strings.")
    allergies = models.JSONField(default=list, blank=True, help_text="List of strings.")
    emergency_name = models.CharField(max_length=80, blank=True, verbose_name="emergency contact")
    emergency_phone = models.CharField(max_length=20, blank=True, verbose_name="emergency phone")
    # { provider: { handle, connected_at } }; connecting is simulated in the UI for now.
    connections = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return self.full_name or f"Profile {self.pk}"


class Assessment(models.Model):
    """One POST /api/predict/ call: the request as sent, the response, and the model that made it."""

    RISK_LEVELS = [("low", "Low"), ("moderate", "Moderate"), ("high", "High")]

    profile = models.ForeignKey(
        Profile, null=True, blank=True, on_delete=models.SET_NULL, related_name="assessments")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    inputs = models.JSONField(help_text="The /api/predict/ request body, as received.")
    # Copied out of `inputs` so the admin can filter and search on them.
    age = models.PositiveSmallIntegerField(null=True, blank=True)
    sex = models.CharField(max_length=1, choices=Profile.SEX, blank=True)

    probability = models.FloatField()
    risk_level = models.CharField(max_length=10, choices=RISK_LEVELS, db_index=True)
    top_factors = models.JSONField(default=list, help_text="[{ name, contribution }] in probability units.")

    model_name = models.CharField(max_length=60, blank=True)
    model_trained_at = models.CharField(max_length=40, blank=True, help_text="From model_metadata.json.")

    notes = models.TextField(blank=True, help_text="Staff notes (admin only; never shown to users).")

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.reference} · {self.get_risk_level_display()} ({self.probability:.0%})"

    @property
    def reference(self):
        """The id the History page shows, e.g. A-0012."""
        return f"A-{self.pk:04d}"

    def as_record(self):
        """The History page's record shape: { id, created_at, inputs, result }."""
        return {
            "id": self.reference,
            "created_at": self.created_at.isoformat(),
            "inputs": self.inputs,
            "result": {
                "probability": self.probability,
                "risk_level": self.risk_level,
                "top_factors": self.top_factors,
            },
        }


class ConnectionEvent(models.Model):
    """Audit log of linked accounts: every link attempt, its outcome, and every unlink.

    Written by predictor/connections.py (the OAuth flow) and the profile views
    (disconnect, profile deleted). Read-only in the admin. Never holds tokens or codes.
    """

    ACTIONS = [
        ("started", "Sign-in started"),
        ("linked", "Linked"),
        ("cancelled", "Cancelled at provider"),
        ("expired", "Expired or replayed"),
        ("failed", "Failed"),
        ("not_configured", "Provider not set up"),
        ("no_profile", "No profile"),
        ("disconnected", "Disconnected"),
    ]

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    profile = models.ForeignKey(
        Profile, null=True, blank=True, on_delete=models.SET_NULL, related_name="connection_events")
    provider = models.CharField(max_length=20, db_index=True)
    action = models.CharField(max_length=20, choices=ACTIONS, db_index=True)
    handle = models.CharField(max_length=80, blank=True, help_text="The linked account (e.g. Gmail address).")
    detail = models.CharField(max_length=300, blank=True, help_text="Why it failed, for maintenance.")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.created_at:%Y-%m-%d %H:%M} · {self.provider} · {self.get_action_display()}"
