"""Wraps the saved sklearn pipeline for POST /api/predict/.

Request body (what the frontend's fields.js → toPayload() sends):

    age, sex ('M'|'F'), height_cm, weight_kg, family_history, hypertension,
    diabetes, chest_pain_history (0|1), bp_mmhg, rbs_mmol_l, total_cholesterol,
    hdl, ldl, triglycerides, hemoglobin, creatinine, platelets (count/µL),
    sodium, potassium, chloride, troponin_i, troponin_assay
    ('quantitative' ng/mL | 'high-sensitivity' ng/L), optional
    troponin_qualifier ('>' | '<') for censored lab reports.

Response (the API contract):

    { probability, risk_level, top_factors: [{ name, contribution }],
      missing_fields: [label, ...],
      outside_training: [{ name, value, min, max }, ...], low_confidence: bool }

Values beyond what the training data covered (e.g. age 105 when the oldest
patient was 97, or 150 kg when the heaviest was 101 kg) are accepted: real
patients have them. A tree model treats them like the nearest value it saw,
so they're listed in `outside_training` and the estimate is marked low
confidence. The model only estimates adults: under-18s get a clear refusal
(the training data's children were all heart-disease cases, see ml/README.md).

The core inputs (REQUIRED_FIELDS) must all be present. The other labs may be
left out (sent as null): the pipeline imputes them, and the response names
them in `missing_fields` so the UI never passes an estimate off as complete.

Troponin-I is always validated (the app checks it against clinical limits),
but it only reaches the model if the model was trained with it. The deployed
model is not: troponin runs backwards in the training data (ml/README.md).

`bmi` and `max_hr` are ignored if sent: both are formulas of other inputs in
the source data, so they're always recomputed here.
"""

from __future__ import annotations

import json
import math
import threading
from functools import lru_cache

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier

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
# An estimate needs these: anthropometrics, history, blood pressure and the
# lipid panel. Without them almost every input would be imputed.
REQUIRED_FIELDS = {
    "age", "sex", "height_cm", "weight_kg", "bp_mmhg", "total_cholesterol", "hdl", "ldl", "triglycerides",
    *BINARY_FIELDS,
}
# Labs that may be "not measured": imputed by the pipeline and reported back.
OPTIONAL_FIELDS = {
    "rbs_mmol_l": "Random blood sugar",
    "hemoglobin": "Hemoglobin",
    "creatinine": "Creatinine",
    "platelets": "Platelets",
    "sodium": "Sodium",
    "potassium": "Potassium",
    "chloride": "Chloride",
}
# This many imputed labs or more and the estimate is flagged as low confidence.
LOW_CONFIDENCE_MISSING = 3

# Physiologically possible adult values, in payload units. Anything outside is
# a typo or a unit mix-up, so it's rejected rather than scored. The frontend's
# fields.js has the same limits. Possible is not the same as covered by the
# training data: see outside_training().
# The accepted range per input: the same range the Prediction page's sliders show
# (frontend/src/pages/Prediction/fields.js). Wide enough for real patients,
# including the urgent values the clinical checks flag; anything beyond is
# refused as a typo or a unit mix-up.
LIMITS = {
    "age": (18, 110),  # under 18 is refused separately, with its own message
    "height_cm": (120, 210),
    "weight_kg": (30, 200),
    "bp_mmhg": (70, 250),
    "rbs_mmol_l": (1.5, 35),
    "total_cholesterol": (80, 400),
    "hdl": (10, 120),
    "ldl": (30, 300),
    "triglycerides": (30, 1000),
    "hemoglobin": (3, 20),
    "creatinine": (0.2, 15),
    "platelets": (20_000, 800_000),
    "sodium": (110, 165),
    "potassium": (1.5, 8),
    "chloride": (75, 135),
}
MAX_TROPONIN_NG_ML = 500.0  # = 500,000 ng/L on the high-sensitivity assay
# BMI outside this means the height or weight was mistyped (the extremes ever
# recorded are about 7 and 200; 10-150 leaves room for both real tails).
BMI_LIMITS = (10, 150)

