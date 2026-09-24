"""Per-prediction SHAP explanations, grouped back to the fields a user entered.

Contributions are in probability units (0.08 = raised the estimate by 8
percentage points), matching what the frontend renders.
"""

from __future__ import annotations

from functools import lru_cache

import joblib
import numpy as np
import shap
from sklearn.ensemble import RandomForestClassifier
from sklearn.tree import DecisionTreeClassifier

from .model_store import SHAP_BACKGROUND_PATH

# Raw dataset column -> the label the UI uses for that input.
LABELS = {
    "Age": "Age",
    "Sex": "Sex",
    "Height (cm)": "Height",
    "Weight (kg)": "Weight",
    "BMI": "BMI",
    "Family H/O": "Family history of heart disease",
    "Hypertension": "Hypertension",
    "Diabetes": "Diabetes",
    "Total_Cholesterol(mg/dL)": "Total cholesterol",
    "BP(mmHg)": "Blood pressure",
    "H/O ChestPain": "History of chest pain",
    "RBS(mmol/L)": "Random blood sugar",
    "HDL(mg/dL)": "HDL",
    "LDL(mg/dL)": "LDL",
    "Triglycerides(mg/dL)": "Triglycerides",
    "MaxHR": "Max heart rate",
    "Himoglobin": "Hemoglobin",
    "Creatinine(mg/dL)": "Creatinine",
    "Platelets": "Platelets",
    "Sodium(mmol/L)": "Sodium",
    "Potassium": "Potassium",
    "Chloride": "Chloride",
    # Troponin value and its censoring flags are one input to the user.
    "Troponin_I": "Troponin-I",
    "Troponin_Censored_High": "Troponin-I",
    "Troponin_Censored_Low": "Troponin-I",
    "Troponin_Censor_Ambiguous": "Troponin-I",
}


def raw_feature(transformed_name: str, raw_columns: list[str]) -> str:
    """'num__missingindicator_HDL(mg/dL)' -> 'HDL(mg/dL)', 'cat__Sex_M' -> 'Sex'."""
    name = transformed_name.split("__", 1)[-1]
    name = name.removeprefix("missingindicator_")
    if name in raw_columns:
        return name
    # One-hot columns are '<feature>_<category>'; pick the longest matching feature.
    matches = [c for c in raw_columns if name.startswith(f"{c}_")]
    return max(matches, key=len) if matches else name


@lru_cache(maxsize=4)
def _explainer(pipeline):
    clf = pipeline.named_steps["model"]
    if isinstance(clf, (RandomForestClassifier, DecisionTreeClassifier)):
        # Tree SHAP on a sklearn classifier explains predict_proba directly.
        return shap.TreeExplainer(clf), "tree"
    background = joblib.load(SHAP_BACKGROUND_PATH)
    return shap.Explainer(lambda z: clf.predict_proba(z)[:, 1], background), "generic"


def shap_values(pipeline, features) -> tuple[np.ndarray, list[str]]:
    """SHAP values (positive class, probability units) for one transformed row."""
    pre = pipeline.named_steps["preprocess"]
    x = pre.transform(features)
    explainer, kind = _explainer(pipeline)
    if kind == "tree":
        values = np.asarray(explainer.shap_values(x, check_additivity=False))
        values = values[0, :, 1] if values.ndim == 3 else values[0]
    else:
        values = np.asarray(explainer(x, max_evals=max(2 * x.shape[1] + 1, 100)).values)[0]
    return values, pre.get_feature_names_out().tolist()


def top_factors(pipeline, features, top_n: int = 5) -> list[dict]:
    values, names = shap_values(pipeline, features)
    raw_columns = list(features.columns)

    grouped: dict[str, float] = {}
    for name, value in zip(names, values):
        label = LABELS.get(raw_feature(name, raw_columns), raw_feature(name, raw_columns))
        grouped[label] = grouped.get(label, 0.0) + float(value)

    ranked = sorted(grouped.items(), key=lambda item: abs(item[1]), reverse=True)
    return [{"name": name, "contribution": round(value, 4)} for name, value in ranked[:top_n]]
