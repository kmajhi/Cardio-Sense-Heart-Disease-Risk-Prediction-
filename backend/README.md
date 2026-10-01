# Cardio Sense backend: Django API

Serves the frontend's API, stores every profile and risk assessment in the database, and gives
staff a Django admin to review, correct and maintain that data. The model is loaded from
`ml/artifacts/`; ML logic stays in `predictor/services/`, never in `views.py`.

> Research prototype. Not externally validated, not approved for clinical use.

## Commands (from `backend/`)

```bash
pip install -r requirements.txt
cp .env.example .env                # sets DJANGO_DEBUG=true: debug mode is OFF unless you ask for it
python manage.py migrate            # creates db.sqlite3 (git-ignored: it holds health data)
python manage.py createsuperuser    # an account for the admin panel
python manage.py seed_demo_accounts # or: demo admin + user logins (see the root README; DEBUG only)
python manage.py runserver          # http://localhost:8000  ·  admin at /admin/
pytest
```

The frontend's dev server proxies `/api/*` to `:8000`. Put `VITE_USE_MOCK_API=false` in
`frontend/.env.local` so it uses this API instead of the in-browser mock.

## API

| Method | Path | Body → response |
|---|---|---|
| GET | `/api/auth/me/` | `{ name, email }` of the signed-in user, or 401; sets the `csrftoken` cookie |
| POST | `/api/auth/register/` | `{ name, email, password }` → 201 `{ name, email }`, signed in |
| POST | `/api/auth/login/` | `{ email, password }` → `{ name, email }`, signed in |
| POST | `/api/auth/logout/` | 204 |
| GET | `/api/auth/oauth/<gmail\|x>/start/` | 302 to Google's or X's sign-in; back to `/dashboard` signed in, or `/?auth=login&auth_error=…` |
| POST | `/api/auth/password/` | `{ current_password, new_password }` → 204, stays signed in |
| POST | `/api/auth/password-reset/` | `{ email }` → 204 always; emails a one-time link if the account exists |
| POST | `/api/auth/password-reset/confirm/` | `{ uid, token, password }` → 204 |
| GET | `/api/auth/export/` | everything stored about the user (account, profile, assessments) as a JSON download |
| DELETE | `/api/auth/account/` | `{ password }` → 204; deletes the account, profile and assessments at once |
| POST | `/api/predict/` | `toPayload()` body → `{ probability, risk_level, top_factors, missing_fields, outside_training, low_confidence }`; saved as an Assessment |
| GET | `/api/history/` | `[{ id, created_at, inputs, result }]`, oldest first |
| DELETE | `/api/history/<id>/` | `id` as shown (`A-0012`) → 204 |
| GET | `/api/profile/` | profile, or 404 when none exists |
| PUT | `/api/profile/` | profile → the stored profile (creates, replaces, or restores one deleted minutes ago) |
| DELETE | `/api/profile/` | 204; undoable for 10 minutes, then purged. Assessments stay with the account |
| GET | `/api/connect/` | `{ gmail, x, facebook, linkedin }`: `true` where app keys are set |
| GET | `/api/connect/<provider>/start/` | 302 to the provider's sign-in and consent page |
| GET | `/api/connect/<provider>/callback/` | provider returns here; 302 to `/profile?connected=…` or `?connect_error=…` |

Errors are HTTP 400 `{ "detail": "..." }`, which the frontend's `api/client.js` displays. A
missing model file is a 503.

**User accounts** (`predictor/accounts.py`). Django's own users (the lower-cased email is the
username) and password hashing, with its password rules (`AUTH_PASSWORD_VALIDATORS`), signed in
with a session cookie that lasts 12 hours (`SESSION_COOKIE_AGE`). Every other endpoint needs a
signed-in user (HTTP 401 otherwise, so the frontend knows to ask for a login again) and only ever
reads or changes that user's own profile and assessments; a new account starts empty.

