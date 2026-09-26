import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from predictor.models import Assessment, Profile

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


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


# ---------- /api/predict/ + /api/history/ ----------

def test_predict_returns_the_contract_and_saves_an_assessment(trained, client, patient):
    res = client.post(reverse("predict"), {**patient, "unexpected": "dropped"}, format="json")
    assert res.status_code == 200
    assert set(res.json()) == {"probability", "risk_level", "top_factors"}

    saved = Assessment.objects.get()
    assert saved.probability == res.json()["probability"]
    assert saved.age == 45 and saved.sex == "M"
    assert "unexpected" not in saved.inputs
    assert saved.model_name == "Random Forest"


def test_invalid_input_is_a_400_with_detail_and_not_saved(trained, client, patient):
    res = client.post(reverse("predict"), {**patient, "age": 12}, format="json")
    assert res.status_code == 400
    assert "adults" in res.json()["detail"]
    assert not Assessment.objects.exists()


def test_predict_rejects_non_object_body(client):
    res = client.post(reverse("predict"), [1, 2], format="json")
    assert res.status_code == 400


def test_history_lists_records_oldest_first_and_deletes(trained, client, patient):
    client.post(reverse("predict"), patient, format="json")
    client.post(reverse("predict"), {**patient, "age": 70}, format="json")

    records = client.get(reverse("history")).json()
    assert [r["inputs"]["age"] for r in records] == [45, 70]
    first = records[0]
    assert set(first) == {"id", "created_at", "inputs", "result"}
    assert first["id"].startswith("A-")
    assert set(first["result"]) == {"probability", "risk_level", "top_factors"}

    assert client.delete(reverse("history-record", args=[first["id"]])).status_code == 204
    assert client.delete(reverse("history-record", args=[first["id"]])).status_code == 404
    assert client.delete(reverse("history-record", args=["A-²"])).status_code == 404
    assert len(client.get(reverse("history")).json()) == 1


def test_assessments_link_to_the_profile(trained, client, patient, profile_body):
    client.put(reverse("profile"), profile_body, format="json")
    client.post(reverse("predict"), patient, format="json")
    assert Assessment.objects.get().profile == Profile.objects.get()


# ---------- /api/profile/ ----------

def test_demo_profile_is_seeded_and_valid(client):
    """Migration 0002 adds a demo profile that the API itself would accept."""
    demo = client.get(reverse("profile")).json()
    assert demo["full_name"] == "Nadia Rahman"
    assert demo["photo"].startswith("data:image/jpeg;base64,")
    assert client.put(reverse("profile"), demo, format="json").status_code == 200


def test_profile_is_404_once_deleted(client):
    client.delete(reverse("profile"))
    res = client.get(reverse("profile"))
    assert res.status_code == 404 and res.json()["detail"]


def test_profile_round_trip(client, profile_body):
    saved = client.put(reverse("profile"), profile_body, format="json").json()
    assert saved["full_name"] == "Rahim Uddin"
    assert saved["weight_kg"] == ""  # blanks come back as the frontend sends them
    assert saved["family_history"] is None
    assert saved["created_at"] != "2020-01-01T00:00:00Z"  # timestamps are the server's

    assert client.get(reverse("profile")).json() == saved

    client.put(reverse("profile"), {**profile_body, "weight_kg": 76.5}, format="json")
    assert Profile.objects.count() == 1  # PUT replaces, never duplicates
    assert client.get(reverse("profile")).json()["weight_kg"] == 76.5


@pytest.mark.parametrize("change", [
    {"full_name": "  "},
    {"height_cm": 20},
    {"email": "not-an-email"},
    {"photo": "data:text/html;base64,PHNjcmlwdD4="},
    {"medications": "aspirin"},
    {"hypertension": 2},
])
def test_profile_validation_is_a_400_with_detail(client, profile_body, change):
    res = client.put(reverse("profile"), {**profile_body, **change}, format="json")
    assert res.status_code == 400
    assert res.json()["detail"]


def test_profile_delete_keeps_assessments(trained, client, patient, profile_body):
    client.put(reverse("profile"), profile_body, format="json")
    client.post(reverse("predict"), patient, format="json")
    assert client.delete(reverse("profile")).status_code == 204
    assert client.get(reverse("profile")).status_code == 404
    assert Assessment.objects.get().profile is None


# ---------- Admin ----------

def test_admin_pages_render(trained, client, patient, profile_body, admin_client):
    client.put(reverse("profile"), profile_body, format="json")
    client.post(reverse("predict"), patient, format="json")
    assessment, profile = Assessment.objects.get(), Profile.objects.get()
    for url in [
        reverse("admin:predictor_assessment_changelist"),
        reverse("admin:predictor_assessment_change", args=[assessment.pk]),
        reverse("admin:predictor_profile_changelist"),
        reverse("admin:predictor_profile_change", args=[profile.pk]),
    ]:
        assert admin_client.get(url).status_code == 200, url

    export = admin_client.post(reverse("admin:predictor_assessment_changelist"),
                               {"action": "export_csv", "_selected_action": [assessment.pk]})
    assert export["Content-Type"] == "text/csv"
    assert b"A-0001" in export.content or assessment.reference.encode() in export.content
