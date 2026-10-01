"""The saved artifacts agree with each other and with the dataset they came from."""

import pandas as pd
import pytest

from tests.conftest import ARTIFACTS
from training.data import TROPONIN_COLUMNS
from training.train import DISCLAIMER, SELECTION_ASCENDING, SELECTION_KEYS, VALIDATION, sha256


def test_metadata_is_consistent(artifacts):
    pipeline, meta = artifacts
    assert meta["disclaimer"] == DISCLAIMER
    assert meta["selected_model"] in meta["models_compared"]
    assert set(meta["models_compared"]) == {"Logistic Regression", "Decision Tree", "SVM", "Random Forest"}
    assert not set(meta["excluded_columns"]) & set(meta["raw_input_features"])
    assert meta["train_rows"] + meta["test_rows"] == meta["modeling_rows"]
    assert list(pipeline.feature_names_in_) == meta["raw_input_features"]


def test_selected_model_won_by_the_selection_rule(artifacts):
    _, meta = artifacts
    results = pd.read_csv(ARTIFACTS / meta["artifacts"]["comparison"])
    ranked = results.sort_values(SELECTION_KEYS, ascending=SELECTION_ASCENDING)
    assert ranked.iloc[0]["Model"] == meta["selected_model"]
    assert "Test" not in " ".join(SELECTION_KEYS)  # the held-out test set never picks the model


def test_held_out_metrics_are_recorded(artifacts):
    _, meta = artifacts
    m = meta["selected_model_metrics"]
    cm = m["test_confusion_matrix"]
    assert sum(cm.values()) == meta["test_rows"]
    assert m["test_accuracy"] == pytest.approx((cm["tp"] + cm["tn"]) / meta["test_rows"], abs=1e-4)


def test_artifacts_came_from_this_dataset(artifacts, dataset_path):
    _, meta = artifacts
    assert meta["dataset_sha256"] == sha256(dataset_path)


# ---------- QA regressions: what the deployed model must never do ----------

def test_deployed_model_leaves_out_troponin(artifacts):
    """Troponin-I runs backwards in this dataset (ml/README.md), so it must not be a model input."""
    pipeline, meta = artifacts
    assert not set(TROPONIN_COLUMNS) & set(meta["raw_input_features"])
    assert meta["deployment_excluded_columns"] == TROPONIN_COLUMNS
    assert not set(TROPONIN_COLUMNS) & set(pipeline.feature_names_in_)


def test_deployed_model_is_calibrated(artifacts):
    pipeline, meta = artifacts
    assert type(pipeline.named_steps["model"]).__name__ == "CalibratedClassifierCV"
    cal = meta["calibration"]
    assert cal["test_brier_calibrated"] <= cal["test_brier_uncalibrated"] + 0.005
    low, high = cal["test_probability_range"]
    assert 0.0 < low and high < 1.0  # never a flat 0% or 100%


def test_metrics_are_labelled_internal_only(artifacts):
    _, meta = artifacts
    assert meta["validation"] == VALIDATION and "Internal validation only" in VALIDATION


def _median_row(meta):
    row = {}
    for entry in meta["feature_schema"]:
        row[entry["name"]] = entry["median"] if "median" in entry else entry["categories"][0]
    return pd.DataFrame([row], columns=meta["raw_input_features"])


def test_risk_factors_push_the_estimate_the_right_way(artifacts):
    """Sanity, not a clinical claim: worsening the classic risk factors together
    must raise the estimate, and improving them must lower it."""
    pipeline, meta = artifacts
    base = _median_row(meta)
    worse, better = base.copy(), base.copy()
    worse[["LDL(mg/dL)", "Total_Cholesterol(mg/dL)", "BP(mmHg)", "Hypertension", "Diabetes"]] = [220, 300, 170, 1, 1]
    better[["LDL(mg/dL)", "Total_Cholesterol(mg/dL)", "BP(mmHg)", "Hypertension", "Diabetes"]] = [70, 150, 110, 0, 0]
    p = lambda df: pipeline.predict_proba(df)[0, 1]  # noqa: E731
    assert p(better) < p(base) < p(worse)
