# Cardio Sense ML: training and evaluation

Trains the heart disease model on the Northern Bangladesh dataset and writes the artifacts the
backend serves from.

> Research prototype. Not externally validated, not approved for clinical use.

## Commands (from `ml/`)

```bash
pip install -r requirements.txt

# Put the dataset in data/ (it is git-ignored and never committed), then train + test + save (~2 min):
python -m training.train --data data/Heart_diasease_dataset_from_Northern_Bangladesh.xlsx

# Research only: keep Troponin-I (it runs backwards in this dataset; never deploy that model)
python -m training.train --data data/<xlsx> --with-troponin --out /tmp/research-artifacts

# Tests. The dataset tests need data/<xlsx> or HEART_DATASET=path/to/xlsx.
pytest
```

## Layout

```
training/
  data.py        cleaning (notebook sections 4–7)
  train.py       training/testing CLI (sections 10–20)
artifacts/       output of train.py, loaded by the backend
  heart_disease_inference_pipeline.joblib   selected pipeline (load with scikit-learn 1.9.0)
  model_metadata.json                       schema, ranges, metrics, dataset SHA-256
  model_comparison_results.csv              CV + test metrics for all four models (no patient rows)
  shap_background.joblib                    10 k-means centroids for SHAP (no patient rows)
notebooks/       the original research notebook (Colab)
data/            put the .xlsx here locally; git-ignored
tests/           cleaning, dataset facts, artifact consistency
```

## What training does

A script port of the research notebook, with the same method and seed:

1. **Clean.** Normalise headers; repair text-typed Hemoglobin/Potassium/Chloride.
2. **Troponin-I.** Parse censored results (`>25000`, `<2.50`, `>2.5`) into a value plus flags,
   and convert High-Sensitivity ng/L to ng/mL.
3. **Population.** Drop 13 under-18 records → 1,035 adults (56.5% / 43.5%).
4. **Leakage.** Drop `SL` (ID), `UNIT` (CCU vs General), and Troponin assay type.
5. **Troponin-I left out.** The deployed model drops Troponin-I and its three censoring flags,
   because the column runs backwards in this data (see the findings below). `--with-troponin`
   keeps them for research comparisons.
6. **Split.** Stratified 80/20 (828 train / 207 test), `random_state=42`.
7. **Models.** Logistic Regression, Decision Tree, SVM and Random Forest. Median imputation
   with missing-indicators and one-hot encoding happen inside each pipeline; each model is tuned
   by 5-fold CV on ROC-AUC.
8. **Select, on cross-validation only.** CV ROC-AUC → CV recall → CV F1 → CV Brier score. The
   held-out test set plays no part in the choice (the notebook used test ROC-AUC as the last
   tie-breaker).
9. **Calibrate.** The winner's classifier is wrapped in Platt scaling (`CalibratedClassifierCV`,
   sigmoid, 5-fold on the training set), so a 30% estimate means about 3 in 10 similar patients
   had heart disease, and the output is never exactly 0% or 100%.

### Current result (without Troponin-I)

> **Internal validation only.** One hospital's data, stratified hold-out. Not a measure of
> clinical accuracy, and not externally validated.

Model comparison (uncalibrated, as tuned; this table picks the model):

| Model | CV ROC-AUC | CV Brier | Test ROC-AUC | Test accuracy | Test recall | Test F1 |
|---|---|---|---|---|---|---|
| **Random Forest (selected)** | 0.992 ± 0.006 | 0.045 | 0.987 | 0.942 | 0.932 | 0.948 |
| Logistic Regression | 0.987 | 0.045 | 0.990 | 0.947 | 0.915 | 0.951 |
| SVM | 0.986 | 0.035 | 0.989 | 0.942 | 0.915 | 0.947 |
| Decision Tree | 0.939 | 0.078 | 0.929 | 0.884 | 0.855 | 0.893 |

Deployed model (the Random Forest after calibration), held-out test set: ROC-AUC 0.987,
accuracy 0.957, recall 0.957, precision 0.966, F1 0.961. Confusion matrix TN 86, FP 4, FN 5,
TP 112. Brier score 0.054 → **0.043** after calibration; test probabilities span 0.7%–99.8%.

