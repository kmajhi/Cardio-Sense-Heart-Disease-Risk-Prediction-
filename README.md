# Cardio Sense

AI-assisted heart disease risk estimation for resource-limited clinics: a clinical
decision-support prototype built as a final-year CSE capstone. Routine measurements (blood
pressure, lipids, a basic blood panel and Troponin-I) go in; an explained probability estimate
comes out.

> **Research prototype. Not externally validated, not approved for clinical use.**
> Estimates are not diagnoses.

## Repository layout

```
frontend/   React (Vite) web app: Dashboard, Prediction, History, About
backend/    Django REST API + admin; stores profiles and assessments; loads the model from ml/artifacts
ml/         Model training and evaluation, the research notebook, and the saved model artifacts
```

The three parts are separate on purpose:

- `ml/` produces `ml/artifacts/` (the trained pipeline and its metadata).
- `backend/` only reads those artifacts, via `CARDIO_MODEL_DIR` (default `ml/artifacts`).
- `frontend/` only talks to the backend over HTTP (`/api/auth/`, `/api/predict/`,
  `/api/history/`, `/api/profile/`), or to an in-browser mock when `VITE_USE_MOCK_API` isn't
  `false`.

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
python manage.py createsuperuser && python manage.py runserver
pytest
# then set VITE_USE_MOCK_API=false in frontend/.env.local to use it

# Retrain the model (dataset not in the repo; put the .xlsx in ml/data/)
cd ml && pip install -r requirements.txt
python -m training.train --data data/Heart_diasease_dataset_from_Northern_Bangladesh.xlsx
pytest
```

Each folder's README has the details.

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
- [ ] Deploy the API and switch the hosted site off the mock
