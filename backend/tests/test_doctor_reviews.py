"""The doctor-review workflow end to end: patient request → doctor claim → draft →
submit → report version 2 and a patient notification, and every rule about who
may see or do what (enforced by the API, never only by the frontend)."""

import io
import json
from pathlib import Path

import pytest
from django.urls import reverse
from pypdf import PdfReader
from rest_framework.test import APIClient

from predictor.models import (Assessment, ClinicalReview, DoctorProfile, Notification, Profile, ReportVersion,
                              ReviewEvent, ReviewRequest)
from predictor.samples import SAMPLES

GUIDANCE = json.loads((Path(__file__).parent / "guidance_samples.json").read_text(encoding="utf-8"))
PASSWORD = "Temporary-Pass-42"
NEW_PASSWORD = "Clinical-Review-77"


def assessment(user, level="moderate", guidance=True):
    inputs = dict(SAMPLES[level])
    return Assessment.objects.create(
        user=user, inputs=inputs, age=inputs["age"], sex=inputs["sex"], probability={"low": 0.08, "moderate": 0.52,
                                                                                    "high": 0.93}[level],
        risk_level=level, top_factors=[{"name": "Age", "contribution": 0.1}], model_name="Random Forest",
        guidance=GUIDANCE[level] if guidance else None)


def make_doctor(django_user_model, email="sarah@example.com", name="Sarah Rahman", **extra):
    user = django_user_model.objects.create_user(username=email, email=email, password=PASSWORD, first_name=name)
    defaults = {"specialty": "Cardiology", "is_verified": True, "must_change_password": False}
    defaults.update(extra)
    return DoctorProfile.objects.create(user=user, **defaults)


def api_as(user):
    c = APIClient()
    c.force_login(user)
    return c


@pytest.fixture
def patient_api(user):
    Profile.objects.create(user=user, full_name="Nadia Rahman")
    return api_as(user)


@pytest.fixture
def doctor(django_user_model):
    return make_doctor(django_user_model)


@pytest.fixture
def doctor_api(doctor):
    return api_as(doctor.user)


def request_review(api, a, question="Is my LDL the main reason?"):
    return api.post(reverse("reviews"), {"assessment": a.reference, "topic": "tests", "question": question},
                    format="json")


def pdf_text(res):
    reader = PdfReader(io.BytesIO(res.content))
    return " ".join(" ".join(p.extract_text() for p in reader.pages).split())


# ---------------------------------------------------------------- the happy path

