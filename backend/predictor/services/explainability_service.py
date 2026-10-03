"""Per-prediction SHAP explanations, grouped back to the fields a user entered.

Contributions are in probability units (0.08 = raised the estimate by 8
percentage points), matching what the frontend renders.
"""

from __future__ import annotations

import threading
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


_explainer_lock = threading.Lock()


@lru_cache(maxsize=4)
def _build_explainer(pipeline):
    clf = pipeline.named_steps["model"]
    if isinstance(clf, (RandomForestClassifier, DecisionTreeClassifier)):
        # Tree SHAP on a sklearn classifier explains predict_proba directly.
        return shap.TreeExplainer(clf), "tree"
    # Anything else, including the deployed calibrated forest: model-agnostic
    # permutation SHAP against the k-means background (see _permutation_shap).
    return np.asarray(joblib.load(SHAP_BACKGROUND_PATH), dtype=float), "generic"


def _explainer(pipeline):
    """Built once per model; concurrent first requests wait for that one build."""
    with _explainer_lock:
        return _build_explainer(pipeline)


_explainer.cache_info = _build_explainer.cache_info
_explainer.cache_clear = _build_explainer.cache_clear


# Fixed seed: the same inputs always get the same explanation.
_SEED = 0


def _permutation_shap(predict_positive, background, x, seed=_SEED):
    """Permutation SHAP for one row: the same numbers as shap's Permutation
    explainer (shap.Explainer(f, background) with np.random.seed(seed) and
    max_evals = max(2 * n_features + 1, 100)), computed with ONE model call.

    The deployed model is 5 calibrated forests of 400 trees; each predict_proba
    costs about 0.45 s however many rows it gets. shap scores each permutation
    in its own call; scoring every masked row of every permutation together
    (and reading the patient's own probability off the same call) makes a
    prediction about 3x faster. A private RandomState gives the same shuffles as
    reseeding numpy's global generator, so concurrent requests no longer queue
    behind a global lock.

    Returns (probability, expected_value, values): values per transformed
    feature, in probability units, and expected_value + values.sum() == probability.
    """
    x = np.asarray(x, dtype=float).reshape(-1)
    n_features = x.shape[0]
    # Features where the patient differs from some background row; the rest get 0.
    varying = np.where(np.any(~np.isclose(x, background), axis=0))[0]
    if len(varying) == 0:
        probability = float(predict_positive(background).mean())
        return probability, probability, np.zeros(n_features)

    k = len(varying)
    steps = 2 * k + 1  # all off, switch each on (forward), then each off again (backward)
    permutations = max(2 * n_features + 1, 100) // steps
    rng = np.random.RandomState(seed)
    order = varying.copy()
    orders = []
    for _ in range(permutations):
        rng.shuffle(order)  # shuffled in place each time, as shap does
        orders.append(order.copy())

    # Every state of every permutation, as on/off masks over the features.
    masks = np.zeros((permutations, steps, n_features), dtype=bool)
    for p, perm in enumerate(orders):
        for j, feature in enumerate(perm):
            masks[p, j + 1 :, feature] = True  # on from forward step j+1 ...
            masks[p, k + j + 1 :, feature] = False  # ... off again from backward step j+1
    rows = np.where(masks[:, :, None, :], x, background[None, None, :, :])  # (perm, step, bg, feature)
    outputs = predict_positive(rows.reshape(-1, n_features)).reshape(permutations, steps, len(background)).mean(axis=2)

    values = np.zeros(n_features)
    for p, perm in enumerate(orders):
        out = outputs[p]
        for j, feature in enumerate(perm):
            values[feature] += out[j + 1] - out[j]  # switching it on
            values[feature] += out[k + j] - out[k + j + 1]  # switching it off
    values /= 2 * permutations
    return float(outputs[0, k]), float(outputs[0, 0]), values


def explain(pipeline, features) -> tuple[float, float, np.ndarray, list[str]]:
    """(probability, expected_value, SHAP values per transformed feature, their names)."""
    pre = pipeline.named_steps["preprocess"]
    x = pre.transform(features)
    explainer, kind = _explainer(pipeline)
    if kind == "tree":
        values = np.asarray(explainer.shap_values(x, check_additivity=False))
        values = values[0, :, 1] if values.ndim == 3 else values[0]
        expected = float(np.asarray(explainer.expected_value).reshape(-1)[-1])
        probability = float(pipeline.named_steps["model"].predict_proba(x)[0, 1])
    else:
        clf = pipeline.named_steps["model"]
        probability, expected, values = _permutation_shap(lambda z: clf.predict_proba(z)[:, 1], explainer, x)
    return probability, expected, values, pre.get_feature_names_out().tolist()


def shap_values(pipeline, features) -> tuple[np.ndarray, list[str]]:
    """SHAP values (positive class, probability units) for one transformed row."""
    _, _, values, names = explain(pipeline, features)
    return values, names


def group_factors(values, names, raw_columns, top_n: int = 5) -> list[dict]:
    """Transformed-feature SHAP values summed per input the user entered, largest first."""
    grouped: dict[str, float] = {}
    for name, value in zip(names, values):
        label = LABELS.get(raw_feature(name, raw_columns), raw_feature(name, raw_columns))
        grouped[label] = grouped.get(label, 0.0) + float(value)

    ranked = sorted(grouped.items(), key=lambda item: abs(item[1]), reverse=True)
    return [{"name": name, "contribution": round(value, 4)} for name, value in ranked[:top_n]]


def top_factors(pipeline, features, top_n: int = 5) -> list[dict]:
    values, names = shap_values(pipeline, features)
    return group_factors(values, names, list(features.columns), top_n)
