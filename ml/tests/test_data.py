import numpy as np
import pandas as pd
import pytest

from training.data import (
    EXCLUDED_COLUMNS,
    HS_ASSAY,
    QUANT_ASSAY,
    TARGET,
    build_modeling_frame,
    harmonize_troponin,
    load_raw,
    normalize_columns,
)


def raw_frame(**overrides):
    """One minimal raw row with the dataset's original headers."""
    row = {
        "SL": 1, "Age": 50, "Sex": "M", "Height (cm)": 160, "Weight (kg)": 64, "BMI": 25.0,
        "Family H/O": 0, "Hypertension": 1, "Diabetes": 0, "Total_Cholesterol(mg/dL)": 200,
        "BP(mmHg)": 120, "H/O ChestPain": 0, "RBS(mmol/L)": 6.0, "HDL(mg/dL)": 45,
        "LDL(mg/dL)": 120, "Triglycerides(mg/dL)": 150, "MaxHR": 173.0, "Himoglobin": "12.5",
        "Creatinine(mg/dL)": 1.0, "Platelets": 250000, "Sodium(mmol/L)": 139, "Potassium": "4.1",
        "Chloride": "101", "Troponin-I": "0.03", "Troponin- I assay type": QUANT_ASSAY,
        "Heart Disease": 1, "UNIT": "General",
    }
    row.update(overrides)
    return pd.DataFrame([row])


# ---------- Unit tests (synthetic rows, no dataset needed) ----------

def test_header_whitespace_is_normalized():
    df = raw_frame().rename(columns={"Sodium(mmol/L)": "  Sodium(mmol/L) "})
    assert "Sodium(mmol/L)" in normalize_columns(df).columns


@pytest.mark.parametrize("text, expected", [("12`.5", 12.5), ("12,5", 12.5), ("12 .5", 12.5), ("abc", np.nan)])
def test_text_numbers_are_repaired(text, expected):
    value = normalize_columns(raw_frame(Himoglobin=text))["Himoglobin"].iloc[0]
    assert (np.isnan(value) and np.isnan(expected)) or value == pytest.approx(expected)


def test_missing_required_column_fails_loudly():
    with pytest.raises(ValueError, match="UNIT"):
        normalize_columns(raw_frame().drop(columns=["UNIT"]))


def test_high_sensitivity_troponin_is_converted_to_ng_ml():
    df = harmonize_troponin(normalize_columns(raw_frame(**{"Troponin-I": "850", "Troponin- I assay type": HS_ASSAY})))
    assert df["Troponin_I"].iloc[0] == pytest.approx(0.85)


def test_quantitative_troponin_is_left_in_ng_ml():
    df = harmonize_troponin(normalize_columns(raw_frame(**{"Troponin-I": "0.03"})))
    assert df["Troponin_I"].iloc[0] == pytest.approx(0.03)


@pytest.mark.parametrize("text, value, high, low, ambiguous", [
    (">25000", 25.0, 1, 0, 0),
    ("<2.50", 0.0025, 0, 1, 0),
    (">2.5", np.nan, 0, 0, 1),
])
def test_censored_troponin(text, value, high, low, ambiguous):
    df = harmonize_troponin(normalize_columns(raw_frame(**{"Troponin-I": text, "Troponin- I assay type": HS_ASSAY})))
    row = df.iloc[0]
    assert (row.Troponin_Censored_High, row.Troponin_Censored_Low, row.Troponin_Censor_Ambiguous) == (high, low, ambiguous)
    assert (np.isnan(value) and np.isnan(row.Troponin_I)) or row.Troponin_I == pytest.approx(value)


def test_children_and_leaky_columns_are_removed():
    raw = pd.concat([raw_frame(Age=12), raw_frame(Age=18)], ignore_index=True)
    df = build_modeling_frame(raw)
    assert df["Age"].tolist() == [18]
    assert not set(EXCLUDED_COLUMNS) & set(df.columns)


# ---------- Dataset tests (need HEART_DATASET) ----------

def test_modeling_population(dataset_path):
    df = build_modeling_frame(load_raw(dataset_path))
    assert len(df) == 1035  # 1048 rows minus 13 under-18 records
    assert df["Age"].min() >= 18
    assert not set(EXCLUDED_COLUMNS) & set(df.columns)
    # Mild imbalance, as documented: ~56.5% / 43.5%.
    assert df[TARGET].mean() == pytest.approx(0.565, abs=0.005)


def test_derived_columns_really_are_formulas(dataset_path):
    """Why the API recomputes BMI and MaxHR instead of accepting them."""
    df = build_modeling_frame(load_raw(dataset_path))
    bmi = df["Weight (kg)"] / (df["Height (cm)"] / 100) ** 2
    max_hr = np.where(df["Sex"] == "F", 206 - 0.88 * df["Age"], 208 - 0.7 * df["Age"])
    assert np.nanmax(np.abs(bmi - df["BMI"])) < 1e-9
    assert np.nanmax(np.abs(max_hr - df["MaxHR"])) < 1e-9
