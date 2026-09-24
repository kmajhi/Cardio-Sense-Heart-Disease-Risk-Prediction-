"""Where the trained model lives.

Training (ml/) writes the artifacts; the backend only reads them. By default
that's <repo>/ml/artifacts. Set CARDIO_MODEL_DIR to point elsewhere, e.g.
when the backend is deployed without the ml/ folder.
"""

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
MODEL_DIR = Path(os.environ.get("CARDIO_MODEL_DIR", REPO_ROOT / "ml" / "artifacts"))

PIPELINE_PATH = MODEL_DIR / "heart_disease_inference_pipeline.joblib"
METADATA_PATH = MODEL_DIR / "model_metadata.json"
SHAP_BACKGROUND_PATH = MODEL_DIR / "shap_background.joblib"