### Selected model

- **Estimator:** `RandomForestClassifier` with `n_estimators=400`, `max_depth=10`,
  `max_features="log2"`, `min_samples_leaf=1`, `class_weight="balanced"`, `random_state=42`,
  wrapped in `CalibratedClassifierCV(method="sigmoid", cv=5)`.
- **Preprocessing:** part of the saved pipeline, so it is fitted on training data only.
  Numeric features get `SimpleImputer(strategy="median", add_indicator=True)`; `Sex` gets
  most-frequent imputation plus one-hot encoding. There's no scaling, since trees don't need it.
- **Inputs:** 22 raw features: the 20 measurements entered on the Prediction page other than
  Troponin-I, plus BMI and MaxHR. They are listed in `artifacts/model_metadata.json`, along with
  `deployment_excluded_columns` (the troponin columns) and the reason.
- **Decision threshold:** 0.5. The low/moderate/high bands in the UI are a presentation choice.
- **Explainability:** the calibrated forest isn't a plain tree model, so the backend uses
  seeded permutation SHAP against `shap_background.joblib`. Contributions are in probability
  points, add up exactly to `probability − baseline`, and are the same every time for the same
  inputs.

## ⚠ Data-quality findings. Read before trusting these numbers.

Scores this high usually mean the data carries shortcuts to the label. Found so far:

- **Troponin-I runs backwards.** Normal troponin (≤0.04 ng/mL) rows are 100% heart disease;
  0.5–10 ng/mL rows are 26–37%. Clinically, higher troponin means more myocardial injury. A
  model trained with it learns the dataset's pattern: in the QA review the old model gave a
  healthy patient 51% for a *normal* troponin and 0% for one 50× over the injury cut-off. Unit
  mix-ups within the "Quantitative" column are a plausible cause. **The deployed model
  therefore leaves Troponin-I out**; the app still checks it against clinical limits, and
  `tests/test_model_artifacts.py` fails if it ever comes back.
- **Troponin missing → 100% positive**; High-Sensitivity assay → 99% positive. Assay type is
  already excluded as leakage, but the troponin value still partly encodes it.
- **LDL nearly separates the classes**: ≤80 mg/dL → 5% positive, >160 mg/dL → 100%.
- CCU admissions (excluded as leakage) are 100% positive, so the two classes may come from
  different wards with different lab-ordering patterns.

For comparison, the notebook's model *with* Troponin-I scored CV ROC-AUC 0.999 / test 0.992;
without Troponin-I and lipids, 0.980 / 0.972. Report all of these as dataset-specific, not as
clinical accuracy.

## Who the model covers (checked 2026-10-01)

**Adults only.** The 13 under-18 records (ages 4–16) are *all* heart-disease cases, mostly from
the General ward. With no healthy children there is nothing to learn a child's risk from, and
training on them would only teach "child → heart disease". They stay excluded, and the app
explains this for a child's age instead of estimating (`ADULTS_ONLY` in the backend).

**Training ranges.** Ages 18–97 (7 patients aged 90+), weight 38–101 kg (3 patients at 100 kg or
more), height 141–186 cm, BMI 14.7–43.5. Retraining can't extend these: there is no data beyond
them. The forest doesn't extrapolate: past the edge it treats a value like the most extreme one
it saw (age 100, 110 and 120 all score the same as 97; 120 kg the same as 101 kg). The API
therefore accepts realistic values beyond the edge (ages to 120, 20–400 kg, 50–250 cm), lists
them in `outside_training` and marks the estimate low confidence. Every field's range comes
from `feature_schema` in `artifacts/model_metadata.json`, so it follows any retraining.

## Retraining

`train.py` overwrites `artifacts/`. After retraining:

- run `pytest` here and in `backend/` (the regression tests check troponin stays out, the model
  is calibrated, and the classic risk factors push the estimate the right way);
- update the metrics quoted in `frontend/src/pages/About/content.js` and in this README.
