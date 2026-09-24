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
backend/    Python prediction services (Django REST API to come); loads the model from ml/artifacts
ml/         Model training and evaluation, the research notebook, and the saved model artifacts
```

The three parts are separate on purpose:

- `ml/` produces `ml/artifacts/` (the trained pipeline and its metadata).
- `backend/` only reads those artifacts, via `CARDIO_MODEL_DIR` (default `ml/artifacts`).
- `frontend/` only talks to the backend over HTTP (`POST /api/predict/`), and uses a mock until
  the API is live.

## Quick start

```bash
# Frontend
cd frontend && npm install && npm run dev        # http://localhost:5173

# Backend services + tests
cd backend && pip install -r requirements.txt && pytest

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
- [ ] Django project + `predictor` app, serializers and the `/api/predict/` view
- [ ] History model/endpoint (store each prediction's request, response and time)
- [ ] Switch the frontend to the real API (`VITE_USE_MOCK_API=false`)
