import math

import numpy as np
import pytest

from predictor.services import explainability_service, prediction_service
from predictor.services.prediction_service import PredictionInputError, build_features, predict


# ---------- API contract ----------

def test_response_matches_the_api_contract(trained, patient):
    result = predict(patient)
    assert set(result) == {"probability", "risk_level", "top_factors", "missing_fields", "outside_training", "low_confidence"}
    assert result["missing_fields"] == [] and result["outside_training"] == []
    assert result["low_confidence"] is False
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


def test_troponin_units_are_harmonised(patient):
    ng_ml = prediction_service._troponin({"troponin_i": 0.85, "troponin_assay": "quantitative"})
    ng_l = prediction_service._troponin({"troponin_i": 850, "troponin_assay": "high-sensitivity"})
    assert ng_ml["Troponin_I"] == pytest.approx(ng_l["Troponin_I"])


def test_censored_high_troponin():
    row = prediction_service._troponin({"troponin_i": 30000, "troponin_assay": "high-sensitivity",
                                        "troponin_qualifier": ">"})
    assert row["Troponin_Censored_High"] == 1
    assert row["Troponin_I"] == pytest.approx(25.0)


def test_ambiguous_troponin_becomes_missing():
    row = prediction_service._troponin({"troponin_i": 2.5, "troponin_assay": "high-sensitivity",
                                        "troponin_qualifier": ">"})
    assert row["Troponin_Censor_Ambiguous"] == 1 and math.isnan(row["Troponin_I"])


def test_deployed_model_ignores_troponin(trained, patient):
    """QA C1: troponin runs backwards in the training data, so the deployed model
    must not use it. Any troponin value gives the same estimate as none."""
    _, metadata = trained
    assert "Troponin_I" not in metadata["raw_input_features"]
    estimates = {
        predict({**patient, "troponin_i": value, "troponin_assay": assay})["probability"]
        for value, assay in [(0.01, "quantitative"), (2.0, "quantitative"), (5000, "high-sensitivity"), (None, None)]
    }
    assert len(estimates) == 1


def test_probabilities_are_calibrated_not_certain(trained, patient):
    """QA H1: a calibrated model never says exactly 0% or 100%."""
    _, metadata = trained
    assert "calibration" in metadata
    for change in ({}, {"age": 80, "ldl": 250, "hypertension": 1, "diabetes": 1, "chest_pain_history": 1}):
        assert 0.0 < predict({**patient, **change})["probability"] < 1.0


def test_missing_labs_are_imputed_and_reported(trained, patient):
    result = predict({**patient, "creatinine": None, "troponin_i": None, "platelets": ""})
    assert 0.0 <= result["probability"] <= 1.0
    assert result["missing_fields"] == ["Creatinine", "Platelets"]
    assert result["low_confidence"] is False


@pytest.mark.parametrize("field", ["hdl", "ldl", "bp_mmhg", "height_cm", "diabetes"])
def test_core_inputs_are_required(trained, patient, field):
    with pytest.raises(PredictionInputError, match="Missing required"):
        predict({**patient, field: None})


def test_features_match_the_trained_schema(trained, patient):
    _, metadata = trained
    assert list(build_features(patient).columns) == metadata["raw_input_features"]


# ---------- Validation ----------