- **CSRF:** `GET /api/auth/me/` sets the `csrftoken` cookie and every data-changing request sends
  it back as `X-CSRFToken` (the frontend's `api/client.js`). Register, login and logout check it
  too, so a hostile page can't sign a visitor into its own account. `FRONTEND_URL` is trusted as
  an origin; add others with `DJANGO_CSRF_TRUSTED_ORIGINS`.
- **Rate limits:** register, login, password and account changes allow 10 attempts a minute per
  client (`AUTH_THROTTLE_RATE`); predictions 30 a minute per user (`PREDICT_THROTTLE_RATE`).
  Outside development the counts live in the database cache, shared by every worker.
- **No account probing:** registering a taken email and requesting a reset for an unknown one
  give the same answers as any other failure or success.
- **Password reset:** emails go to the runserver console in development; set `EMAIL_HOST`,
  `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` and `DEFAULT_FROM_EMAIL` to send real mail. Links go
  to `FRONTEND_URL/reset-password` and expire after 2 hours.
- **Older rows:** assessments and the seeded demo profile from before accounts have no user; the
  admin shows them, the API never does. `python manage.py purge_orphans` lists them and
  `--yes` deletes them.

## Sign in with Google or X

The login dialog offers "Continue with Google / X" for each provider that has keys
(`predictor/social_login.py`). It reuses the linked-accounts OAuth setup below: the same keys and
the **same callback URL** (`/api/connect/<provider>/callback/`), so a provider set up for linking
works for sign-in with nothing new to register.

- The person is matched on the provider's stable id (Google `sub`, X user id), kept in
  `SocialAccount` (admin → *Social accounts*), never on the email or handle.
- A new Google id creates an account from its **verified** email. If a password account already
  uses that email, nothing is linked and they're asked to log in with the password (registration
  doesn't verify emails, so linking would hand the account to whoever registered the address).
- A new X id creates an account named after the X profile, with no email.
- These accounts have no password: they can set one on the Profile page, and confirm deleting
  the account by typing `DELETE`. `GET /api/auth/me/` reports `has_password` and `sign_in_with`.

## Admin console (frontend `/console`)

A staff-only console in the React app, backed by `predictor/admin_api.py` (`/api/admin/…`, every
call checks `is_staff`). Staff see an **Admin** link in the nav. Make an account staff with
`python manage.py createsuperuser`, or from the console (superusers only).

- **Overview:** users, assessments, low-confidence share, failed logins, 30-day charts by risk band,
  risk mix, the factors that most often raised estimates, recent activity.
- **Users:** search and filter; details (profile, assessments, sessions, activity); rename,
  activate or deactivate, grant or remove staff, send a password reset, sign out everywhere,
  delete; CSV export. Nobody can lock themselves out, and the last active superuser is protected.
- **Assessments:** filter by risk, confidence, date, user or text; full inputs, factors and flags;
  staff notes; delete; CSV export (formula-safe).
- **Model:** model card and metrics, calibration, model comparison, training ranges, files; a
  health check that runs the three sample patients; test predictions (never saved); reload.
- **Activity log:** sign-ups, logins, failed logins (with IP), predictions, password changes and
  every admin or maintenance action (`ActivityEvent`, kept 180 days); CSV export.
- **System health:** database, migrations, cache, model, email, sign-in providers, debug mode,
  secret key and disk space, with versions, build commit and read-only configuration.
- **Maintenance:** purge deleted profiles, orphans, expired sessions and old activity; clear the
  cache; warm the model; download a full JSON backup (no password hashes).
- **Site controls** (`SiteSettings`): maintenance mode (non-staff API calls get 503 with your
  message, `predictor/middleware.py`), an announcement banner on every page, and switches to
  pause registration or predictions. `GET /api/site/` gives every visitor the banner.

## Data retention

- A deleted profile can be restored (the page's Undo) for 10 minutes, linked accounts included.
  After that it is purged on the next API call, or by `python manage.py purge_deleted_profiles`:
  run that from a scheduler (e.g. a Render cron job) so nothing lingers.
- Deleting the account (`DELETE /api/auth/account/`) removes the account, profile and every
  assessment immediately. Audit-log rows stay, with no link to the person.
- `GET /api/auth/export/` gives users a copy of everything stored about them.

## Linked accounts (real OAuth)

Connect on the Profile page runs each provider's own sign-in (`predictor/connections.py`):
authorization code flow with a one-time `state`, plus PKCE for Google and X. The server swaps the
code for a token, reads who the account is (Gmail address, X @username, Facebook or LinkedIn
name), stores only that handle in `Profile.connections`, and drops the token. Nothing is posted or
sent on the user's behalf.

To turn a provider on:

1. Copy `.env.example` to `.env` (git-ignored).
2. Create an app in the provider's developer console (links in `.env.example`) and register
   this exact callback URL: `http://localhost:5173/api/connect/<gmail|x|facebook|linkedin>/callback/`.
3. Paste the client ID and secret into `.env`, then restart `runserver`.
4. Run the frontend with `VITE_USE_MOCK_API=false`. Providers without keys show as "not set up".

**Audit log:** every attempt by a signed-in user is a `ConnectionEvent` (signed-out requests
are sent to log in and write nothing, so the log can't be flooded) (admin → *Connection events*, also inline on
the profile): started, linked, cancelled, expired or forged, failed with the provider's reason,
not set up, and disconnected. It's read-only, filterable by provider, action and date, and exports
to CSV. It never holds tokens or codes.

**Links can't be faked:** `PUT /api/profile/` can keep or remove links but never add or change
one; only the OAuth callback creates them.

**Logs:** `predictor/logfilters.py` masks `code`, `state` and token parameters in every log line
(`state=[hidden]&code=[hidden]`).

When deployed, set `FRONTEND_URL` and `OAUTH_REDIRECT_BASE` to the public https origin and
register the matching callback URLs.

## Data and admin (`/admin/`)

- **Profile:** the Profile page's fields (`profileFields.js`), with photo preview and the
  profile's assessments listed inline.
- **Assessment:** one per `/api/predict/` call. It stores the request as received (unknown keys
  dropped), the result, and the model name and training date from `model_metadata.json`, so old
  results stay traceable after retraining. Age, sex and risk level are copied into columns for
  filtering, and the labs that were imputed (`missing_fields`, `low_confidence`) are kept. The
  inputs and results are read-only in the admin (an audit trail); staff can relink the profile,
  add notes, delete records, and export selected rows to CSV. Exports prefix cells starting with
  `= + - @` so spreadsheets can't run them as formulas.

Schema changes: edit `predictor/models.py`, then `python manage.py makemigrations` and
`migrate`, and commit the migration.

## Settings

Secure by default: **debug mode is off unless `DJANGO_DEBUG=true`** (the `.env.example` you copy
for development sets it). Without debug, `DJANGO_SECRET_KEY` is required and the app redirects
to HTTPS, sends HSTS, and trusts the proxy's `X-Forwarded-Proto` header.

For a deployment set:

- `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS` (comma-separated), `FRONTEND_URL`, and if needed
  `DJANGO_CSRF_TRUSTED_ORIGINS`.
- `DATABASE_URL=postgres://…` (PostgreSQL; SQLite is for development only). Then run
  `python manage.py migrate` and `python manage.py createcachetable` once.
- `EMAIL_*` for password-reset mail.
- Serve with `gunicorn config.wsgi` and check with `python manage.py check --deploy`.

`DJANGO_DB_PATH` moves the development SQLite file. `CARDIO_MODEL_DIR` loads the model from
somewhere other than `../ml/artifacts`. Any of these can also go in `backend/.env`. `render.yaml`
at the repository root deploys all of this (API, PostgreSQL, purge job).

Tests use `config/settings_test.py` (development defaults whatever the environment says).

## Layout

```
config/                      settings, urls (admin + /api/), wsgi
predictor/
  models.py                  Profile, Assessment, ConnectionEvent
  admin.py                   admin panel for all three
  accounts.py                register/login, password change and reset, export, delete account
  authentication.py          session auth that answers 401 when signed out
  profiles.py                the user's profile, soft delete and purge
  management/commands/       purge_deleted_profiles, purge_orphans
  serializers.py             profile validation ('' ↔ null for blank dates/numbers)
  views.py, urls.py          the endpoints above
  migrations/
  services/
    model_store.py             where the artifacts live (CARDIO_MODEL_DIR or ../ml/artifacts)
    prediction_service.py      payload → features → { probability, risk_level, top_factors, missing_fields, low_confidence }
    explainability_service.py  SHAP per prediction, grouped under the UI's field names
tests/                       API endpoints and admin, API contract, validation, unit handling, SHAP additivity
```

## Service notes

- `predict(payload)` takes the frontend's `toPayload()` body. `bmi` and `max_hr` are recomputed
  from height/weight and age/sex, never trusted from the client.
- Troponin arrives as reported, with `troponin_assay`, and is always validated. The deployed model
  does **not** use it (it runs backwards in the training data, see `ml/README.md`); the service
  only passes it on, converted to ng/mL with censoring flags, to a model trained with it.
- Required: age, sex, height, weight, the four history answers, blood pressure and the lipid
  panel. The other labs may be null: the pipeline imputes them, the response lists them in
  `missing_fields`, and 3 or more set `low_confidence`. Under-18, bad types and unknown assays
  raise `PredictionInputError`, returned as HTTP 400.
- `risk_level` bands (<0.35 low, <0.65 moderate, else high) are a UI choice, not a validated
  cut-off. The model's decision threshold is 0.5.
- Accepted ranges are physiological (`LIMITS`): ages 18–120, height 50–250 cm, weight 20–400 kg,
  and a BMI of 10–150 (anything else is a typo). Under 18 gets a clear 400 explaining the model
  covers adults only (see `ml/README.md`). Values beyond the *training* range (from
  `model_metadata.json`) are accepted, listed in `outside_training` (`{ name, value, min, max,
  unit }`) and make the estimate `low_confidence`, because the model treats them like the
  nearest value it saw.
- The model is calibrated (Platt scaling), so `probability` reads as a probability and is never
  exactly 0 or 1.
- `top_factors[].contribution` is SHAP in probability units, from seeded permutation SHAP on the
  calibrated model: they add up exactly to `probability − baseline` and the same inputs always
  get the same explanation (both tested).
- scikit-learn must match the version the model was trained with (1.9.0).
