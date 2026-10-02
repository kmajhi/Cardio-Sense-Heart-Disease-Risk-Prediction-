# Cardio Sense

AI-assisted heart disease risk estimation for resource-limited clinics: a clinical
decision-support prototype built as a final-year CSE capstone. Routine measurements (blood
pressure, lipids and a basic blood panel) go in; a calibrated, explained probability estimate
comes out, checked against clinical reference ranges and saved to the patient's history.

> **Research prototype. Not externally validated, not approved for clinical use.**
> Estimates are not diagnoses.

## Repository layout

```
frontend/   React (Vite) web app: Home, Dashboard, Prediction, History, Guidance, Profile, About,
            plus the staff admin console at /console
backend/    Django REST API + Django admin; accounts, profiles, assessments, activity log;
            loads the model from ml/artifacts
ml/         Model training and evaluation, the research notebook, and the saved model artifacts
```

The three parts are separate on purpose:

- `ml/` produces `ml/artifacts/` (the trained pipeline and its metadata).
- `backend/` only reads those artifacts, via `CARDIO_MODEL_DIR` (default `ml/artifacts`).
- `frontend/` only talks to the backend over HTTP (`/api/auth/`, `/api/predict/`,
  `/api/history/`, `/api/profile/`), or to an in-browser mock when `VITE_USE_MOCK_API` isn't
  `false`.

## Features

- **Prediction:** 20 routine measurements (BMI and maximum heart rate are calculated), sample
  patients, "Not measured" for missing labs; a calibrated estimate with its risk band (low < 35%,
  moderate 35–65%, high ≥ 65%), the top factors behind it and a confidence warning.
- **Clinical checks:** every value is compared with published reference ranges, separately from
  the model; urgent results are listed first.
- **Dashboard, History and Guidance:** risk over time, lab trends, notifications, and diet,
  activity and "when to see a doctor" advice.
- **Accounts:** email/password or Google sign-in, password reset by email, download my data,
  delete my account. Each user sees only their own data.
- **Admin console (`/console`, staff only):** overview with 7/30/90-day KPIs, period-on-period
  changes and an activation funnel; users (bulk activate, deactivate or sign out); assessments;
  security (failed logins by address and account, who is signed in); model card and health check;
  activity log with live tail; system health; maintenance and backups; site controls (maintenance
  mode, announcement banner, pause sign-ups or predictions). Light and dark themes, a command
  palette (Ctrl/⌘ K) that searches users and assessments, keyboard shortcuts (press `?`) and a
  notification centre for failed-login spikes, failing health checks and paused features.

## Model

The deployed model is a **calibrated Random Forest classifier** (scikit-learn). Training
follows the research notebook's method, comparing four models and keeping the best, with three
changes made after a QA review: Troponin-I is left out (it runs backwards in this dataset), the
model is chosen on cross-validation only, and the winner is calibrated.

| Model | CV ROC-AUC | Test ROC-AUC | Test accuracy | Test recall |
|---|---|---|---|---|
| **Random Forest (selected, calibrated)** | 0.992 | 0.987 | 95.7% | 95.7% |
| Logistic Regression | 0.987 | 0.990 | 94.7% | 91.5% |
| SVM | 0.986 | 0.989 | 94.2% | 91.5% |
| Decision Tree | 0.939 | 0.929 | 88.4% | 85.5% |

> **Internal validation only**: one hospital's data, stratified hold-out. The other rows are
> uncalibrated, as compared.

- **Selection rule:** highest CV ROC-AUC first, then CV recall, then CV F1, then CV Brier score.
  The test set plays no part in the choice.
- **Settings:** 400 trees, `max_depth = 10`, `max_features = log2`, `min_samples_leaf = 1`,
  `class_weight = balanced`, then Platt scaling (5-fold, training data only). Test Brier score
  0.043; estimates are never exactly 0% or 100%.
- **Data:** 1,035 adult records, stratified 80/20 split (828 train / 207 held-out test), with
  every model tuned by 5-fold cross-validation on ROC-AUC.
- **Pipeline:** preprocessing is fitted on training data only, inside the saved pipeline.
  Numeric values get median imputation with missing-value flags; sex is one-hot encoded.
  The whole pipeline is saved as `ml/artifacts/heart_disease_inference_pipeline.joblib`.
- **Explanations:** seeded permutation SHAP gives each prediction's top five factors in
  probability points (repeatable, and they add up to the estimate).
- **Missing labs:** blood sugar and the blood-panel labs can be marked "not measured". The
  model imputes them and the result names them; three or more flag the estimate as low
  confidence. Age, sex, height, weight, history, blood pressure and the lipid panel are required.

