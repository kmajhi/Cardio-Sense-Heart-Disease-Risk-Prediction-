import pytest

from predictor.services.model_store import PIPELINE_PATH


@pytest.fixture(scope="session")
def trained():
    if not PIPELINE_PATH.exists():
        pytest.skip("No trained model in ml/artifacts; train it from ml/ first")
    from predictor.services import prediction_service

    return prediction_service.load_model()


@pytest.fixture
def patient():
    """A complete, valid request body (the frontend's median defaults)."""
    return {
        "age": 45, "sex": "M", "height_cm": 159, "weight_kg": 63,
        "family_history": 0, "hypertension": 0, "diabetes": 0, "chest_pain_history": 0,
        "bp_mmhg": 115, "rbs_mmol_l": 6.7, "total_cholesterol": 200, "hdl": 45, "ldl": 120,
        "triglycerides": 150, "hemoglobin": 12.7, "creatinine": 1.0, "platelets": 270000,
        "sodium": 139, "potassium": 4.1, "chloride": 101,
        "troponin_i": 0.5, "troponin_assay": "quantitative",
    }
