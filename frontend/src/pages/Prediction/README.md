# Cardio Sense Prediction page

The predictor layout from `heart_disease_prediction_clinical_analytics_dashboard.tsx`
(sample presets, slider inputs, segmented toggles, sticky ring-gauge result card),
rebuilt in the dashboard's own style with the **trained model's actual inputs**.

## Usage

Routed at `/prediction` in `src/App.jsx`, which passes `predict` from `src/api/predictionApi.js`.
It reuses `src/components/NavBar` and `../Dashboard/Dashboard.css`.
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
- **One allowed range per field, shown on its slider** (e.g. weight 30–200 kg, age 18–110).
  A typed value outside it is refused: the field keeps what was typed and says what's allowed,
  the result card explains why, and Run stays disabled until it's fixed (Ctrl/⌘ + Enter jumps
  to the first bad field). The backend's `LIMITS` (prediction_service.py) match, so the API
  refuses the same values. Under 18 gets its own adults-only message.
- Inside the allowed range but beyond the training data, a value is used with a "less
  reliable" note, and the result is flagged low confidence.
- The result card always shows: "Research prototype. Not externally validated, not approved
  for clinical use." It says *estimate*, never *diagnosis*, and never displays 0% or 100%.

## Guided form

- **(?) on every field** (`components/FieldHelp.jsx`, content in `fieldInfo.js`): what the value is,
  where to find it on a lab report, unit conversions, and its clinical levels with the patient's
  current band marked. The levels come from `src/clinical/ranges.js`, so the help, the live chips
  and the post-result checks always agree. On phones the panel is a bottom sheet. Escape closes it.
- **Live level chips**: each value is read by `clinical/analyze.js` as it's entered (sex-aware,
  eGFR for creatinine) and shows its band ("Normal", "Borderline high"...).
- **Banded slider tracks**: lab sliders are coloured by clinical level (green normal, amber
  borderline, orange high, rose urgent), with the healthy range under each slider.
- **Lab units**: blood sugar (mmol/L or mg/dL), lipids (mg/dL or mmol/L), hemoglobin (g/dL or g/L)
  and creatinine (mg/dL or µmol/L) can be shown and typed in either unit. The value sent to the
  model is always in the unit it was trained on. The choice is remembered (localStorage).
- **Section bar**: sticky, highlights the section in view, and counts values outside healthy
  ranges per section.
- **Draft**: values are kept in sessionStorage (this tab only) and restored after a reload, with a
  "Start over" option. Health data never outlives the tab.
- **Reset**, and **Ctrl/⌘ + Enter** to run from anywhere in the form.

## What's in here

- `Prediction.jsx`: page, form state, run/stale/error flow.
- `fields.js`: field definitions, ranges, sample patients, derived values, `toPayload`.
- `predictionMock.js`: fake `predict` with the real response shape.
- `fieldInfo.js`: help text per field, level tables and slider band colours from the clinical ranges.
- `components/`: `SliderField`, `Segmented`, `TroponinField`, `FieldHelp`, `ResultCard` (gauge + factors).
- `guidedForm.test.jsx`: level tables, the help panel and unit conversion.
- `Prediction.css`: page styles, prefixed `pc-pr-`. Short-screen (720p) and phone layouts included.
