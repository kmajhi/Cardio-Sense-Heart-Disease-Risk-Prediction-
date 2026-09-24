# Cardio Sense Prediction page

The predictor layout from `heart_disease_prediction_clinical_analytics_dashboard.tsx`
(sample presets, slider inputs, segmented toggles, sticky ring-gauge result card),
rebuilt in the dashboard's own style with the **trained model's actual inputs**.

## Usage

Routed at `/prediction` in `src/App.jsx`, which passes `predict` from `src/api/predictionApi.js`.
It reuses `../Dashboard/components/NavBar` and `../Dashboard/Dashboard.css`.
`predictionApi.js` uses `predictionMock.js` (a hand-tuned stand-in, **not the model's numbers**)
unless `VITE_USE_MOCK_API=false`.

## API

`predict(payload)` must resolve to the contract in CLAUDE.md:

```
{ probability: number, risk_level: 'low' | 'moderate' | 'high', top_factors: [{ name, contribution }] }
```

`contribution` is read as probability units (0.044 → "raised 4.4 pts"), signed, like a
SHAP value. `fields.js → toPayload()` builds the request body. Two things for the backend:

- **Troponin-I** is sent as reported, with `troponin_assay` (`quantitative` = ng/mL,
  `high-sensitivity` = ng/L). Convert ng/L ÷ 1000 to ng/mL before the pipeline, exactly
  as `ml/training/data.py` does. The assay type itself is *not* a model feature (excluded as leakage).
- **Platelets** are entered as ×10³/µL and sent as a raw count (× 1000), matching the dataset.

## Data rules this page follows

- Inputs match `raw_input_features` of the Northern Bangladesh model: age, sex, height,
  weight, BMI, family history, hypertension, diabetes, chest-pain history, BP, RBS, lipid
  panel, blood panel, MaxHR and Troponin-I. The Cleveland-style fields in the reference
  design (ST depression, chest-pain type, exercise angina, fasting sugar) are not in this
  model and were left out.
- **MaxHR is never entered.** It's shown read-only, computed from age and sex
  (`208 − 0.7×age` male, `206 − 0.88×age` female). BMI is computed from height and weight.
- **Troponin-I** has an assay selector. Switching assay clears the value, since the two
  units aren't interchangeable. The value is required before running.
- Age starts at 18 (under-18 records were excluded from training). Slider ranges follow the
  training data. Typed values outside them are accepted, with a "less reliable" note.
- The result card always shows: "Research prototype. Not externally validated, not approved
  for clinical use." It says *estimate*, never *diagnosis*, and never displays 0% or 100%.

## What's in here

- `Prediction.jsx`: page, form state, run/stale/error flow.
- `fields.js`: field definitions, ranges, sample patients, derived values, `toPayload`.
- `predictionMock.js`: fake `predict` with the real response shape.
- `components/`: `SliderField`, `Segmented`, `TroponinField`, `ResultCard` (gauge + factors).
- `Prediction.css`: page styles, prefixed `pc-pr-`. Short-screen (720p) and phone layouts included.
