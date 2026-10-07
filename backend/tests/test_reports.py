"""The PDF health report: tied to one saved assessment, its owner only, and never
claiming a doctor's review. tests/guidance_samples.json is what the frontend's
clinical/snapshot.js produces for the three sample patients (regenerate it if
the clinical rules change)."""

import copy
import io
import json
from pathlib import Path

import pytest
from django.urls import reverse
from pypdf import PdfReader

from predictor import reports
from predictor.models import Assessment, Profile
from predictor.samples import SAMPLES

GUIDANCE = json.loads((Path(__file__).parent / "guidance_samples.json").read_text(encoding="utf-8"))
RESULTS = {"low": 0.08, "moderate": 0.5, "high": 0.93}


def make(user, level="high", **extra):
    inputs = dict(SAMPLES[level])
    return Assessment.objects.create(
        user=user, inputs=inputs, age=inputs["age"], sex=inputs["sex"], probability=RESULTS[level], risk_level=level,
        top_factors=[{"name": "Age", "contribution": 0.12}, {"name": "LDL", "contribution": -0.04}],
        model_name="Random Forest", **extra)


def pdf_text(response):
    assert response["Content-Type"] == "application/pdf"
    reader = PdfReader(io.BytesIO(b"".join(response.streaming_content) if response.streaming else response.content))
    return len(reader.pages), "\n".join(page.extract_text() for page in reader.pages)


def record(client, a, level="high"):
    return client.put(reverse("history-guidance", args=[a.reference]), {"guidance": GUIDANCE[level]},
                      content_type="application/json")


@pytest.mark.django_db
def test_report_shows_this_assessments_saved_data(client, user):
    Profile.objects.create(user=user, full_name="Nadia Rahman")
    a = make(user, "high")
    assert record(client, a).status_code == 200

    res = client.get(reverse("history-report", args=[a.reference]))
    assert res.status_code == 200
    assert res["Cache-Control"] == "no-store"
    assert f"cardio-sense-report-{a.reference}.pdf" in res["Content-Disposition"]
    pages, text = pdf_text(res)
    flat = " ".join(text.split())

    assert 3 <= pages <= 6  # 30 recommendations for the high-risk sample
    assert "Heart Health Assessment Report" in flat
    assert f"CS-{a.reference}" in flat and "Nadia Rahman" in flat
    # The saved result, not a new prediction.
    assert "93%" in flat and "High risk" in flat
    # Submitted values, with the app's units.
    assert "185" in flat and "mmHg" in flat and "850" in flat and "ng/L" in flat
    # Analysis and the recommendations exactly as recorded.
    assert "Heart muscle marker" in flat
    first_diet = next(s for s in GUIDANCE["high"]["sections"] if s["id"] == "diet")["items"][0]["text"]
    assert " ".join(first_diet.split())[:60] in flat
    assert "Needs prompt medical attention" in flat
    # Doctor review: pending, nothing invented.
    for line in ("Doctor's Clinical Review", "Pending Doctor Review", "Pending assignment",
                 "To be completed by the reviewing doctor"):
        assert line in flat
    assert "No doctor has reviewed" in flat
    assert "not a diagnosis" in flat


@pytest.mark.django_db
def test_low_risk_report_with_unmeasured_labs(client, user):
    a = make(user, "low")
    a.inputs.update(hemoglobin=None, sodium=None)
    a.missing_fields = ["Hemoglobin", "Sodium"]
    a.save()
    guidance = copy.deepcopy(GUIDANCE["low"])
    for f in guidance["findings"]:
        if f["key"] in ("hemoglobin", "sodium"):
            f.update(value=None, display="", level=None, band="", status="missing")
    res = client.put(reverse("history-guidance", args=[a.reference]), {"guidance": guidance},
                     content_type="application/json")
    assert res.status_code == 200, res.json()
    _, text = pdf_text(client.get(reverse("history-report", args=[a.reference])))
    flat = " ".join(text.split())
    assert "Not measured" in flat and "Not assessed" in flat
    assert "All assessed values are within their reference ranges" in flat


@pytest.mark.django_db
def test_long_recommendations_flow_onto_more_pages(client, user):
    a = make(user, "high")
    long = copy.deepcopy(GUIDANCE["high"])
    for s in long["sections"]:
        for i, it in enumerate(s["items"]):
            it["text"] = f"Item {i}: " + "Eat more vegetables and walk every day. " * 20
    assert client.put(reverse("history-guidance", args=[a.reference]), {"guidance": long},
                      content_type="application/json").status_code == 200
    pages, text = pdf_text(client.get(reverse("history-report", args=[a.reference])))
    assert pages >= 3
    assert "Page 1 of" in text and f"Page {pages} of {pages}" in text


@pytest.mark.django_db
def test_guidance_is_recorded_once_and_checked(client, user):
    a = make(user, "moderate")
    tampered = copy.deepcopy(GUIDANCE["moderate"])
    next(f for f in tampered["findings"] if f["key"] == "bp_mmhg")["value"] = 110
    res = client.put(reverse("history-guidance", args=[a.reference]), {"guidance": tampered},
                     content_type="application/json")
    assert res.status_code == 400 and "doesn't match" in res.json()["detail"]
    assert client.put(reverse("history-guidance", args=[a.reference]), {"guidance": {"engine": "x"}},
                      content_type="application/json").status_code == 400

    assert record(client, a, "moderate").status_code == 200
    first = Assessment.objects.get(pk=a.pk).guidance
    # Sending again (e.g. after a profile change) never replaces the first copy.
    changed = copy.deepcopy(GUIDANCE["moderate"])
    changed["sections"][1]["items"][0]["text"] = "Something else"
    assert client.put(reverse("history-guidance", args=[a.reference]), {"guidance": changed},
                      content_type="application/json").status_code == 200
    assert Assessment.objects.get(pk=a.pk).guidance == first


