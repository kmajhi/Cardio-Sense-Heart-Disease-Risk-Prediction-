"""Django settings for the Cardio Sense API.

Development runs with the defaults below. For a deployment set
DJANGO_SECRET_KEY, DJANGO_DEBUG=false and DJANGO_ALLOWED_HOSTS (comma-separated).
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def load_env_file(path):
    """KEY=value lines from backend/.env (git-ignored). Real environment variables win."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


load_env_file(BASE_DIR / ".env")


def env_bool(name, default):
    return os.environ.get(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


DEBUG = env_bool("DJANGO_DEBUG", True)
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY") or (
    "dev-only-insecure-key" if DEBUG else None
)
if not SECRET_KEY:
    raise RuntimeError("Set DJANGO_SECRET_KEY when DJANGO_DEBUG is false.")

ALLOWED_HOSTS = [h.strip() for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h.strip()]
CSRF_TRUSTED_ORIGINS = [o.strip() for o in os.environ.get("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "predictor",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# SQLite for development; the file is git-ignored. DJANGO_DB_PATH moves it
# (e.g. onto a persistent disk when deployed).
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": os.environ.get("DJANGO_DB_PATH", BASE_DIR / "db.sqlite3"),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Profile photos arrive inline as data URLs (~20-40 KB, see the frontend's photo.js).
DATA_UPLOAD_MAX_MEMORY_SIZE = 2 * 1024 * 1024

# ---------- Linked accounts (OAuth, see predictor/connections.py) ----------
# Where the React app lives: the OAuth flow ends with a redirect back to its
# /profile page. In development that's the Vite server, which proxies /api here.
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173").rstrip("/")
# The app's own pages send data-changing API calls (login, predict, profile
# saves) with this Origin, so Django's CSRF check must accept it. In
# development that's the Vite server, which forwards /api here.
if FRONTEND_URL not in CSRF_TRUSTED_ORIGINS:
    CSRF_TRUSTED_ORIGINS.append(FRONTEND_URL)
# The public origin the browser uses for /api. Callback URLs registered with each
# provider are OAUTH_REDIRECT_BASE + /api/connect/<provider>/callback/.
OAUTH_REDIRECT_BASE = os.environ.get("OAUTH_REDIRECT_BASE", FRONTEND_URL).rstrip("/")
# App credentials from each provider's developer console. A provider without
# both values shows as "not set up" in the app.
OAUTH_CLIENTS = {
    provider: {
        "client_id": os.environ.get(f"{prefix}_CLIENT_ID", ""),
        "client_secret": os.environ.get(f"{prefix}_CLIENT_SECRET", ""),
    }
    for provider, prefix in {
        "gmail": "GOOGLE", "x": "X", "facebook": "FACEBOOK", "linkedin": "LINKEDIN",
    }.items()
}
# The OAuth state lives in the session only for the few seconds of the round
# trip; Lax lets the cookie come back on the provider's top-level redirect.
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG

# Same output as Django's defaults, plus a filter that masks OAuth codes, states
# and tokens in every logged line (predictor/logfilters.py).
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {
        "redact_oauth": {"()": "predictor.logfilters.RedactOAuthParams"},
    },
    "formatters": {
        "django.server": {"()": "django.utils.log.ServerFormatter", "format": "[{server_time}] {message}", "style": "{"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "filters": ["redact_oauth"]},
        "django.server": {
            "class": "logging.StreamHandler", "formatter": "django.server", "filters": ["redact_oauth"],
        },
    },
    "loggers": {
        "django": {"handlers": ["console"], "level": "INFO"},
        "django.server": {"handlers": ["django.server"], "level": "INFO", "propagate": False},
        "predictor": {"handlers": ["console"], "level": "INFO"},
    },
}

REST_FRAMEWORK = {
    # Signed in with a Django session (predictor/accounts.py). Every endpoint
    # needs a user unless it says otherwise, and sees only that user's data.
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.SessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    # Register and login: slows down password guessing from one address.
    "DEFAULT_THROTTLE_RATES": {"auth": os.environ.get("AUTH_THROTTLE_RATE", "10/minute")},
}
