import json
import os
from pathlib import Path

import joblib
import pytest

ARTIFACTS = Path(__file__).resolve().parents[1] / "artifacts"
DEFAULT_DATASET = Path(__file__).resolve().parents[1] / "data" / "Heart_diasease_dataset_from_Northern_Bangladesh.xlsx"


@pytest.fixture(scope="session")
def dataset_path():
    """The raw .xlsx (never committed). Uses HEART_DATASET, else ml/data/."""
    path = Path(os.environ.get("HEART_DATASET", DEFAULT_DATASET))
    if not path.exists():
        pytest.skip("Dataset not found; put it in ml/data/ or set HEART_DATASET")
    return path


@pytest.fixture(scope="session")
def artifacts():
    """(pipeline, metadata) from ml/artifacts, or skip if not trained yet."""
    pipeline_path = ARTIFACTS / "heart_disease_inference_pipeline.joblib"
    if not pipeline_path.exists():
        pytest.skip("No trained model; run `python -m training.train --data <xlsx>` first")
    with open(ARTIFACTS / "model_metadata.json", encoding="utf-8") as f:
        return joblib.load(pipeline_path), json.load(f)