ADULTS_ONLY = (
    "Cardio Sense estimates heart disease risk for adults (18 or over) only. The training data "
    "had no healthy children (all 13 under-18 records were heart-disease cases), so the model "
    "can't estimate a child's risk. For a child, see a paediatrician or paediatric cardiologist."
)

# Payload key → the label the result uses when a value is outside the training data.
TRAINING_LABELS = {
    "age": ("Age", "Age", "years"),
    "height_cm": ("Height (cm)", "Height", "cm"),
    "weight_kg": ("Weight (kg)", "Weight", "kg"),
    "bmi": ("BMI", "BMI", "kg/m²"),
    "bp_mmhg": ("BP(mmHg)", "Blood pressure", "mmHg"),
    "rbs_mmol_l": ("RBS(mmol/L)", "Random blood sugar", "mmol/L"),
    "total_cholesterol": ("Total_Cholesterol(mg/dL)", "Total cholesterol", "mg/dL"),
    "hdl": ("HDL(mg/dL)", "HDL", "mg/dL"),
    "ldl": ("LDL(mg/dL)", "LDL", "mg/dL"),
    "triglycerides": ("Triglycerides(mg/dL)", "Triglycerides", "mg/dL"),
    "hemoglobin": ("Himoglobin", "Hemoglobin", "g/dL"),
    "creatinine": ("Creatinine(mg/dL)", "Creatinine", "mg/dL"),
    "platelets": ("Platelets", "Platelets", "/µL"),
    "sodium": ("Sodium(mmol/L)", "Sodium", "mmol/L"),
    "potassium": ("Potassium", "Potassium", "mmol/L"),
    "chloride": ("Chloride", "Chloride", "mmol/L"),
}


class PredictionInputError(ValueError):
    """The request can't be turned into a valid model input."""


_load_lock = threading.Lock()


def _fast_forest_proba(forest):
    """forest.predict_proba, computed by calling each tree directly.

    sklearn dispatches every tree through joblib, which costs ~0.15 ms per tree;
    the deployed model has 5 calibrated forests x 400 trees, so that overhead
    was most of a prediction. On Render's free CPU it made a prediction take long
    enough that the 5-second health check timed out and Render restarted the API
    mid-request (the prediction never answered). Same numbers, ~5x less CPU
    (test_fast_forest_matches_sklearn)."""
    trees = [est.tree_ for est in forest.estimators_]

    def predict_proba(X):
        X = np.ascontiguousarray(X, dtype=np.float32)
        total = np.zeros((X.shape[0], forest.n_classes_))
        for tree in trees:
            leaf = tree.predict(X)
            total += leaf[:, 0, :] if leaf.ndim == 3 else leaf
        total /= len(trees)
        return total

    return predict_proba


def _speed_up(pipeline):
    """Swap in the fast predict_proba on every random forest in the pipeline."""
    model = pipeline.named_steps["model"]
    forests = [cc.estimator for cc in getattr(model, "calibrated_classifiers_", [])] or [model]
    for forest in forests:
        if isinstance(forest, RandomForestClassifier) and forest.n_outputs_ == 1:
            forest.predict_proba = _fast_forest_proba(forest)
    return pipeline


@lru_cache(maxsize=1)
def _load_model():
    if not PIPELINE_PATH.exists():
        raise FileNotFoundError(
            f"No trained model at {PIPELINE_PATH}. Train one from ml/ "
            "(python -m training.train --data <dataset.xlsx>) or set CARDIO_MODEL_DIR."
        )
    pipeline = _speed_up(joblib.load(PIPELINE_PATH))
    with open(METADATA_PATH, encoding="utf-8") as f:
        metadata = json.load(f)
    return pipeline, metadata


def load_model():
    """(pipeline, metadata), loaded once per process. The lock makes concurrent
    first requests (gunicorn threads) wait for one load instead of each loading
    a copy: the deployment has 512 MB, and a second copy would overflow it."""
    with _load_lock:
        return _load_model()


load_model.cache_info = _load_model.cache_info
load_model.cache_clear = _load_model.cache_clear


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
    if number < 0:
        raise PredictionInputError(f"{key} can't be negative")
    return number


