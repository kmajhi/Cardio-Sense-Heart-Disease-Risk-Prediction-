"""Settings for pytest: development defaults whatever the environment says,
so the suite runs the same locally and in CI (no backend/.env needed)."""

import os

os.environ["DJANGO_DEBUG"] = "true"
os.environ["CARDIO_WARMUP"] = "0"  # tests load the model themselves
os.environ.pop("DATABASE_URL", None)
os.environ.pop("EMAIL_HOST", None)

from .settings import *  # noqa: E402,F403

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
