"""What the API stores: each user's health profile and risk assessments.

Every profile and assessment belongs to a user account (predictor/accounts.py),
and the API only ever returns the signed-in user's own. Rows with no user are
from before accounts existed (and the seeded demo profile): the admin shows
them, the API never does.
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
        help_text="The account this profile belongs to. Empty only for rows from before accounts.",
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

    # Where the user lives: picked from a place search on the Profile page, so
    # the time zone and coordinates are exact (the nav's date and weather use them).
    city = models.CharField(max_length=80, blank=True)
    state = models.CharField(max_length=80, blank=True, verbose_name="state / province")
    country = models.CharField(max_length=80, blank=True)
    country_code = models.CharField(max_length=2, blank=True, help_text="ISO 3166-1 alpha-2, e.g. BD.")
    timezone = models.CharField(max_length=64, blank=True, help_text="IANA time zone, e.g. Asia/Dhaka.")
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)

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
    # { provider: { handle, connected_at } }, written only by the OAuth flow (connections.py).
    connections = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # Set by DELETE /api/profile/. The API treats the profile as gone, but a PUT
    # within profiles.UNDO_SECONDS restores it (with its linked accounts);
    # after that it is purged for good (predictor/profiles.py).
    deleted_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return self.full_name or f"Profile {self.pk}"


class Assessment(models.Model):
    """One POST /api/predict/ call: the request as sent, the response, and the model that made it."""

    RISK_LEVELS = [("low", "Low"), ("moderate", "Moderate"), ("high", "High")]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name="assessments",
        help_text="Whose assessment this is. Empty only for rows from before accounts.",
    )
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
    # Optional labs that weren't measured (imputed by the model), by label.
    missing_fields = models.JSONField(default=list, blank=True)
    # Values beyond the training data's range: [{ name, value, min, max, unit }].
    outside_training = models.JSONField(default=list, blank=True)
    low_confidence = models.BooleanField(
        default=False, help_text="Labs were imputed, or values were outside the training data.")

    model_name = models.CharField(max_length=60, blank=True)
    model_trained_at = models.CharField(max_length=40, blank=True, help_text="From model_metadata.json.")

    notes = models.TextField(blank=True, help_text="Staff notes (admin only; never shown to users).")

    # The app's automated reading of this assessment as the user saw it: each
    # value against its reference range, and the rule-based diet, activity and
    # habit guidance (frontend src/clinical/). Computed in the browser and
    # recorded once (reports.py → GuidanceView); the PDF report uses this frozen
    # copy, so it shows exactly what the app said and never re-generates advice.
    guidance = models.JSONField(null=True, blank=True)
    guidance_recorded_at = models.DateTimeField(null=True, blank=True)

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
                "missing_fields": self.missing_fields,
                "outside_training": self.outside_training,
                "low_confidence": self.low_confidence,
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


class SocialAccount(models.Model):
    """A Google or X identity that signs in to a Cardio Sense account (predictor/social_login.py).

    `uid` is the provider's stable id for the person (Google's `sub`, X's user id),
    never the email or handle, which can change. Different from Profile.connections,
    which only displays linked handles.
    """

    PROVIDERS = [("gmail", "Google"), ("x", "X")]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="social_accounts")
    provider = models.CharField(max_length=20, choices=PROVIDERS)
    uid = models.CharField(max_length=191, help_text="The provider's id for this person.")
    handle = models.CharField(max_length=150, blank=True, help_text="Email (Google) or @username (X) at sign-up.")
    created_at = models.DateTimeField(auto_now_add=True)
    last_login_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["provider", "uid"], name="unique_social_identity")]

    def __str__(self):
        return f"{self.get_provider_display()} · {self.handle or self.uid}"


class ActivityEvent(models.Model):
    """What happened in the app, for the admin console's activity log and monitoring:
    sign-ups, logins (and failed ones), predictions, account changes and admin actions.
    Never holds passwords, tokens or health values; `detail` is a short summary.
    Kept 180 days (admin console → Maintenance → "Purge old activity")."""

    KINDS = [
        ("signup", "Sign-up"),
        ("login", "Login"),
        ("login_failed", "Failed login"),
        ("logout", "Logout"),
        ("social_login", "Google / X sign-in"),
        ("prediction", "Prediction"),
        ("password_changed", "Password changed"),
        ("password_reset", "Password reset"),
        ("account_deleted", "Account deleted"),
        ("admin", "Admin action"),
        ("maintenance", "Maintenance task"),
    ]

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    kind = models.CharField(max_length=20, choices=KINDS, db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="activity")
    # Kept even after the account is deleted, so the log stays readable.
    email = models.CharField(max_length=254, blank=True, db_index=True)
    summary = models.CharField(max_length=240)
    detail = models.JSONField(default=dict, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True, help_text="For spotting repeated failed logins.")

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.created_at:%Y-%m-%d %H:%M} · {self.get_kind_display()} · {self.summary}"


class SiteSettings(models.Model):
    """Site-wide switches the admin console controls. One row (pk=1); read with load()."""

    LEVELS = [("info", "Information"), ("warning", "Warning"), ("critical", "Critical")]

    maintenance_mode = models.BooleanField(
        default=False, help_text="Only staff can use the app; everyone else sees the maintenance message.")
    maintenance_message = models.CharField(
        max_length=300, blank=True,
        default="Cardio Sense is down for maintenance. Please try again shortly.")
    announcement = models.CharField(max_length=300, blank=True, help_text="Shown in a banner on every page.")
    announcement_level = models.CharField(max_length=10, choices=LEVELS, default="info")
    registration_open = models.BooleanField(default=True, help_text="New accounts can be created.")
    predictions_open = models.BooleanField(default=True, help_text="Users can run predictions.")
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.CharField(max_length=254, blank=True)

    class Meta:
        verbose_name = "site settings"
        verbose_name_plural = "site settings"

    def __str__(self):
        return "Site settings"

    CACHE_KEY = "cardio:site-settings"

    @classmethod
    def load(cls):
        """The settings row, cached briefly: the maintenance check reads it on every API call."""
        from django.core.cache import cache

        cached = cache.get(cls.CACHE_KEY)
        if cached is not None:
            return cached
        obj, _ = cls.objects.get_or_create(pk=1)
        cache.set(cls.CACHE_KEY, obj, 10)
        return obj

    def save(self, *args, **kwargs):
        from django.core.cache import cache

        self.pk = 1
        super().save(*args, **kwargs)
        cache.delete(self.CACHE_KEY)