def build_features(payload: dict) -> pd.DataFrame:
    """Payload -> one-row DataFrame in the model's raw input schema."""
    _, metadata = load_model()

    missing = REQUIRED_FIELDS - given(payload)
    if missing:
        raise PredictionInputError(f"Missing required fields: {', '.join(sorted(missing))}")

    sex = payload["sex"]
    if sex not in ("M", "F"):
        raise PredictionInputError("sex must be 'M' or 'F'")

    row = {column: _number(payload, key) for key, column in FIELD_MAP.items()}
    row["Sex"] = sex

    age = row["Age"]
    if age < 18:
        raise PredictionInputError(ADULTS_ONLY)
    for key, (low, high) in LIMITS.items():
        value = row[FIELD_MAP[key]]
        if not math.isnan(value) and not low <= value <= high:
            raise PredictionInputError(f"{key} must be between {low:g} and {high:g}")

    for key in BINARY_FIELDS:
        value = row[FIELD_MAP[key]]
        if not math.isnan(value) and value not in (0.0, 1.0):
            raise PredictionInputError(f"{key} must be 0 or 1")

    # Derived features, recomputed rather than trusted.
    h, w = row["Height (cm)"], row["Weight (kg)"]
    row["BMI"] = w / (h / 100) ** 2 if h > 0 and not math.isnan(w) else math.nan
    if not math.isnan(row["BMI"]) and not BMI_LIMITS[0] <= row["BMI"] <= BMI_LIMITS[1]:
        raise PredictionInputError(
            f"Height {h:g} cm and weight {w:g} kg give a BMI of {row['BMI']:.0f}, which isn't possible. "
            "Check both values and their units."
        )
    row["MaxHR"] = 206 - 0.88 * age if sex == "F" else 208 - 0.7 * age

    # Troponin-I: always validated; harmonised to ng/mL with the censoring
    # flags, but only passed on if this model was trained with it.
    troponin = _troponin(payload)
    columns = metadata["raw_input_features"]
    if "Troponin_I" in columns:
        row.update(troponin)

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
    if not isinstance(assay, str) or assay not in ASSAYS:
        raise PredictionInputError("troponin_assay must be 'quantitative' or 'high-sensitivity'")
    if value * ASSAYS[assay] > MAX_TROPONIN_NG_ML:
        unit_max = MAX_TROPONIN_NG_ML / ASSAYS[assay]
        raise PredictionInputError(f"troponin_i must be {unit_max:g} or under for this assay")

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


def given(payload: dict) -> set[str]:
    return {k for k, v in payload.items() if v not in (None, "")}


def missing_fields(payload: dict) -> list[str]:
    """Labels of the optional labs left out (imputed), in form order."""
    present = given(payload)
    return [label for key, label in OPTIONAL_FIELDS.items() if key not in present]


def outside_training(features: pd.DataFrame) -> list[dict]:
    """Entered (or derived) values beyond the range the model was trained on."""
    _, metadata = load_model()
    ranges = {e["name"]: (e["min"], e["max"]) for e in metadata.get("feature_schema", []) if "min" in e}
    row = features.iloc[0]
    out = []
    for column, label, unit in TRAINING_LABELS.values():
        if column not in ranges or column not in row or pd.isna(row[column]):
            continue
        low, high = ranges[column]
        value = float(row[column])
        if value < low or value > high:
            out.append({"name": label, "value": round(value, 2), "min": low, "max": high, "unit": unit})
    return out


def risk_level(probability: float) -> str:
    return next(label for upper, label in RISK_BANDS if probability < upper)


def predict(payload: dict, top_n: int = 5) -> dict:
    """The /api/predict/ response for one patient."""
    pipeline, _ = load_model()
    features = build_features(payload)
    # One pass gives both the probability and its explanation (they share the
    # model call that dominates the cost; see explainability_service).
    probability, _, values, names = explainability_service.explain(pipeline, features)
    missing = missing_fields(payload)
    beyond = outside_training(features)
    return {
        "probability": round(probability, 4),
        "risk_level": risk_level(probability),
        "top_factors": explainability_service.group_factors(values, names, list(features.columns), top_n),
        "missing_fields": missing,
        "outside_training": beyond,
        "low_confidence": len(missing) >= LOW_CONFIDENCE_MISSING or bool(beyond),
    }
