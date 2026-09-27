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

The deployed model is a **Random Forest classifier** (scikit-learn). Training reproduces the
research notebook's method: it compares four models and keeps the best one.

| Model | CV ROC-AUC | Test ROC-AUC | Test accuracy | Test recall |
|---|---|---|---|---|
| **Random Forest (selected)** | 0.999 | 0.992 | 95.7% | 94.9% |
| SVM | 0.989 | 0.991 | 95.7% | 94.0% |
| Logistic Regression | 0.988 | 0.985 | 93.7% | 90.6% |
| Decision Tree | 0.957 | 0.964 | 88.4% | 89.7% |

- **Selection rule:** highest CV ROC-AUC first, then CV recall, then CV F1, then test ROC-AUC.
- **Settings:** 200 trees, no depth limit, `max_features = log2`, `min_samples_leaf = 1`, and
  `class_weight = balanced` for the mild 56.5% / 43.5% class imbalance.
- **Data:** 1,035 adult records, stratified 80/20 split (828 train / 207 held-out test), with
  every model tuned by 5-fold cross-validation on ROC-AUC.
- **Pipeline:** preprocessing is fitted on training data only, inside the saved pipeline.
  Numeric values get median imputation with missing-value flags; sex is one-hot encoded.
  The whole pipeline is saved as `ml/artifacts/heart_disease_inference_pipeline.joblib`.
- **Explanations:** SHAP `TreeExplainer` gives each prediction's top five factors in
  probability points.

> **These scores are dataset-specific, not clinical accuracy.** The dataset carries shortcuts
> to the outcome, most notably Troponin-I behaving backwards and LDL almost separating the
> classes on its own. See [`ml/README.md`](ml/README.md#-data-quality-findings-read-before-trusting-these-numbers)
> for the details.

## Quick start

```bash
# Frontend
cd frontend && npm install && npm run dev        # http://localhost:5173

# Backend API (admin at http://localhost:8000/admin/) + tests
cd backend && pip install -r requirements.txt && python manage.py migrate
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
