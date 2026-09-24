# Cardio Sense ML: training and evaluation

Trains the heart disease model on the Northern Bangladesh dataset and writes the artifacts the
backend serves from.

> Research prototype. Not externally validated, not approved for clinical use.

## Commands (from `ml/`)

```bash
pip install -r requirements.txt

# Put the dataset in data/ (it is git-ignored and never committed), then train + test + save (~2 min):
python -m training.train --data data/Heart_diasease_dataset_from_Northern_Bangladesh.xlsx

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
5. **Split.** Stratified 80/20 (828 train / 207 test), `random_state=42`.
6. **Models.** Logistic Regression, Decision Tree, SVM and Random Forest. Median imputation
   with missing-indicators and one-hot encoding happen inside each pipeline; each model is tuned
   by 5-fold CV on ROC-AUC.
7. **Select.** By CV ROC-AUC → CV recall → CV F1 → test ROC-AUC.

### Current result

| Model | CV ROC-AUC | Test ROC-AUC | Test accuracy | Test recall | Test F1 |
|---|---|---|---|---|---|
| **Random Forest (selected)** | 0.999 ± 0.001 | 0.992 | 0.957 | 0.949 | 0.961 |
| SVM | 0.989 | 0.991 | 0.957 | 0.940 | 0.961 |
| Logistic Regression | 0.988 | 0.985 | 0.937 | 0.906 | 0.942 |
| Decision Tree | 0.957 | 0.964 | 0.884 | 0.897 | 0.897 |

Held-out confusion matrix (Random Forest): TN 87, FP 3, FN 6, TP 111.
Test precision 0.974; CV recall 0.970, CV F1 0.979.

### Selected model

- **Estimator:** `RandomForestClassifier` with `n_estimators=200`, `max_depth=None`,
  `max_features="log2"`, `min_samples_leaf=1`, `class_weight="balanced"`, `random_state=42`.
- **Preprocessing:** part of the saved pipeline, so it is fitted on training data only.
  Numeric features get `SimpleImputer(strategy="median", add_indicator=True)`; `Sex` gets
  most-frequent imputation plus one-hot encoding. There's no scaling, since trees don't need it.
- **Inputs:** 26 raw features, the 21 measurements entered on the Prediction page plus BMI, MaxHR
  and three Troponin censoring flags. They are listed in `artifacts/model_metadata.json`.
- **Decision threshold:** 0.5. The low/moderate/high bands in the UI are a presentation choice.
- **Explainability:** SHAP `TreeExplainer` explains `predict_proba` directly, so each factor's
  contribution is in probability points and they add up to `probability − baseline`.

## ⚠ Data-quality findings. Read before trusting these numbers.

Scores this high usually mean the data carries shortcuts to the label. Found so far:

- **Troponin-I runs backwards.** Normal troponin (≤0.04 ng/mL) rows are 100% heart disease;
  0.5–10 ng/mL rows are 26–37%. Clinically, higher troponin means more myocardial injury.
  The model learned the dataset's pattern, so a *normal* troponin can **raise** a prediction.
  Unit mix-ups within the "Quantitative" column are a plausible cause. Troponin-I is kept on
  purpose, to stay faithful to the notebook.
- **Troponin missing → 100% positive**; High-Sensitivity assay → 99% positive. Assay type is
  already excluded as leakage, but the troponin value still partly encodes it.
- **LDL nearly separates the classes**: ≤80 mg/dL → 5% positive, >160 mg/dL → 100%.
- CCU admissions (excluded as leakage) are 100% positive, so the two classes may come from
  different wards with different lab-ordering patterns.

Random Forest without Troponin-I: CV ROC-AUC 0.992, test 0.986. Without Troponin-I and lipids:
0.980 / 0.972. Report these results as dataset-specific, not as clinical accuracy.

## Retraining

`train.py` overwrites `artifacts/`. After retraining:

- run `pytest` here and in `backend/`;
- update the metrics quoted in `frontend/src/pages/About/content.js`.
