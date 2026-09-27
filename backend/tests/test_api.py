import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from predictor.models import Assessment, Profile

pytestmark = pytest.mark.django_db


@pytest.fixture
def client(user):
    """Signed in as `user` (conftest.py): every endpoint here needs an account."""
    api = APIClient()
    api.force_login(user)
    return api


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


def test_assessments_belong_to_the_user_and_their_profile(trained, client, user, patient, profile_body):
    client.put(reverse("profile"), profile_body, format="json")
    client.post(reverse("predict"), patient, format="json")
    saved = Assessment.objects.get()
    assert saved.user == user and saved.profile == Profile.objects.get(user=user)


# ---------- /api/profile/ ----------

def demo_profile():
    """The profile migration 0002 seeds. It belongs to no account."""
    from predictor.serializers import ProfileSerializer

    return ProfileSerializer(Profile.objects.get(user__isnull=True)).data


def test_new_user_does_not_see_the_demo_profile(client):
    assert client.get(reverse("profile")).status_code == 404


def test_demo_profile_is_seeded_and_valid(client):
    """Migration 0002 adds a demo profile that the API itself would accept."""
    demo = demo_profile()
    assert demo["full_name"] == "Nadia Rahman"
    assert demo["photo"].startswith("data:image/jpeg;base64,")
    assert client.put(reverse("profile"), demo, format="json").status_code == 200


def test_demo_profile_has_a_location():
    demo = demo_profile()
    assert (demo["city"], demo["country"], demo["timezone"]) == ("Dhaka", "Bangladesh", "Asia/Dhaka")


DHAKA = {"city": "Dhaka", "country": "Bangladesh", "country_code": "bd", "timezone": "Asia/Dhaka",
         "latitude": 23.71, "longitude": 90.41}


def test_profile_location_round_trip_and_clear(client, profile_body):
    saved = client.put(reverse("profile"), {**profile_body, **DHAKA}, format="json").json()
    assert saved["timezone"] == "Asia/Dhaka" and saved["country_code"] == "BD" and saved["latitude"] == 23.71

    cleared = {**profile_body, **{k: "" for k in DHAKA}}
    saved = client.put(reverse("profile"), cleared, format="json").json()
    assert saved["city"] == "" and saved["latitude"] == ""  # blanks come back as the frontend sends them


def test_profile_country_without_city_is_valid(client, profile_body):
    country_only = {"city": "", "country": "Bangladesh", "country_code": "BD", "timezone": "Asia/Dhaka",
                    "latitude": 24, "longitude": 90, "state": "Sylhet Division"}
    saved = client.put(reverse("profile"), {**profile_body, **country_only}, format="json").json()
    assert saved["city"] == "" and saved["state"] == "Sylhet Division" and saved["timezone"] == "Asia/Dhaka"


@pytest.mark.parametrize("change", [
    {**DHAKA, "timezone": "Mars/Olympus"},
    {**DHAKA, "latitude": 123},
    {"city": "Dhaka"},  # typed, not picked: no time zone or coordinates
    {**DHAKA, "country_code": "BGD"},
])
def test_profile_location_validation(client, profile_body, change):
    res = client.put(reverse("profile"), {**profile_body, **change}, format="json")
    assert res.status_code == 400 and res.json()["detail"]


def test_profile_is_404_once_deleted(client, profile_body):
    client.put(reverse("profile"), profile_body, format="json")
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
    assert Profile.objects.filter(user__isnull=False).count() == 1  # PUT replaces, never duplicates
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
    assessment, profile = Assessment.objects.get(), Profile.objects.get(user__isnull=False)
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