@pytest.mark.django_db
def test_full_review_workflow(user, patient_api, doctor, doctor_api):
    a = assessment(user)
    res = request_review(patient_api, a)
    assert res.status_code == 201
    rid = res.json()["id"]
    assert res.json()["status"] == "pending" and res.json()["status_label"] == "Pending Doctor Review"
    assert ReportVersion.objects.filter(assessment=a, version=1, review=None).exists()
    # The verified, available doctor hears about it, without the patient's name.
    note = Notification.objects.get(user=doctor.user, kind="review_requested")
    assert "Nadia" not in note.body

    queue = doctor_api.get(reverse("doctor-requests")).json()
    assert [r["id"] for r in queue["results"]] == [rid]
    row = queue["results"][0]
    assert row["patient"]["name"] == "Nadia Rahman" and row["risk"]["level"] == "moderate"
    # Before accepting: a summary only, not the full record.
    preview = doctor_api.get(reverse("doctor-request", args=[rid])).json()
    assert "assessment_detail" not in preview
    assert doctor_api.get(reverse("doctor-review", args=[rid])).status_code == 404

    claimed = doctor_api.post(reverse("doctor-claim", args=[rid]))
    assert claimed.status_code == 200
    assert claimed.json()["status"] == "under_review" and claimed.json()["doctor"]["name"] == "Sarah Rahman"
    mine = patient_api.get(reverse("reviews")).json()[0]
    assert mine["status_label"] == "Currently Under Review" and mine["doctor"]["doctor_id"] == doctor.doctor_id

    ws = doctor_api.get(reverse("doctor-review", args=[rid])).json()
    assert ws["assessment_detail"]["result"]["probability"] == 0.52
    assert ws["assessment_detail"]["guidance"]["findings"]  # the frozen copy, as the patient saw it
    assert ws["review"] is None and ws["question"] == "Is my LDL the main reason?"

    draft = {"decision": "approved_with_recommendations", "remarks": "", "action_plan": "", "notes": "Call back"}
    saved = doctor_api.put(reverse("doctor-draft", args=[rid]), draft, format="json")
    assert saved.status_code == 200 and saved.json()["status"] == "draft"
    # The patient sees neither the draft nor the notes.
    mine = patient_api.get(reverse("reviews")).json()[0]
    assert mine["review"] is None and "Call back" not in json.dumps(mine)
    assert "draft_saved" not in [t["kind"] for t in mine["timeline"]]

    # Incomplete: remarks and (for this decision) an action plan are required.
    res = doctor_api.post(reverse("doctor-submit", args=[rid]), draft, format="json")
    assert res.status_code == 400 and res.json()["code"] == "incomplete"
    final = {**draft, "remarks": "LDL and blood pressure are above target.",
             "action_plan": "Repeat a fasting lipid profile in 3 months."}
    res = doctor_api.post(reverse("doctor-submit", args=[rid]), final, format="json")
    assert res.status_code == 200
    assert res.json()["status"] == "completed" and res.json()["review"]["status"] == "submitted"
    # One review row: the draft became the submitted review.
    assert ClinicalReview.objects.filter(request_id=res.json()["id"][2:].lstrip("0")).count() == 1
    # A second submit (double click, second tab) changes nothing.
    again = doctor_api.post(reverse("doctor-submit", args=[rid]), final, format="json")
    assert again.status_code == 409
    assert doctor_api.put(reverse("doctor-draft", args=[rid]), final, format="json").status_code == 409

    kinds = list(ReviewEvent.objects.filter(request__assessment=a).values_list("kind", flat=True))
    assert kinds == ["requested", "claimed", "opened", "draft_saved", "submitted", "report_updated",
                     "patient_notified"]
    assert ReportVersion.objects.get(assessment=a, version=2).review.decision == "approved_with_recommendations"

    mine = patient_api.get(reverse("reviews")).json()[0]
    assert mine["status_label"] == "Doctor Review Completed"
    assert mine["review"]["remarks"].startswith("LDL") and "notes" not in mine["review"]
    assert [r["version"] for r in mine["reports"]] == [1, 2]
    notes = patient_api.get(reverse("notifications")).json()
    assert notes["results"][0]["title"] == "Clinical Review Completed" and notes["unread"] == 2
    assert patient_api.post(reverse("notifications-read"), {}, format="json").status_code == 204
    assert patient_api.get(reverse("notifications")).json()["unread"] == 0

    # The latest report carries the review; version 1 is still the automated one.
    latest = pdf_text(patient_api.get(reverse("history-report", args=[a.reference])))
    assert "Dr. Sarah Rahman" in latest and doctor.doctor_id in latest and "Cardiology" in latest
    assert "Approved with Recommendations" in latest and "Repeat a fasting lipid profile" in latest
    assert "Call back" not in latest  # internal notes stay internal
    first = pdf_text(patient_api.get(reverse("history-report", args=[a.reference]) + "?version=1"))
    assert "Pending Doctor Review" in first and "Sarah Rahman" not in first
    assert patient_api.get(reverse("history-report", args=[a.reference]) + "?version=9").status_code == 404

    done = doctor_api.get(reverse("doctor-reviews") + "?scope=completed").json()
    assert done["count"] == 1 and done["results"][0]["decision_label"] == "Approved with Recommendations"
    assert doctor_api.get(reverse("doctor-report", args=[rid])).status_code == 200


# ---------------------------------------------------------------- claiming

@pytest.mark.django_db
def test_only_one_doctor_can_claim(django_user_model, user, patient_api, doctor_api):
    other = make_doctor(django_user_model, "omar@example.com", "Omar Faruk")
    rid = request_review(patient_api, assessment(user)).json()["id"]
    assert doctor_api.post(reverse("doctor-claim", args=[rid])).status_code == 200
    res = api_as(other.user).post(reverse("doctor-claim", args=[rid]))
    assert res.status_code == 409 and res.json()["code"] == "taken"
    assert "already been assigned" in res.json()["detail"]
    # …and the other doctor can't open it either.
    assert api_as(other.user).get(reverse("doctor-review", args=[rid])).status_code == 404
    assert ReviewRequest.objects.get().doctor.email == "sarah@example.com"


