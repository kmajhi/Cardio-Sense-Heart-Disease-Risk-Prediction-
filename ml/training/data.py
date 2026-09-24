"""Load and clean the Northern Bangladesh heart disease dataset.

A direct port of sections 4–7 of the research notebook
(ml/notebooks/Northern_Bangladesh_Heart_Disease_ML_Final.ipynb), so the
backend trains on exactly the population the research describes.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

SHEET = "Our Dataset"
TARGET = "Heart_Disease"

# SL is an identifier. UNIT (General vs CCU) is admission context that leaks the
# outcome. Assay type / its missingness is also strongly outcome-associated, so it
# is excluded; Troponin-I itself is kept after harmonising units.
EXCLUDED_COLUMNS = ["SL", "UNIT", "Troponin_Assay_Type"]

HS_ASSAY = "High-Sensitivity Troponin-I (ng/L)"
QUANT_ASSAY = "Quantitative Troponin-I (ng/mL)"

# Censored lab strings seen in the data (all from the high-sensitivity assay).
CENSOR_HIGH_VALUE = 25000.0  # ">25000"
CENSOR_LOW_VALUE = 2.50  # "<2.50"

REQUIRED_COLUMNS = {
    "SL", "Age", "Sex", "Height (cm)", "Weight (kg)", "BMI", "Family H/O",
    "Hypertension", "Diabetes", "Total_Cholesterol(mg/dL)", "BP(mmHg)",
    "H/O ChestPain", "RBS(mmol/L)", "HDL(mg/dL)", "LDL(mg/dL)",
    "Triglycerides(mg/dL)", "MaxHR", "Himoglobin", "Creatinine(mg/dL)",
    "Platelets", "Sodium(mmol/L)", "Potassium", "Chloride", "Troponin_I",
    "Troponin_Assay_Type", TARGET, "UNIT",
}


def load_raw(path: str | Path) -> pd.DataFrame:
    xls = pd.ExcelFile(path)
    sheet = SHEET if SHEET in xls.sheet_names else xls.sheet_names[0]
    return pd.read_excel(xls, sheet_name=sheet)


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Section 4: trim/collapse header whitespace, rename, fix text-typed numbers."""
    df = df.copy()
    df.columns = df.columns.astype(str).str.strip().str.replace(r"\s+", " ", regex=True)
    df = df.rename(columns={
        "Troponin-I": "Troponin_I",
        "Troponin- I assay type": "Troponin_Assay_Type",
        "Heart Disease": TARGET,
    })

    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f"Dataset is missing required columns: {sorted(missing)}")

    # These three arrive as text with stray backticks, comma decimals and
    # spaces before the decimal point.
    for col in ["Himoglobin", "Potassium", "Chloride"]:
        s = df[col].astype("string")
        s = s.str.replace("`", "", regex=False).str.replace(",", ".", regex=False)
        s = s.str.replace(r"(?<=\d)\s+\.(?=\d)", ".", regex=True)
        # float64 explicitly: pandas picks nullable Int64 for all-integer text.
        df[col] = pd.to_numeric(s, errors="coerce").astype("float64")
    return df


def harmonize_troponin(df: pd.DataFrame) -> pd.DataFrame:
    """Section 5: parse censored values, flag them, and convert ng/L to ng/mL."""
    df = df.copy()
    s = df["Troponin_I"].astype("string").str.strip()
    high = s.str.fullmatch(r">\s*25000").fillna(False).astype(bool)
    low = s.str.fullmatch(r"<\s*2\.50").fillna(False).astype(bool)
    ambiguous = s.str.fullmatch(r">\s*2\.5").fillna(False).astype(bool)

    df["Troponin_Censored_High"] = high.astype(int)
    df["Troponin_Censored_Low"] = low.astype(int)
    df["Troponin_Censor_Ambiguous"] = ambiguous.astype(int)

    t = pd.to_numeric(s.str.replace(r"^[<>]\s*", "", regex=True), errors="coerce").astype("float64")
    t.loc[high] = CENSOR_HIGH_VALUE
    t.loc[low] = CENSOR_LOW_VALUE
    t.loc[ambiguous] = np.nan
    df["Troponin_I"] = t

    hs = df["Troponin_Assay_Type"].eq(HS_ASSAY)
    df.loc[hs & df["Troponin_I"].notna(), "Troponin_I"] /= 1000.0  # ng/L -> ng/mL
    return df


def exclude_pediatric(df: pd.DataFrame) -> pd.DataFrame:
    """Section 6: under-18 records are outside the modeling population."""
    df = df.copy()
    df["Age"] = pd.to_numeric(df["Age"], errors="coerce")
    return df.loc[~(df["Age"] < 18)].copy()


def build_modeling_frame(raw: pd.DataFrame) -> pd.DataFrame:
    """Sections 4–7 end to end: raw sheet -> modeling population with target."""
    df = normalize_columns(raw)
    df = harmonize_troponin(df)
    df = exclude_pediatric(df)
    df = df.drop(columns=EXCLUDED_COLUMNS)
    df[TARGET] = df[TARGET].astype(int)
    return df


def split_xy(df_model: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    y = df_model[TARGET].astype(int)
    X = df_model.drop(columns=[TARGET])
    return X, y
