# Cardio Sense backend: prediction services

Loads the trained model from `ml/artifacts/` and turns a `/api/predict/` request into the API
response, including SHAP explanations. Django + DRF (the `/api/predict/` view, serializers, and
the History model) are the next step. ML logic stays in `predictor/services/`, never in `views.py`.

> Research prototype. Not externally validated, not approved for clinical use.

## Commands (from `backend/`)

```bash
pip install -r requirements.txt
pytest
```

The model is read from `../ml/artifacts` by default. Set `CARDIO_MODEL_DIR` to load it from
somewhere else (for example, a deployed copy of the artifacts).

## Layout

```
predictor/services/
  model_store.py             where the artifacts live (CARDIO_MODEL_DIR or ../ml/artifacts)
  prediction_service.py      payload → features → { probability, risk_level, top_factors }
  explainability_service.py  SHAP per prediction, grouped under the UI's field names
tests/                       API contract, validation, unit handling, SHAP additivity
```

## Service notes

- `predict(payload)` takes the frontend's `toPayload()` body. `bmi` and `max_hr` are recomputed
  from height/weight and age/sex, never trusted from the client.
- Troponin arrives as reported, with `troponin_assay`. The service converts it to ng/mL. The
  optional `troponin_qualifier` (`>` or `<`) reproduces the training data's censoring flags.
- Missing labs are allowed (the pipeline imputes them). Under-18, bad types and unknown assays
  raise `PredictionInputError`; the view should return that as HTTP 400 `{ "detail": "..." }`,
  which the frontend's `api/client.js` displays.
- `risk_level` bands (<0.35 low, <0.65 moderate, else high) are a UI choice, not a validated
  cut-off. The model's decision threshold is 0.5.
- `top_factors[].contribution` is SHAP in probability units. For the forest they add up exactly
  to `probability − baseline` (tested).
- scikit-learn must match the version the model was trained with (1.9.0).