@pytest.mark.django_db
def test_claim_is_one_conditional_update(user, patient_api, doctor, doctor_api):
    """A claim that loses the race (the row changed between read and write) still fails."""
    rid = request_review(patient_api, assessment(user)).json()["id"]
    ReviewRequest.objects.update(status=ReviewRequest.UNDER_REVIEW)  # someone else got there first
    assert doctor_api.post(reverse("doctor-claim", args=[rid])).status_code == 409


@pytest.mark.django_db
def test_unavailable_inactive_unverified_doctors(django_user_model, user, patient_api):
    rid = request_review(patient_api, assessment(user)).json()["id"]
    away = make_doctor(django_user_model, "away@example.com", is_available=False)
    res = api_as(away.user).post(reverse("doctor-claim", args=[rid]))
    assert res.status_code == 403 and res.json()["code"] == "unavailable"

    inactive = make_doctor(django_user_model, "gone@example.com", status="inactive")
    c = api_as(inactive.user)
    assert c.post(reverse("doctor-claim", args=[rid])).status_code == 403
    assert c.get(reverse("doctor-requests")).status_code == 403
    assert c.get(reverse("doctor-me")).json()["is_active"] is False  # can still see why

    unverified = make_doctor(django_user_model, "new@example.com", is_verified=False)
    c = api_as(unverified.user)
    assert c.get(reverse("doctor-requests")).json()["code"] == "not_verified"
    assert c.post(reverse("doctor-claim", args=[rid])).status_code == 403


@pytest.mark.django_db
def test_doctor_never_reviews_their_own_assessment(doctor, doctor_api):
    a = assessment(doctor.user)
    rid = request_review(doctor_api, a).json()["id"]
    assert doctor_api.get(reverse("doctor-requests")).json()["count"] == 0
    assert doctor_api.post(reverse("doctor-claim", args=[rid])).status_code == 404


# ---------------------------------------------------------------- who may see what

@pytest.mark.django_db
def test_patients_cannot_use_the_doctor_api(user, patient_api):
    rid = request_review(patient_api, assessment(user)).json()["id"]
    for name, args in (("doctor-me", []), ("doctor-overview", []), ("doctor-requests", []),
                       ("doctor-request", [rid]), ("doctor-review", [rid])):
        assert patient_api.get(reverse(name, args=args)).status_code == 403
    assert patient_api.post(reverse("doctor-claim", args=[rid])).status_code == 403
    assert APIClient().get(reverse("doctor-requests")).status_code == 401


@pytest.mark.django_db
def test_patients_only_see_and_request_their_own(django_user_model, user, patient_api):
    stranger = django_user_model.objects.create_user(username="x@example.com", email="x@example.com", password="pw")
    theirs = assessment(stranger)
    assert request_review(patient_api, theirs).status_code == 404
    rid = request_review(api_as(stranger), theirs).json()["id"]
    assert patient_api.get(reverse("reviews")).json() == []
    assert patient_api.delete(reverse("review", args=[rid])).status_code == 404


@pytest.mark.django_db
def test_request_rules(user, patient_api, doctor_api):
    no_guidance = assessment(user, guidance=False)
    assert request_review(patient_api, no_guidance).status_code == 409
    a = assessment(user)
    rid = request_review(patient_api, a).json()["id"]
    assert request_review(patient_api, a).status_code == 409  # one open request per assessment
    # Withdrawn while pending → a new one can be made; once accepted it can't be withdrawn.
    assert patient_api.delete(reverse("review", args=[rid])).status_code == 204
    rid = request_review(patient_api, a).json()["id"]
    doctor_api.post(reverse("doctor-claim", args=[rid]))
    assert patient_api.delete(reverse("review", args=[rid])).status_code == 409


# ---------------------------------------------------------------- doctor accounts

