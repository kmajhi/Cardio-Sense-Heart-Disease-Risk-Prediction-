"""Wraps the saved sklearn pipeline for POST /api/predict/.

Request body (what the frontend's fields.js → toPayload() sends):

    age, sex ('M'|'F'), height_cm, weight_kg, family_history, hypertension,
    diabetes, chest_pain_history (0|1), bp_mmhg, rbs_mmol_l, total_cholesterol,
    hdl, ldl, triglycerides, hemoglobin, creatinine, platelets (count/µL),
    sodium, potassium, chloride, troponin_i, troponin_assay
    ('quantitative' ng/mL | 'high-sensitivity' ng/L), optional
    troponin_qualifier ('>' | '<') for censored lab reports.

Response (the API contract):

    { probability, risk_level, top_factors: [{ name, contribution }] }

`bmi` and `max_hr` are ignored if sent: both are formulas of other inputs in
the source data, so they're always recomputed here.
"""

from __future__ import annotations

import json
import math
from functools import lru_cache

import joblib
import pandas as pd

from . import explainability_service
from .model_store import METADATA_PATH, PIPELINE_PATH

# Probability bands for the UI badge. A presentation choice, not a clinically
# validated cut-off; the model's own decision threshold is 0.5.
RISK_BANDS = [(0.35, "low"), (0.65, "moderate"), (1.01, "high")]

ASSAYS = {"quantitative": 1.0, "high-sensitivity": 1 / 1000}  # factor to ng/mL
HS_CENSOR_HIGH_NG_L = 25000.0
HS_CENSOR_LOW_NG_L = 2.50

# payload key -> raw dataset column (measured inputs only; derived ones below)
FIELD_MAP = {
    "age": "Age",
    "height_cm": "Height (cm)",
    "weight_kg": "Weight (kg)",
    "family_history": "Family H/O",
    "hypertension": "Hypertension",
    "diabetes": "Diabetes",
    "total_cholesterol": "Total_Cholesterol(mg/dL)",
    "bp_mmhg": "BP(mmHg)",
    "chest_pain_history": "H/O ChestPain",
    "rbs_mmol_l": "RBS(mmol/L)",
    "hdl": "HDL(mg/dL)",
    "ldl": "LDL(mg/dL)",
    "triglycerides": "Triglycerides(mg/dL)",
    "hemoglobin": "Himoglobin",
    "creatinine": "Creatinine(mg/dL)",
    "platelets": "Platelets",
    "sodium": "Sodium(mmol/L)",
    "potassium": "Potassium",
    "chloride": "Chloride",
}
BINARY_FIELDS = {"family_history", "hypertension", "diabetes", "chest_pain_history"}
REQUIRED_FIELDS = {"age", "sex"}


class PredictionInputError(ValueError):
    """The request can't be turned into a valid model input."""


@lru_cache(maxsize=1)
def load_model():
    if not PIPELINE_PATH.exists():
        raise FileNotFoundError(
            f"No trained model at {PIPELINE_PATH}. Train one from ml/ "
            "(python -m training.train --data <dataset.xlsx>) or set CARDIO_MODEL_DIR."
        )
    pipeline = joblib.load(PIPELINE_PATH)
    with open(METADATA_PATH, encoding="utf-8") as f:
        metadata = json.load(f)
    return pipeline, metadata


def _number(payload, key):
    value = payload.get(key)
    if value is None or value == "":
        return math.nan  # the pipeline's median imputer handles missing labs
    if isinstance(value, bool):
        raise PredictionInputError(f"{key} must be a number")
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise PredictionInputError(f"{key} must be a number") from None
    if not math.isfinite(number):
        raise PredictionInputError(f"{key} must be a finite number")
    return number


def build_features(payload: dict) -> pd.DataFrame:
    """Payload -> one-row DataFrame in the model's raw input schema."""
    _, metadata = load_model()

    missing = REQUIRED_FIELDS - {k for k, v in payload.items() if v not in (None, "")}
    if missing:
        raise PredictionInputError(f"Missing required fields: {', '.join(sorted(missing))}")

    sex = payload["sex"]
    if sex not in ("M", "F"):
        raise PredictionInputError("sex must be 'M' or 'F'")

    row = {column: _number(payload, key) for key, column in FIELD_MAP.items()}
    row["Sex"] = sex

    age = row["Age"]
    if age < 18:
        raise PredictionInputError("The model was trained on adults only (age 18 or over).")

    for key in BINARY_FIELDS:
        value = row[FIELD_MAP[key]]
        if not math.isnan(value) and value not in (0.0, 1.0):
            raise PredictionInputError(f"{key} must be 0 or 1")

    # Derived features, recomputed rather than trusted.
    h, w = row["Height (cm)"], row["Weight (kg)"]
    row["BMI"] = w / (h / 100) ** 2 if h > 0 and not math.isnan(w) else math.nan
    row["MaxHR"] = 206 - 0.88 * age if sex == "F" else 208 - 0.7 * age

    # Troponin-I: harmonise to ng/mL and set the censoring flags the model saw.
    row.update(_troponin(payload))

    columns = metadata["raw_input_features"]
    unknown = set(row) - set(columns)
    if unknown:  # guards against the schema drifting from the saved model
        raise RuntimeError(f"Features not in the trained model: {sorted(unknown)}")
    return pd.DataFrame([row], columns=columns)


def _troponin(payload):
    flags = {"Troponin_Censored_High": 0, "Troponin_Censored_Low": 0, "Troponin_Censor_Ambiguous": 0}
    value = _number(payload, "troponin_i")
    if math.isnan(value):
        return {"Troponin_I": math.nan, **flags}

    assay = payload.get("troponin_assay")
    if assay not in ASSAYS:
        raise PredictionInputError("troponin_assay must be 'quantitative' or 'high-sensitivity'")
    if value < 0:
        raise PredictionInputError("troponin_i can't be negative")

    qualifier = payload.get("troponin_qualifier")
    if qualifier not in (None, "", ">", "<"):
        raise PredictionInputError("troponin_qualifier must be '>' or '<'")
    if qualifier and assay != "high-sensitivity":
        raise PredictionInputError("Censored troponin results only occur with the high-sensitivity assay")
    if qualifier == ">":
        # ">25000" was capped at 25000; ">2.5" was ambiguous and treated as missing.
        if value >= HS_CENSOR_HIGH_NG_L:
            flags["Troponin_Censored_High"] = 1
            value = HS_CENSOR_HIGH_NG_L
        else:
            flags["Troponin_Censor_Ambiguous"] = 1
            return {"Troponin_I": math.nan, **flags}
    elif qualifier == "<":
        flags["Troponin_Censored_Low"] = 1
        value = HS_CENSOR_LOW_NG_L

    return {"Troponin_I": value * ASSAYS[assay], **flags}


def risk_level(probability: float) -> str:
    return next(label for upper, label in RISK_BANDS if probability < upper)


def predict(payload: dict, top_n: int = 5) -> dict:
    """The /api/predict/ response for one patient."""
    pipeline, _ = load_model()
    features = build_features(payload)
    probability = float(pipeline.predict_proba(features)[0, 1])
    return {
        "probability": round(probability, 4),
        "risk_level": risk_level(probability),
        "top_factors": explainability_service.top_factors(pipeline, features, top_n=top_n),
    }