> **These scores are dataset-specific, not clinical accuracy.** The dataset carries shortcuts
> to the outcome, most notably Troponin-I behaving backwards (now left out of the model) and
> LDL almost separating the classes on its own. See [`ml/README.md`](ml/README.md#-data-quality-findings-read-before-trusting-these-numbers)
> for the details.

## Quick start

```bash
# Frontend
cd frontend && npm install && npm run dev        # http://localhost:5173

# Backend API (admin at http://localhost:8000/admin/) + tests
cd backend && pip install -r requirements.txt && cp .env.example .env && python manage.py migrate
python manage.py seed_demo_accounts && python manage.py runserver   # demo logins below
pytest
# then set VITE_USE_MOCK_API=false in frontend/.env.local to use it

# Retrain the model (dataset not in the repo; put the .xlsx in ml/data/)
cd ml && pip install -r requirements.txt
python -m training.train --data data/Heart_diasease_dataset_from_Northern_Bangladesh.xlsx
pytest
```

Each folder's README has the details.

## Demo logins (local testing)

`python manage.py seed_demo_accounts` (from `backend/`) creates these two accounts, or resets
their passwords if they already exist:

| Role | Email | Password | Where |
|---|---|---|---|
| Admin (staff + superuser) | `admin@example.com` | `Admin-Demo-2026` | Admin console at http://localhost:5173/console, Django admin at http://localhost:8000/admin/ |
| User (patient) | `sujon@example.com` | `Sujon123` | Log in on http://localhost:5173 |

These passwords are public, so the command only runs when `DJANGO_DEBUG=true` (local
development). They never exist on a deployed server: its admin comes from `ADMIN_EMAIL` and
`ADMIN_PASSWORD` (see below).

## Deploying on Render

`render.yaml` is a Render Blueprint for the whole app: the React site (`cardio-sense`), the Django
API (`cardio-sense-api`) and PostgreSQL (`cardio-sense-db`). The site sends `/api/*` to the API
through its own origin, so sign-in cookies work exactly as they do locally. Every push to the
deployed branch rebuilds both services.

**Secrets never go in the repository.** Enter them once in the Render dashboard under
**cardio-sense-api → Environment** (the Blueprint lists them with `sync: false`, so Render asks
for them):

| Variable | Needed for | Value |
|---|---|---|
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | The admin console (`/console`) and Django admin | Your admin login. Password: 12+ characters, not a common one. Created on the first deploy; later deploys never reset it, so change it in the app whenever you like. |
| `ADMIN_NAME` | Optional | The admin's display name |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | "Continue with Google" and linking Gmail | Google Cloud Console → APIs & Services → Credentials → OAuth client (Web) |
| `X_CLIENT_ID`, `X_CLIENT_SECRET` | "Continue with X" | developer.x.com → your app → User authentication (OAuth 2.0, Web App) |
| `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` | Linking Facebook | developers.facebook.com → your app → Facebook Login |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | Linking LinkedIn | linkedin.com/developers → your app (Sign In with LinkedIn using OpenID Connect) |
| `EMAIL_HOST`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL` | Password-reset emails | Your SMTP provider (port 587 + TLS by default; `EMAIL_PORT` / `EMAIL_USE_TLS` override) |

`DJANGO_SECRET_KEY` is generated by Render and `DATABASE_URL` comes from the database, so neither
is typed anywhere.

For each sign-in provider, register this callback URL in its console (use your own site address
if the service has another name):

```
https://cardio-sense.onrender.com/api/connect/<gmail|x|facebook|linkedin>/callback/
```

A provider without keys simply shows as "not set up". After changing a variable, Render redeploys
the API by itself.

**Checking a deploy:** open the site, log in with the admin account, then open `/console` →
System health. Every check there should be green or explained. The first request after a quiet
spell can take ~50 seconds on Render's free plan while the API wakes up.

**Lost the admin password?** In the Render shell for `cardio-sense-api`, run
`cd backend && python manage.py ensure_admin --reset-password`, which sets it back to
`ADMIN_PASSWORD`.

Free-plan notes: the free PostgreSQL database expires after 30 days unless upgraded, and free web
services sleep when idle. Use paid plans for anything beyond a demo.

## Data

The Northern Bangladesh hospital dataset holds patient-level records. It is **git-ignored**
(`*.xlsx`, `*.csv`) and must never be committed. Only aggregate artifacts are in the repo: the
model, its metadata, the model comparison table, and SHAP centroids.

## Status

- [x] ML model trained, validated, saved as a pipeline (`ml/`)
- [x] Prediction and explainability services with tests (`backend/predictor/services/`)
- [x] Frontend: Dashboard, Prediction, History and About pages (mock API)
- [x] Django project + `predictor` app: `/api/predict/`, `/api/history/`, `/api/profile/`
- [x] Profile and Assessment models (each prediction's request, response, model and time) with
      a Django admin
- [x] Frontend reads the real API when `VITE_USE_MOCK_API=false` (local development)
- [x] User accounts: register, log in and log out (Django sessions); each user sees only their
      own profile and assessments
- [x] Google sign-in, password reset, data export and account deletion
- [x] Health guidance, notifications and clinical range checks
- [x] Staff admin console (`/console`) with activity log, system health and site controls
- [x] Full QA run: 114 test cases traced to 24 requirements, 107 passed
- [x] Render Blueprint for the full app (site, API, database), secrets set in the dashboard
