"""Django settings for the Cardio Sense API.

Secure by default: DEBUG is off unless DJANGO_DEBUG=true (backend/.env sets it
for local development), and then DJANGO_SECRET_KEY is required. For a
deployment also set DJANGO_ALLOWED_HOSTS and DATABASE_URL (PostgreSQL); see
backend/README.md and `python manage.py check --deploy`.
"""

import os
from pathlib import Path
from urllib.parse import unquote, urlparse

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


# Never on Render (it sets RENDER=true): a deployment takes its settings from the
# dashboard only, so a development .env that reached the repository can't switch
# the live site to DEBUG or override its keys.
if not os.environ.get("RENDER"):
    load_env_file(BASE_DIR / ".env")


def env_bool(name, default):
    return os.environ.get(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


# Off unless asked for: a deployment that forgets the variable must not show
# tracebacks and settings to the world.
DEBUG = env_bool("DJANGO_DEBUG", False)
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY") or (
    "dev-only-insecure-key" if DEBUG else None
)
if not SECRET_KEY:
    raise RuntimeError(
        "Set DJANGO_SECRET_KEY, or DJANGO_DEBUG=true for local development (see backend/.env.example)."
    )

ALLOWED_HOSTS = [h.strip() for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h.strip()]
# Render sets this to the service's own hostname (e.g. cardio-sense-api.onrender.com).
if os.environ.get("RENDER_EXTERNAL_HOSTNAME"):
    ALLOWED_HOSTS.append(os.environ["RENDER_EXTERNAL_HOSTNAME"])
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
    # Maintenance mode from the admin console (predictor/middleware.py).
    "predictor.middleware.MaintenanceMiddleware",
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

def database_from_url(url):
    """postgres://user:password@host:port/name → Django's DATABASES entry."""
    parts = urlparse(url)
    if parts.scheme not in ("postgres", "postgresql"):
        raise RuntimeError("DATABASE_URL must be a postgres:// URL.")
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": parts.path.lstrip("/"),
        "USER": unquote(parts.username or ""),
        "PASSWORD": unquote(parts.password or ""),
        "HOST": parts.hostname or "",
        "PORT": str(parts.port or ""),
        "CONN_MAX_AGE": 60,
        "OPTIONS": {"sslmode": os.environ.get("DATABASE_SSLMODE", "prefer")},
    }


# PostgreSQL when DATABASE_URL is set (deployments: it holds health data).
# Otherwise SQLite for development; the file is git-ignored.
if os.environ.get("DATABASE_URL"):
    DATABASES = {"default": database_from_url(os.environ["DATABASE_URL"])}
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": os.environ.get("DJANGO_DB_PATH", BASE_DIR / "db.sqlite3"),
        }
    }

# Throttle counts must be shared by every worker process, so outside development
# they live in the database (`python manage.py createcachetable` once per database).
CACHES = {
    "default": (
        {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}
        if DEBUG
        else {"BACKEND": "django.core.cache.backends.db.DatabaseCache", "LOCATION": "cardio_cache"}
    )
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
# A refused request gets a JSON reason (which origin), not Django's HTML page.
CSRF_FAILURE_VIEW = "predictor.csrf.csrf_failure"
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
# Health data: a signed-in session lasts a working day, not Django's default two weeks.
SESSION_COOKIE_AGE = int(os.environ.get("SESSION_COOKIE_AGE", 12 * 3600))

# ---------- HTTPS (everything outside development) ----------
if not DEBUG:
    # Behind Render's (or any) proxy, HTTPS is announced in this header.
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = env_bool("DJANGO_SSL_REDIRECT", True)
    SECURE_HSTS_SECONDS = int(os.environ.get("DJANGO_HSTS_SECONDS", 31536000))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool("DJANGO_HSTS_INCLUDE_SUBDOMAINS", False)
    SECURE_HSTS_PRELOAD = False
# Deliberate: on a shared domain like onrender.com, HSTS must not claim every
# subdomain or ask for preloading. `check --deploy` would warn about both.
SILENCED_SYSTEM_CHECKS = ["security.W005", "security.W021"]
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

# ---------- Email (password reset links) ----------
# Development prints emails to the runserver console. Set EMAIL_HOST (and
# friends) to send real mail.
if os.environ.get("EMAIL_HOST"):
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
    EMAIL_HOST = os.environ["EMAIL_HOST"]
    EMAIL_PORT = int(os.environ.get("EMAIL_PORT", 587))
    EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
    EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
    EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
else:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "Cardio Sense <no-reply@cardiosense.local>")
PASSWORD_RESET_TIMEOUT = 2 * 3600  # reset links expire after 2 hours

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
    # Signed out → 401 (not DRF's default 403), so the frontend knows to log in again.
    "DEFAULT_AUTHENTICATION_CLASSES": ["predictor.authentication.SessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_THROTTLE_RATES": {
        # Register, login, password and account changes: slows down guessing from one address.
        "auth": os.environ.get("AUTH_THROTTLE_RATE", "10/minute"),
        # Each prediction runs SHAP and writes a row.
        "predict": os.environ.get("PREDICT_THROTTLE_RATE", "30/minute"),
    },
}
