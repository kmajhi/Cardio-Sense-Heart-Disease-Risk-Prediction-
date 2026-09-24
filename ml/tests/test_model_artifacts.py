"""The saved artifacts agree with each other and with the dataset they came from."""

import pandas as pd
import pytest

from tests.conftest import ARTIFACTS
from training.train import DISCLAIMER, sha256


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
    ranked = results.sort_values(
        ["CV ROC-AUC Mean", "CV Recall Mean", "CV F1 Mean", "Test ROC-AUC"], ascending=False
    )
    assert ranked.iloc[0]["Model"] == meta["selected_model"]


def test_held_out_metrics_are_recorded(artifacts):
    _, meta = artifacts
    m = meta["selected_model_metrics"]
    cm = m["test_confusion_matrix"]
    assert sum(cm.values()) == meta["test_rows"]
    assert m["test_accuracy"] == pytest.approx((cm["tp"] + cm["tn"]) / meta["test_rows"], abs=1e-4)


def test_artifacts_came_from_this_dataset(artifacts, dataset_path):
    _, meta = artifacts
    assert meta["dataset_sha256"] == sha256(dataset_path)