@pytest.mark.parametrize("change, message", [
    ({"age": 16}, r"adults \(18 or over\) only"),
    ({"age": 0}, r"adults \(18 or over\) only"),
    ({"age": 111}, "age must be between 18 and 110"),
    ({"weight_kg": 201}, "weight_kg must be between 30 and 200"),
    ({"weight_kg": 500}, "weight_kg must be between 30 and 200"),
    ({"height_cm": 211}, "height_cm must be between 120 and 210"),
    ({"height_cm": 210, "weight_kg": 30}, "BMI of 7, which isn't possible"),
    ({"ldl": 301}, "ldl must be between 30 and 300"),
    ({"triglycerides": 1001}, "triglycerides must be between 30 and 1000"),
    ({"age": 1e9}, "age must be between 18 and 110"),
    ({"height_cm": 0}, "height_cm must be between"),
    ({"platelets": 270}, "platelets must be between"),  # sent in ×10³/µL instead of /µL
    ({"troponin_i": 900}, "500 or under"),
    ({"age": None}, "Missing required"),
    ({"sex": "male"}, "sex must be"),
    ({"diabetes": 2}, "diabetes must be 0 or 1"),
    ({"hdl": "forty"}, "hdl must be a number"),
    ({"hdl": True}, "hdl must be a number"),
    ({"ldl": float("inf")}, "finite"),
    ({"ldl": -5}, "ldl can't be negative"),
    ({"troponin_assay": "ng/mL"}, "troponin_assay"),
    ({"troponin_assay": ["quantitative"]}, "troponin_assay"),
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
    probability = pipeline.predict_proba(features)[0, 1]
    if kind == "tree":
        base = float(np.asarray(explainer.expected_value).reshape(-1)[-1])
    else:
        x = pipeline.named_steps["preprocess"].transform(features)
        base = float(explainability_service._seeded(explainer, x).base_values[0])
    assert base + values.sum() == pytest.approx(probability, abs=1e-6)


def test_explanations_are_repeatable(trained, patient):
    assert predict(patient)["top_factors"] == predict(patient)["top_factors"]


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


# ---------- Beyond the training data ----------

@pytest.mark.parametrize("change", [
    {"age": 100}, {"age": 110}, {"weight_kg": 200, "height_cm": 190}, {"height_cm": 210, "weight_kg": 95},
    {"age": 100, "weight_kg": 130},
])
def test_realistic_extremes_are_accepted_and_flagged(trained, patient, change):
    result = predict({**patient, **change})
    assert 0.0 < result["probability"] < 1.0
    assert result["outside_training"] and result["low_confidence"] is True
    for item in result["outside_training"]:
        assert set(item) == {"name", "value", "min", "max", "unit"}
        assert item["value"] < item["min"] or item["value"] > item["max"]


def test_values_inside_the_training_range_are_not_flagged(trained, patient):
    # The oldest, heaviest and tallest values in the training data are inside it.
    flagged = {o["name"] for o in predict({**patient, "age": 97, "weight_kg": 101, "height_cm": 186})["outside_training"]}
    assert not {"Age", "Weight", "Height"} & flagged


def test_beyond_the_oldest_patient_the_estimate_levels_off(trained, patient):
    """A tree model can't extrapolate: past the training data it treats values like
    the most extreme one it saw. That's why they're flagged, not refused."""
    at_edge = predict({**patient, "age": 97})["probability"]
    assert predict({**patient, "age": 108})["probability"] == pytest.approx(at_edge, abs=0.02)


# ---------- The Prediction page's three sample patients (frontend fields.js → PRESETS) ----------

SAMPLES = {
    "low": dict(age=34, sex="F", height_cm=156, weight_kg=54, family_history=0, hypertension=0, diabetes=0,
                chest_pain_history=0, bp_mmhg=110, rbs_mmol_l=5.4, total_cholesterol=170, hdl=55, ldl=95,
                triglycerides=110, hemoglobin=12.8, creatinine=0.8, platelets=260000, sodium=139, potassium=4.1,
                chloride=102, troponin_i=0.01, troponin_assay="quantitative"),
    "moderate": dict(age=48, sex="M", height_cm=165, weight_kg=74, family_history=1, hypertension=1, diabetes=0,
                     chest_pain_history=0, bp_mmhg=132, rbs_mmol_l=6.4, total_cholesterol=205, hdl=40, ldl=135,
                     triglycerides=150, hemoglobin=13.6, creatinine=1.0, platelets=250000, sodium=139, potassium=4.2,
                     chloride=101, troponin_i=0.02, troponin_assay="quantitative"),
    "high": dict(age=66, sex="M", height_cm=162, weight_kg=78, family_history=1, hypertension=1, diabetes=1,
                 chest_pain_history=1, bp_mmhg=185, rbs_mmol_l=14.5, total_cholesterol=270, hdl=32, ldl=185,
                 triglycerides=280, hemoglobin=11.2, creatinine=1.9, platelets=230000, sodium=134, potassium=4.6,
                 chloride=99, troponin_i=850, troponin_assay="high-sensitivity"),
}


@pytest.mark.parametrize("sample", ["low", "moderate", "high"])
def test_each_sample_patient_lands_in_its_own_band(trained, sample):
    """The samples must show the three bands. If a retrain breaks this, retune
    PRESETS in frontend/src/pages/Prediction/fields.js (and SAMPLES here)."""
    result = predict(SAMPLES[sample])
    assert result["risk_level"] == sample, result["probability"]
    assert result["low_confidence"] is False


def test_samples_are_clearly_apart(trained):
    low, moderate, high = (predict(SAMPLES[s])["probability"] for s in ("low", "moderate", "high"))
    assert low < 0.10 and 0.40 <= moderate <= 0.60 and high > 0.90