@pytest.mark.django_db
def test_report_needs_the_recorded_guidance(client, user):
    a = make(user)
    assert client.get(reverse("history-report", args=[a.reference])).status_code == 409


@pytest.mark.django_db
def test_nobody_else_gets_the_report(client, user, django_user_model, anon):
    other = django_user_model.objects.create_user(username="x@example.com", email="x@example.com", password="Pw-12345678")
    theirs = make(other)
    theirs.guidance = GUIDANCE["high"]
    theirs.save()
    # Another user's ref looks exactly like one that doesn't exist.
    for ref in (theirs.reference, "A-9999", "nonsense"):
        assert client.get(reverse("history-report", args=[ref])).status_code == 404
        assert client.put(reverse("history-guidance", args=[ref]), {"guidance": GUIDANCE["high"]},
                          content_type="application/json").status_code == 404
    assert anon.get(reverse("history-report", args=[theirs.reference])).status_code == 401


@pytest.mark.django_db
def test_future_review_slots_in_without_other_changes(user):
    a = make(user)
    a.guidance = GUIDANCE["high"]
    a.save()
    review = {**reports.PENDING_REVIEW, "status": "Reviewed", "remarks": "Seen in clinic."}
    reader = PdfReader(io.BytesIO(reports.render(a, review=review)))
    text = " ".join(" ".join(p.extract_text() for p in reader.pages).split())
    assert "Seen in clinic." in text and "Not yet reviewed by a doctor" not in text


@pytest.mark.django_db
def test_reviewed_report_prints_the_prescribed_medicines(user):
    a = make(user)
    a.guidance = GUIDANCE["high"]
    a.save()
    meds = [{"name": "Atorvastatin", "strength": "20 mg", "frequency": "Once daily (0-0-1)", "timing": "After meals",
             "duration": "3 months", "instructions": "Recheck lipids before the next visit"},
            {"name": "Aspirin", "strength": "75 mg", "frequency": "", "timing": "", "duration": "", "instructions": ""}]
    review = {**reports.PENDING_REVIEW, "status": "Reviewed", "remarks": "Seen in clinic.", "medications": meds}
    reader = PdfReader(io.BytesIO(reports.render(a, review=review)))
    text = " ".join(" ".join(p.extract_text() for p in reader.pages).split())
    assert "Prescribed medicines (2)" in text.replace("PRESCRIBED MEDICINES", "Prescribed medicines")
    assert "Atorvastatin 20 mg" in text and "After meals" in text and "Aspirin 75 mg" in text


@pytest.mark.django_db
def test_end_to_end_from_a_real_prediction(trained, client):
    body = dict(SAMPLES["high"])
    res = client.post(reverse("predict"), body, format="json")
    assert res.status_code == 200
    ref = res.json()["id"]
    a = Assessment.objects.get()
    guidance = copy.deepcopy(GUIDANCE["high"])
    guidance["risk"]["body"] = f"Saved estimate {res.json()['probability']:.4f}"
    assert client.put(reverse("history-guidance", args=[ref]), {"guidance": guidance},
                      content_type="application/json").status_code == 200
    _, text = pdf_text(client.get(reverse("history-report", args=[ref])))
    flat = " ".join(text.split())
    assert f"{reports.pct_text(a.probability)}%" in flat
    assert Assessment.objects.count() == 1  # the report never makes a new assessment


@pytest.mark.django_db
def test_clinical_layout_details(user):
    """Statuses say which side of the range, times say their zone, the model is the
    saved one, no factor-contribution claims, and long names wrap."""
    Profile.objects.create(user=user, full_name="Mohammad Abdur Rahman Chowdhury Bhuiyan Talukder " * 2,
                           timezone="Asia/Dhaka")
    a = make(user, "high", model_trained_at="2026-10-01T08:08:14+00:00")
    a.guidance = GUIDANCE["high"]
    a.save()
    reader = PdfReader(io.BytesIO(reports.render(a)))
    text = " ".join(" ".join(p.extract_text() for p in reader.pages).split())
    assert "↓ Mildly low" in text  # HDL 32: low, not "high"
    assert "↑ Urgent – high" in text  # BP 185
    assert "UTC+06:00 (Asia/Dhaka)" in text
    assert "Model: Random Forest" in text and "not been clinically validated" in text
    assert "percentage points" not in text and "What moved" not in text
    assert "Talukder" in text
    for heading in ("Clinical measurements", "Lipid profile", "Renal function", "Cardiac markers",
                    "Reported medical history", "Dietary guidance", "Medical follow-up"):
        assert heading in text
    assert "Based on:" not in text  # one "Related findings" line per section instead


def test_status_words_follow_the_apps_grading():
    f = {"status": "flagged", "level": "elevated", "dir": "low"}
    assert reports.status_text(f) == ("↓ Mildly low", "elevated")
    assert reports.status_text({**f, "level": "high", "dir": "high"}) == ("↑ High", "high")
    # Older saved copies have no direction: say how far out, not which way.
    assert reports.status_text({**f, "dir": None}) == ("Borderline", "elevated")
    assert reports.status_text({"status": "missing", "level": None}) == ("Not assessed", None)
    assert reports.status_text({"status": "flagged", "level": "normal"})[0] == "Within range"


def test_reports_carry_the_cardio_sense_logo():
    """The logo file ships with the backend and draws; a missing file never breaks a report."""
    from fpdf import FPDF

    assert reports.LOGO.exists()
    pdf = FPDF()
    pdf.add_page()
    assert reports.place_logo(pdf, 15, 12, 9.5) > 0
