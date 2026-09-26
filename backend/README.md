# Cardio Sense backend: Django API

Serves the frontend's API, stores every profile and risk assessment in the database, and gives
staff a Django admin to review, correct and maintain that data. The model is loaded from
`ml/artifacts/`; ML logic stays in `predictor/services/`, never in `views.py`.

> Research prototype. Not externally validated, not approved for clinical use.

## Commands (from `backend/`)

```bash
pip install -r requirements.txt
python manage.py migrate            # creates db.sqlite3 (git-ignored: it holds health data)
python manage.py createsuperuser    # an account for the admin panel
python manage.py runserver          # http://localhost:8000  ·  admin at /admin/
pytest
```

The frontend's dev server proxies `/api/*` to `:8000`. Put `VITE_USE_MOCK_API=false` in
`frontend/.env.local` so it uses this API instead of the in-browser mock.

## API

| Method | Path | Body → response |
|---|---|---|
| POST | `/api/predict/` | `toPayload()` body → `{ probability, risk_level, top_factors }`; saved as an Assessment |
| GET | `/api/history/` | `[{ id, created_at, inputs, result }]`, oldest first |
| DELETE | `/api/history/<id>/` | `id` as shown (`A-0012`) → 204 |
| GET | `/api/profile/` | profile, or 404 when none exists |
| PUT | `/api/profile/` | profile → the stored profile (creates or replaces) |
| DELETE | `/api/profile/` | 204; the profile's assessments are kept, unlinked |
| GET | `/api/connect/` | `{ gmail, x, facebook, linkedin }`: `true` where app keys are set |
| GET | `/api/connect/<provider>/start/` | 302 to the provider's sign-in and consent page |
| GET | `/api/connect/<provider>/callback/` | provider returns here; 302 to `/profile?connected=…` or `?connect_error=…` |

Errors are HTTP 400 `{ "detail": "..." }`, which the frontend's `api/client.js` displays. A
missing model file is a 503.

**No user accounts yet.** The API is open and the site has a single profile (`Profile.user` is
empty). `Profile.user` is ready for when accounts arrive; the views' `current_profile()` is the
one place that has to change. Don't deploy the API publicly before then: anyone could read the
stored data.

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

**Audit log:** every attempt is a `ConnectionEvent` (admin → *Connection events*, also inline on
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
  filtering. The inputs and results are read-only in the admin (an audit trail); staff can
  relink the profile, add notes, delete records, and export selected rows to CSV.

Schema changes: edit `predictor/models.py`, then `python manage.py makemigrations` and
`migrate`, and commit the migration.

## Settings

Development needs no configuration. For a deployment set `DJANGO_SECRET_KEY`,
`DJANGO_DEBUG=false`, `DJANGO_ALLOWED_HOSTS` (comma-separated) and, if needed,
`DJANGO_CSRF_TRUSTED_ORIGINS`. `DJANGO_DB_PATH` moves the SQLite file (e.g. onto a persistent
disk). `CARDIO_MODEL_DIR` loads the model from somewhere other than `../ml/artifacts`. Any of
these can also go in `backend/.env` (see `.env.example`), along with the linked-account keys.

## Layout

```
config/                      settings, urls (admin + /api/), wsgi
predictor/
  models.py                  Profile, Assessment
  admin.py                   admin panel for both
  serializers.py             profile validation ('' ↔ null for blank dates/numbers)
  views.py, urls.py          the endpoints above
  migrations/
  services/
    model_store.py             where the artifacts live (CARDIO_MODEL_DIR or ../ml/artifacts)
    prediction_service.py      payload → features → { probability, risk_level, top_factors }
    explainability_service.py  SHAP per prediction, grouped under the UI's field names
tests/                       API endpoints and admin, API contract, validation, unit handling, SHAP additivity
```

## Service notes

- `predict(payload)` takes the frontend's `toPayload()` body. `bmi` and `max_hr` are recomputed
  from height/weight and age/sex, never trusted from the client.
- Troponin arrives as reported, with `troponin_assay`. The service converts it to ng/mL. The
  optional `troponin_qualifier` (`>` or `<`) reproduces the training data's censoring flags.
- Missing labs are allowed (the pipeline imputes them). Under-18, bad types and unknown assays
  raise `PredictionInputError`, returned as HTTP 400.
- `risk_level` bands (<0.35 low, <0.65 moderate, else high) are a UI choice, not a validated
  cut-off. The model's decision threshold is 0.5.
- `top_factors[].contribution` is SHAP in probability units. For the forest they add up exactly
  to `probability − baseline` (tested).
- scikit-learn must match the version the model was trained with (1.9.0).
