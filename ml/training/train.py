"""Train, test and save the heart disease model.

    cd ml
    python -m training.train --data data/Heart_diasease_dataset_from_Northern_Bangladesh.xlsx

Reproduces sections 10–20 of the research notebook: stratified 80/20 split,
leakage-safe preprocessing inside each pipeline, the four required models tuned
by 5-fold CV on ROC-AUC, CV stability, held-out test metrics, and the same
selection rule (CV ROC-AUC -> CV recall -> CV F1 -> test ROC-AUC).

Writes to ml/artifacts/ (the backend loads the model from there):
    heart_disease_inference_pipeline.joblib   complete sklearn pipeline
    model_metadata.json                       schema, metrics, provenance
    model_comparison_results.csv              CV + test metrics for all models
    shap_background.joblib                    k-means summary for SHAP (no raw rows)

No patient-level rows are written anywhere.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import GridSearchCV, StratifiedKFold, cross_validate, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier

from training.data import EXCLUDED_COLUMNS, TARGET, build_modeling_frame, load_raw, split_xy

RANDOM_STATE = 42
TEST_SIZE = 0.20
CV_FOLDS = 5
ARTIFACTS_DIR = Path(__file__).resolve().parents[1] / "artifacts"

PIPELINE_FILE = "heart_disease_inference_pipeline.joblib"
METADATA_FILE = "model_metadata.json"
RESULTS_FILE = "model_comparison_results.csv"
SHAP_BACKGROUND_FILE = "shap_background.joblib"

DISCLAIMER = "Research prototype. Not externally validated, not approved for clinical use."


def make_preprocessor(numeric, categorical, scale_numeric):
    num_steps = [("imputer", SimpleImputer(strategy="median", add_indicator=True))]
    if scale_numeric:
        num_steps.append(("scaler", StandardScaler()))
    cat_pipe = Pipeline([
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ])
    return ColumnTransformer(
        [("num", Pipeline(num_steps), numeric), ("cat", cat_pipe, categorical)],
        remainder="drop",
        verbose_feature_names_out=True,
    )


def model_specs(numeric, categorical):
    pre = lambda scale: make_preprocessor(numeric, categorical, scale)  # noqa: E731
    return {
        "Logistic Regression": (
            Pipeline([
                ("preprocess", pre(True)),
                ("model", LogisticRegression(max_iter=3000, class_weight="balanced",
                                             random_state=RANDOM_STATE)),
            ]),
            {"model__C": [0.01, 0.1, 1, 10], "model__solver": ["liblinear"],
             "model__penalty": ["l1", "l2"]},
        ),
        "Decision Tree": (
            Pipeline([
                ("preprocess", pre(False)),
                ("model", DecisionTreeClassifier(class_weight="balanced",
                                                 random_state=RANDOM_STATE)),
            ]),
            {"model__max_depth": [3, 5, 8, None], "model__min_samples_split": [2, 10],
             "model__min_samples_leaf": [1, 5, 10]},
        ),
        "SVM": (
            Pipeline([
                ("preprocess", pre(True)),
                ("model", SVC(probability=True, class_weight="balanced",
                              random_state=RANDOM_STATE)),
            ]),
            {"model__C": [0.1, 1, 10], "model__kernel": ["linear", "rbf"],
             "model__gamma": ["scale", "auto"]},
        ),
        "Random Forest": (
            Pipeline([
                ("preprocess", pre(False)),
                # n_jobs=1 here; the grid search parallelises instead. Results are
                # identical to the notebook's n_jobs=-1 (same random_state).
                ("model", RandomForestClassifier(class_weight="balanced", n_estimators=300,
                                                 n_jobs=1, random_state=RANDOM_STATE)),
            ]),
            {"model__n_estimators": [200, 400], "model__max_depth": [None, 5, 10],
             "model__min_samples_leaf": [1, 5], "model__max_features": ["sqrt", "log2"]},
        ),
    }


def test_metrics(est, X_test, y_test):
    pred = est.predict(X_test)
    prob = est.predict_proba(X_test)[:, 1]
    return {
        "Test Accuracy": accuracy_score(y_test, pred),
        "Test Precision": precision_score(y_test, pred, zero_division=0),
        "Test Recall": recall_score(y_test, pred, zero_division=0),
        "Test F1": f1_score(y_test, pred, zero_division=0),
        "Test ROC-AUC": roc_auc_score(y_test, prob),
    }


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def feature_schema(X: pd.DataFrame) -> list[dict]:
    """Per raw input: dtype plus training range, for validation and the UI."""
    schema = []
    for col in X.columns:
        s = X[col]
        entry = {"name": col, "dtype": str(s.dtype), "missing_in_training": int(s.isna().sum())}
        if pd.api.types.is_numeric_dtype(s):
            entry.update(min=float(s.min()), median=float(s.median()), max=float(s.max()))
        else:
            entry["categories"] = sorted(s.dropna().astype(str).unique().tolist())
        schema.append(entry)
    return schema


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", required=True, type=Path, help="Path to the Northern Bangladesh .xlsx")
    parser.add_argument("--out", type=Path, default=ARTIFACTS_DIR, help="Artifact directory (default: ml/artifacts)")
    parser.add_argument("--jobs", type=int, default=2, help="Parallel CV jobs (default 2, keeps memory low)")
    args = parser.parse_args(argv)
    args.out.mkdir(parents=True, exist_ok=True)

    # ---- Data (sections 2–7)
    df_model = build_modeling_frame(load_raw(args.data))
    X, y = split_xy(df_model)
    assert TARGET not in X and not set(EXCLUDED_COLUMNS) & set(X.columns)
    print(f"Modeling population: {len(df_model)} rows, {X.shape[1]} predictors")
    print(f"Class balance: {y.mean():.3f} positive / {1 - y.mean():.3f} negative")

    # ---- Split (section 10)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, stratify=y, random_state=RANDOM_STATE
    )
    numeric = X_train.select_dtypes(include=np.number).columns.tolist()
    categorical = X_train.select_dtypes(exclude=np.number).columns.tolist()
    print(f"Train {X_train.shape}, test {X_test.shape}")

    # ---- Tune (sections 12–13)
    cv = StratifiedKFold(n_splits=CV_FOLDS, shuffle=True, random_state=RANDOM_STATE)
    searches = {}
    for name, (pipe, grid) in model_specs(numeric, categorical).items():
        print(f"Tuning {name}...", flush=True)
        search = GridSearchCV(pipe, grid, scoring="roc_auc", cv=cv, n_jobs=args.jobs, refit=True)
        search.fit(X_train, y_train)
        searches[name] = search
        print(f"  best CV ROC-AUC {search.best_score_:.4f}  {search.best_params_}")

    # ---- CV stability + held-out test (sections 14–15)
    scoring = {"accuracy": "accuracy", "precision": "precision", "recall": "recall",
               "f1": "f1", "roc_auc": "roc_auc"}
    rows = []
    for name, search in searches.items():
        r = cross_validate(search.best_estimator_, X_train, y_train, cv=cv, scoring=scoring, n_jobs=args.jobs)
        row = {"Model": name}
        for key, label in [("accuracy", "Accuracy"), ("precision", "Precision"), ("recall", "Recall"),
                           ("f1", "F1"), ("roc_auc", "ROC-AUC")]:
            row[f"CV {label} Mean"] = r[f"test_{key}"].mean()
            row[f"CV {label} SD"] = r[f"test_{key}"].std()
        row.update(test_metrics(search.best_estimator_, X_test, y_test))
        row["Best Params"] = json.dumps(search.best_params_)
        rows.append(row)

    # ---- Selection (section 17): CV ROC-AUC -> CV recall -> CV F1 -> test ROC-AUC
    comparison = pd.DataFrame(rows).sort_values(
        ["CV ROC-AUC Mean", "CV Recall Mean", "CV F1 Mean", "Test ROC-AUC"], ascending=False
    ).reset_index(drop=True)
    comparison["Test_CV_ROC_AUC_Abs_Gap"] = (comparison["Test ROC-AUC"] - comparison["CV ROC-AUC Mean"]).abs()
    final_name = comparison.loc[0, "Model"]
    final = searches[final_name].best_estimator_

    # ---- SHAP background: k-means centroids of the transformed training set,
    # so explanations work for any model type without storing patient rows.
    pre = final.named_steps["preprocess"]
    X_train_t = pre.transform(X_train)
    import shap  # noqa: PLC0415 (heavy import, only needed here)

    background = shap.kmeans(X_train_t, 10).data

    # ---- Save (section 20)
    joblib.dump(final, args.out / PIPELINE_FILE)
    joblib.dump(background, args.out / SHAP_BACKGROUND_FILE)
    comparison.to_csv(args.out / RESULTS_FILE, index=False)

    pred = final.predict(X_test)
    tn, fp, fn, tp = confusion_matrix(y_test, pred).ravel()
    best = comparison.loc[0]
    metadata = {
        "project": "AI-Driven Web-Based Heart Disease Prediction System",
        "dataset": "Northern Bangladesh hospital-sourced dataset",
        "dataset_sha256": sha256(args.data),
        "disclaimer": DISCLAIMER,
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sklearn_version": sklearn.__version__,
        "target": TARGET,
        "random_state": RANDOM_STATE,
        "test_size": TEST_SIZE,
        "cv_folds": CV_FOLDS,
        "modeling_rows": int(len(df_model)),
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "class_balance": {"positive": round(float(y.mean()), 4), "negative": round(float(1 - y.mean()), 4)},
        "excluded_columns": EXCLUDED_COLUMNS,
        "pediatric_rule": "Age < 18 excluded from modeling population",
        "troponin_model_unit": "ng/mL",
        "troponin_note": "High-sensitivity results (ng/L) are divided by 1000 before prediction.",
        "derived_features": {
            "BMI": "Weight (kg) / (Height (cm) / 100)^2",
            "MaxHR": "208 - 0.7*Age (male), 206 - 0.88*Age (female)",
        },
        "models_compared": list(searches),
        "selection_rule": "CV ROC-AUC, then CV recall, then CV F1, then test ROC-AUC",
        "selected_model": final_name,
        "best_parameters": searches[final_name].best_params_,
        "decision_threshold": 0.5,
        "selected_model_metrics": {
            "cv_roc_auc_mean": round(float(best["CV ROC-AUC Mean"]), 4),
            "cv_roc_auc_sd": round(float(best["CV ROC-AUC SD"]), 4),
            "cv_recall_mean": round(float(best["CV Recall Mean"]), 4),
            "cv_f1_mean": round(float(best["CV F1 Mean"]), 4),
            "test_accuracy": round(float(best["Test Accuracy"]), 4),
            "test_precision": round(float(best["Test Precision"]), 4),
            "test_recall": round(float(best["Test Recall"]), 4),
            "test_f1": round(float(best["Test F1"]), 4),
            "test_roc_auc": round(float(best["Test ROC-AUC"]), 4),
            "test_confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
        },
        "raw_input_features": X.columns.tolist(),
        "feature_schema": feature_schema(X_train),
        "transformed_features": pre.get_feature_names_out().tolist(),
        "artifacts": {"pipeline": PIPELINE_FILE, "shap_background": SHAP_BACKGROUND_FILE,
                      "comparison": RESULTS_FILE},
    }
    with open(args.out / METADATA_FILE, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    cols = ["Model", "CV ROC-AUC Mean", "CV ROC-AUC SD", "CV Recall Mean", "CV F1 Mean",
            "Test Accuracy", "Test Recall", "Test F1", "Test ROC-AUC"]
    print("\n" + comparison[cols].round(4).to_string(index=False))
    print(f"\nSelected: {final_name}")
    print(f"Saved to {args.out}")
    print(DISCLAIMER)


if __name__ == "__main__":
    main()