@pytest.mark.django_db
def test_doctor_login_by_id_and_forced_password_change(django_user_model):
    d = make_doctor(django_user_model, must_change_password=True)
    c = APIClient()
    assert c.post(reverse("doctor-login"), {"identifier": d.doctor_id, "password": "wrong"},
                  format="json").status_code == 400
    res = c.post(reverse("doctor-login"), {"identifier": d.doctor_id.lower(), "password": PASSWORD}, format="json")
    assert res.status_code == 200 and res.json()["must_change_password"] is True
    assert "password" not in json.dumps(res.json()).replace("must_change_password", "").replace("has_password", "")
    # Nothing but /me and /password until the temporary password is replaced.
    assert c.get(reverse("doctor-overview")).status_code == 403
    assert c.post(reverse("doctor-password"), {"current_password": PASSWORD, "new_password": PASSWORD},
                  format="json").status_code == 400
    res = c.post(reverse("doctor-password"), {"current_password": PASSWORD, "new_password": NEW_PASSWORD},
                 format="json")
    assert res.status_code == 200 and res.json()["must_change_password"] is False
    assert c.get(reverse("doctor-overview")).status_code == 200


@pytest.mark.django_db
def test_patient_account_cannot_sign_in_to_the_doctor_portal(user):
    res = APIClient().post(reverse("doctor-login"), {"identifier": user.email, "password": "Correct-Horse-9"},
                           format="json")
    assert res.status_code == 400 and res.json()["detail"] == "Incorrect Doctor ID, email or password."


@pytest.mark.django_db
def test_admin_creates_verifies_and_resets_doctors(django_user_model):
    staff = django_user_model.objects.create_user(username="admin@example.com", email="admin@example.com",
                                                  password="pw", is_staff=True)
    c = api_as(staff)
    body = {"name": "Sarah Rahman", "email": "Sarah@Example.com", "password": PASSWORD, "specialty": "Cardiology",
            "registration_number": "BMDC-A-12345"}
    res = c.post(reverse("admin-doctors"), body, format="json")
    assert res.status_code == 201
    row = res.json()
    assert row["doctor_id"].startswith("DR-") and row["verified"] is False and row["must_change_password"] is True
    assert PASSWORD not in json.dumps(row)
    d = DoctorProfile.objects.get()
    assert d.user.check_password(PASSWORD) and d.user.password != PASSWORD  # hashed
    assert c.post(reverse("admin-doctors"), body, format="json").status_code == 400  # email taken

    res = c.patch(reverse("admin-doctor", args=[d.pk]), {"is_verified": True}, format="json")
    assert res.json()["verified"] is True and res.json()["verified_by"] == "admin@example.com"
    # A new registration number needs checking again.
    res = c.patch(reverse("admin-doctor", args=[d.pk]), {"registration_number": "BMDC-A-99999"}, format="json")
    assert res.json()["verified"] is False

    d.must_change_password = False
    d.save()
    res = c.post(reverse("admin-doctor-reset", args=[d.pk]), {"password": NEW_PASSWORD}, format="json")
    assert res.status_code == 200 and NEW_PASSWORD not in json.dumps(res.json())
    d.refresh_from_db()
    assert d.must_change_password is True

    # Patients and doctors can't reach any of it.
    assert api_as(d.user).get(reverse("admin-doctors")).status_code == 403
    assert api_as(d.user).get(reverse("admin-reviews")).status_code == 403


@pytest.mark.django_db
def test_doctor_with_reviews_cannot_be_deleted(django_user_model, user, patient_api, doctor, doctor_api):
    staff = django_user_model.objects.create_superuser(username="root@example.com", email="root@example.com",
                                                       password="pw")
    rid = request_review(patient_api, assessment(user)).json()["id"]
    doctor_api.post(reverse("doctor-claim", args=[rid]))
    doctor_api.post(reverse("doctor-submit", args=[rid]), {"decision": "reviewed", "remarks": "Reviewed."},
                    format="json")
    res = api_as(staff).delete(reverse("admin-user", args=[doctor.user_id]))
    assert res.status_code == 409
    monitor = api_as(staff).get(reverse("admin-reviews") + "?status=completed").json()
    assert monitor["count"] == 1 and monitor["results"][0]["decision"] == "reviewed"


@pytest.mark.django_db
def test_patient_can_still_delete_their_account_after_a_review(user, patient_api, doctor_api):
    rid = request_review(patient_api, assessment(user)).json()["id"]
    doctor_api.post(reverse("doctor-claim", args=[rid]))
    doctor_api.post(reverse("doctor-submit", args=[rid]), {"decision": "reviewed", "remarks": "Reviewed."},
                    format="json")
    res = patient_api.delete(reverse("auth-account"), {"password": "Correct-Horse-9"}, format="json")
    assert res.status_code == 204
    assert not ClinicalReview.objects.exists() and not ReviewRequest.objects.exists()
