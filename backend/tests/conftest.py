import pytest

from predictor.services.model_store import PIPELINE_PATH


@pytest.fixture(autouse=True)
def fresh_throttle_counts():
    """The login rate limit counts in the cache; each test starts from zero."""
    from django.core.cache import cache

    cache.clear()


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user(
        username="nadia@example.com", email="nadia@example.com", password="Correct-Horse-9", first_name="Nadia Rahman")


@pytest.fixture
def anon():
    """A signed-out API client."""
    from rest_framework.test import APIClient

    return APIClient()


@pytest.fixture
def client(client, user):
    """pytest-django's test client, signed in as `user`."""
    client.force_login(user)
    return client


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


@pytest.fixture
def profile_body():
    """What the Profile page's saveProfile() sends (profileFields.js → clean())."""
    return {
        "full_name": " Rahim Uddin ", "photo": "", "email": "rahim@example.com", "phone": "+880 1711 000000",
        "date_of_birth": "1974-03-02", "sex": "M", "height_cm": 168, "weight_kg": "",
        "blood_group": "B+", "hypertension": 1, "diabetes": 0, "family_history": None,
        "chest_pain_history": None, "smoker": "former", "activity": "moderate",
        "medications": ["Amlodipine 5 mg"], "allergies": [], "emergency_name": "", "emergency_phone": "",
        "connections": {}, "created_at": "2020-01-01T00:00:00Z", "updated_at": "2020-01-01T00:00:00Z",
    }
