import math

import numpy as np
import pytest

from predictor.services import explainability_service, prediction_service
from predictor.services.prediction_service import PredictionInputError, build_features, predict


# ---------- API contract ----------

def test_response_matches_the_api_contract(trained, patient):
    result = predict(patient)
    assert set(result) == {"probability", "risk_level", "top_factors"}
    assert 0.0 <= result["probability"] <= 1.0
    assert result["risk_level"] in {"low", "moderate", "high"}
    assert 1 <= len(result["top_factors"]) <= 5
    for factor in result["top_factors"]:
        assert set(factor) == {"name", "contribution"}
        assert isinstance(factor["name"], str) and isinstance(factor["contribution"], float)


def test_factors_are_ranked_by_size(trained, patient):
    sizes = [abs(f["contribution"]) for f in predict(patient)["top_factors"]]
    assert sizes == sorted(sizes, reverse=True)


def test_risk_bands():
    assert [prediction_service.risk_level(p) for p in (0.1, 0.35, 0.64, 0.65, 1.0)] == [
        "low", "moderate", "moderate", "high", "high"]


# ---------- Derived and harmonised inputs ----------

def test_client_bmi_and_max_hr_are_ignored(trained, patient):
    honest = predict(patient)
    lying = predict({**patient, "bmi": 60, "max_hr": 90})
    assert lying == honest


def test_bmi_and_max_hr_are_computed(trained, patient):
    row = build_features({**patient, "sex": "F", "age": 50}).iloc[0]
    assert row["BMI"] == pytest.approx(63 / 1.59**2)
    assert row["MaxHR"] == pytest.approx(206 - 0.88 * 50)


def test_troponin_units_are_harmonised(trained, patient):
    ng_ml = build_features({**patient, "troponin_i": 0.85, "troponin_assay": "quantitative"})
    ng_l = build_features({**patient, "troponin_i": 850, "troponin_assay": "high-sensitivity"})
    assert ng_ml["Troponin_I"].iloc[0] == pytest.approx(ng_l["Troponin_I"].iloc[0])


def test_censored_high_troponin(trained, patient):
    row = build_features({**patient, "troponin_i": 30000, "troponin_assay": "high-sensitivity",
                          "troponin_qualifier": ">"}).iloc[0]
    assert row["Troponin_Censored_High"] == 1
    assert row["Troponin_I"] == pytest.approx(25.0)


def test_ambiguous_troponin_becomes_missing(trained, patient):
    row = build_features({**patient, "troponin_i": 2.5, "troponin_assay": "high-sensitivity",
                          "troponin_qualifier": ">"}).iloc[0]
    assert row["Troponin_Censor_Ambiguous"] == 1 and math.isnan(row["Troponin_I"])


def test_missing_labs_are_imputed_not_rejected(trained, patient):
    result = predict({**patient, "hdl": None, "troponin_i": None, "platelets": ""})
    assert 0.0 <= result["probability"] <= 1.0


def test_features_match_the_trained_schema(trained, patient):
    _, metadata = trained
    assert list(build_features(patient).columns) == metadata["raw_input_features"]


# ---------- Validation ----------

@pytest.mark.parametrize("change, message", [
    ({"age": 16}, "adults only"),
    ({"age": None}, "Missing required"),
    ({"sex": "male"}, "sex must be"),
    ({"diabetes": 2}, "diabetes must be 0 or 1"),
    ({"hdl": "forty"}, "hdl must be a number"),
    ({"hdl": True}, "hdl must be a number"),
    ({"ldl": float("inf")}, "finite"),
    ({"troponin_assay": "ng/mL"}, "troponin_assay"),
    ({"troponin_i": -1}, "negative"),
    ({"troponin_qualifier": ">"}, "high-sensitivity"),  # patient uses the quantitative assay
])
def test_invalid_input_is_rejected(trained, patient, change, message):
    with pytest.raises(PredictionInputError, match=message):
        predict({**patient, **change})


# ---------- Explanations ----------

def test_shap_contributions_add_up_to_the_prediction(trained, patient):
    pipeline, _ = trained
    features = build_features(patient)
    values, _ = explainability_service.shap_values(pipeline, features)
    explainer, kind = explainability_service._explainer(pipeline)
    if kind != "tree":
        pytest.skip("additivity check written for tree explainers")
    base = float(np.asarray(explainer.expected_value).reshape(-1)[-1])
    probability = pipeline.predict_proba(features)[0, 1]
    assert base + values.sum() == pytest.approx(probability, abs=1e-6)


@pytest.mark.parametrize("name, raw", [
    ("num__HDL(mg/dL)", "HDL(mg/dL)"),
    ("num__missingindicator_HDL(mg/dL)", "HDL(mg/dL)"),
    ("cat__Sex_M", "Sex"),
    ("num__Troponin_Censored_High", "Troponin_Censored_High"),
])
def test_transformed_names_map_back_to_inputs(name, raw):
    columns = ["HDL(mg/dL)", "Sex", "Troponin_I", "Troponin_Censored_High"]
    assert explainability_service.raw_feature(name, columns) == raw


def test_every_model_input_has_a_ui_label(trained):
    _, metadata = trained
    assert set(metadata["raw_input_features"]) <= set(explainability_service.LABELS)
