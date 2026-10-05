"""Heart Health Assessment Report: a PDF of one saved assessment.

    PUT /api/history/<ref>/guidance/   record the app's reading of the assessment (once)
    GET /api/history/<ref>/report/     the PDF, built on demand

Everything in the report comes from what is stored for that one assessment:
the inputs and the model's saved result (the model is never run again here),
and the frozen guidance (Assessment.guidance, see guidance.py): the parameter
analysis and the rule-based recommendations exactly as the app showed them.
Only the assessment's owner can get either; another user's ref is a 404, the
same answer as a ref that doesn't exist.

Nothing is written to disk (Render's disk is wiped on every deploy), and no
copy is kept: the PDF is rebuilt from the database on each download.

Layout (a clinical document): page 1 summarises the patient, the estimate,
priority findings and reported history; page 2 lists every measurement grouped
like a lab sheet, with reference range and status; page 3 holds the
recommendations and the doctor's review section. Times use the patient's own
time zone (Profile) when set, otherwise UTC, and say which.

Doctor review. Until an authenticated doctor submits a review (doctor_api.py),
the "Doctor's Clinical Review" section reads as pending (PENDING_REVIEW). A
submitted review is passed as `render(..., review=reviews.review_for_report(r))`:
the doctor's name, ID, specialty and registration come from their account, the
decision, remarks and action plan from the review. There is no signature image:
the section says the review was submitted through an authenticated account.

Versions (ReportVersion): 1 is the automated report, a later one adds the
submitted review. `?version=N` rebuilds that version; the default is the latest.
"""

import base64
import io
import logging
from functools import lru_cache
from pathlib import Path

from django.http import HttpResponse
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from . import guidance as guidance_rules
from .models import Assessment, Profile, ReportVersion

FONTS = Path(__file__).resolve().parent / "report_fonts"
# The Cardio Sense logo, the same vector artwork as the site's nav (frontend
# src/assets/cardio-sense-logo.svg). fpdf2 embeds it as vector paths.
LOGO = Path(__file__).resolve().parent / "report_assets" / "cardio-sense-logo.svg"
LOGO_RATIO = 129.8 / 147.7  # width / height, from its viewBox

# The review section's content until a real, authenticated doctor review exists.
PENDING_REVIEW = {
    "status": "Pending Doctor Review",
    "reviewed_by": "Pending assignment",
    "remarks": "To be completed during a future clinical review.",
    "decision": "Pending",
    "action_plan": "To be completed by the reviewing doctor.",
    "signature": "Pending",
    "date": "Pending",
}

def owned_assessment(user, ref):
    """The user's own assessment for "A-0012" or "12", else None (others' look the same as missing)."""
    pk = str(ref).upper().removeprefix("A-")
    if not (pk.isascii() and pk.isdigit()):
        return None
    return Assessment.objects.filter(pk=int(pk), user=user).first()


def report_id(a):
    return f"CS-{a.reference}"


# The measurement table: payload key → (label, unit), grouped the way a lab
# sheet is. Labels and units are the app's own (fields.js, clinical/ranges.js);
# a value the analysis judged is shown in the analysis's unit so it matches its
# reference range (platelets are entered per µL, judged in ×10³/µL).
MEASUREMENT_GROUPS = [
    ("Patient and anthropometric measurements", [
        ("age", "Age", "years"), ("sex", "Sex", ""), ("height_cm", "Height", "cm"),
        ("weight_kg", "Weight", "kg"), ("bmi", "Body mass index (BMI)", "kg/m²"),
    ]),
    ("Blood pressure", [("bp_mmhg", "Blood pressure (systolic)", "mmHg")]),
    ("Blood glucose", [("rbs_mmol_l", "Random blood sugar", "mmol/L")]),
    ("Lipid profile", [
        ("total_cholesterol", "Total cholesterol", "mg/dL"), ("ldl", "LDL cholesterol", "mg/dL"),
        ("hdl", "HDL cholesterol", "mg/dL"), ("triglycerides", "Triglycerides", "mg/dL"),
    ]),
    ("Hematology", [("hemoglobin", "Hemoglobin", "g/dL"), ("platelets", "Platelets", "/µL")]),
    ("Renal function", [("creatinine", "Creatinine", "mg/dL")]),
    ("Electrolytes", [
        ("sodium", "Sodium", "mmol/L"), ("potassium", "Potassium", "mmol/L"), ("chloride", "Chloride", "mmol/L"),
    ]),
    ("Cardiac markers", [("troponin_i", "Troponin-I", "")]),
]
HISTORY = [
    ("family_history", "Family history of heart disease"), ("hypertension", "Hypertension"),
    ("diabetes", "Diabetes"), ("chest_pain_history", "History of chest pain"),
]
TROPONIN_UNIT = {"quantitative": "ng/mL", "high-sensitivity": "ng/L"}
# Which topic each finding belongs to: the same groups as the app (GROUPS and
# each feature's `group` in frontend src/clinical/ranges.js). Keep them in step.
FINDING_GROUP = {
    "troponin_i": "cardiac", "bp_mmhg": "bp", "hypertension": "bp", "rbs_mmol_l": "glucose", "diabetes": "glucose",
    "total_cholesterol": "lipids", "ldl": "lipids", "hdl": "lipids", "triglycerides": "lipids",
    "creatinine": "kidney", "sodium": "electrolytes", "potassium": "electrolytes", "chloride": "electrolytes",
    "hemoglobin": "blood", "platelets": "blood", "bmi": "weight", "family_history": "history",
    "chest_pain_history": "history",
}
SECTION_ORDER = [
    ("diet", "Dietary guidance"),
    ("activity", "Exercise and physical activity"),
    ("habits", "Lifestyle improvements"),
    ("doctor", "Medical follow-up"),
]
RISK_LABEL = {"low": "Low risk", "moderate": "Moderate risk", "high": "High risk"}
RISK_BAND = {"low": "under 35%", "moderate": "35–64%", "high": "65% and above"}
DISCLAIMER = (
    "Generated by Cardio Sense from the values entered for this assessment, its saved machine-learning "
    "estimate and the app's rule-based guidance. For information and clinical discussion only: it is not a "
    "diagnosis and does not replace a medical examination. In an emergency (chest pain, breathlessness, "
    "fainting) seek emergency care immediately; never wait for this report or a review."
)

# ---------------------------------------------------------------- PDF drawing
# A clinical document, not a dashboard: white page, navy text and rules, a muted
# teal accent, grey dividers. Amber and red only for out-of-range values, and
# every status is also written in words, so the report reads in grayscale.

NAVY = (21, 39, 70)
TEAL = (38, 116, 114)
TEXT = (33, 37, 41)
MUTED = (96, 105, 117)
RULE = (214, 219, 225)
SURFACE = (244, 246, 248)
AMBER = (160, 98, 0)
RED = (176, 32, 38)
STATUS_COLOR = {"normal": TEXT, "elevated": AMBER, "high": RED, "urgent": RED}


def pct_text(p):
    """Same rule as the app (clinical/risk.js): never a flat 0% or 100%."""
    if p < 0.01:
        return "<1"
    if p > 0.99:
        return ">99"
    return str(min(99, max(1, round(p * 100))))


def show_number(v):
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return f"{v:,}" if isinstance(v, int) else str(v)


def zone_for(profile):
    """The patient's own time zone (Profile page) when set, else UTC: one zone for every time in the report."""
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

    name = getattr(profile, "timezone", "") or "UTC"
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


def status_text(f):
    """A finding → (status words, level) from the app's own grading (clinical/analyze.js).

    The app's levels are normal / elevated (borderline or mildly outside) / high
    (clearly outside) / urgent; `dir` says which side. Written as words with an
    arrow so a low value is never labelled "high"."""
    if f is None:
        return "—", None
    if f["status"] == "missing":
        return "Not assessed", None
    if f["status"] == "uncertain":
        return "Unclear (censored result)", None
    level = f["level"]
    if level == "normal":
        return "Within range", "normal"
    # `dir` is recorded from 4 Oct 2026; older copies say which band but not which side.
    arrow = {"high": "↑", "low": "↓"}.get(f.get("dir") or "", "")
    side = {"high": "high", "low": "low"}.get(f.get("dir") or "", "")
    word = {
        "elevated": f"Mildly {side}" if side else "Borderline",
        "high": side.capitalize() if side else "Outside range",
        "urgent": f"Urgent – {side}" if side else "Urgent",
    }[level]
    return f"{arrow} {word}".strip(), level


def place_logo(pdf, x, y, h):
    """Draws the logo `h` mm tall at (x, y) and returns its width; 0 (and nothing
    drawn) if the file is missing or can't be read, so a report never fails over it."""
    if not LOGO.exists():
        return 0
    w = h * LOGO_RATIO
    try:
        pdf.image(str(LOGO), x=x, y=y, w=w, h=h)
    except Exception:  # noqa: BLE001 (branding is never worth a failed report)
        logging.getLogger(__name__).warning("Couldn't draw the report logo", exc_info=True)
        return 0
    return w


@lru_cache(maxsize=1)
def model_metadata():
    """ml/artifacts/model_metadata.json (read as text; the model itself is never loaded here)."""
    import json

    from .services.model_store import METADATA_PATH

    try:
        return json.loads(METADATA_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


@lru_cache(maxsize=1)
def _fpdf():
    # Imported on first use: most API processes never build a PDF (the free plan has 512 MB).
    from fpdf import FPDF
    from fpdf.enums import XPos, YPos

    class ReportPDF(FPDF):
        running_left = ""
        running_right = ""
        footer_left = ""

        def header(self):
            if self.page_no() == 1:
                return
            self.set_y(9)
            logo_w = place_logo(self, 15, 8.6, 4.2)
            self.set_x(15 + logo_w + (1.6 if logo_w else 0))
            self.set_font("DejaVu", "", 7)
            self.set_text_color(*MUTED)
            self.cell(90, 4, self.running_left)
            self.cell(0, 4, self.running_right, align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            self.set_draw_color(*RULE)
            self.set_line_width(0.2)
            self.line(self.l_margin, 14, self.w - self.r_margin, 14)
            self.set_y(18)

        def footer(self):
            self.set_y(-14)
            self.set_draw_color(*RULE)
            self.set_line_width(0.2)
            self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
            self.ln(1.5)
            self.set_font("DejaVu", "", 6.8)
            self.set_text_color(*MUTED)
            self.cell(150, 3.6, self.footer_left)
            self.cell(0, 3.6, f"Page {self.page_no()} of {{nb}}", align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
            self.cell(0, 3.6, "Confidential personal health information. Not a diagnosis. "
                              "Not reviewed by a doctor unless the Doctor's Clinical Review section records a completed review.")

    return ReportPDF, XPos, YPos


class Builder:
    W = 180  # A4 width less 15 mm margins

    def __init__(self, a, content):
        ReportPDF, self.XPos, self.YPos = _fpdf()
        self.a, self.c = a, content
        self.g = content["guidance"]
        self.by_key = {f["key"]: f for f in self.g.get("findings", [])}
        self.tz = content["tz"]
        pdf = ReportPDF(format="A4", unit="mm")
        pdf.set_margins(15, 16, 15)
        pdf.set_auto_page_break(True, margin=20)
        pdf.add_font("DejaVu", "", str(FONTS / "DejaVuSans.ttf"))
        pdf.add_font("DejaVu", "B", str(FONTS / "DejaVuSans-Bold.ttf"))
        pdf.set_title(f"Heart Health Assessment Report {report_id(a)}")
        pdf.set_author("Cardio Sense")
        pdf.set_subject(f"Assessment {a.reference}")
        name = content["patient"]["name"]
        pdf.running_left = "Cardio Sense  ·  Heart Health Assessment Report"
        pdf.running_right = f"{(name[:40] + '…') if len(name) > 41 else name}  ·  {report_id(a)}".lstrip(" ·")
        pdf.footer_left = f"Report {report_id(a)}  ·  Generated {self.when(timezone.now())}"
        self.pdf = pdf
        self.number = 0

    # ---- formatting
    def when(self, dt, zone=True):
        local = dt.astimezone(self.tz)
        return f"{local:%d %b %Y, %H:%M}" + (f" {self.zone_label(local)}" if zone else "")

    def zone_label(self, local):
        offset = local.strftime("%z")
        utc = f"UTC{offset[:3]}:{offset[3:]}" if offset not in ("+0000", "") else "UTC"
        return utc if self.tz.key == "UTC" else f"{utc} ({self.tz.key})"

    # ---- primitives
    def font(self, size, bold=False, color=TEXT):
        self.pdf.set_font("DejaVu", "B" if bold else "", size)
        self.pdf.set_text_color(*color)

    def text(self, body, size=8.8, bold=False, color=TEXT, h=4.5, x=None, w=None):
        self.font(size, bold, color)
        x = 15 if x is None else x
        self.pdf.set_x(x)
        self.pdf.multi_cell(w or self.W - (x - 15), h, body, align="L", new_x=self.XPos.LMARGIN,
                            new_y=self.YPos.NEXT)

    def need(self, mm):
        """New page unless `mm` is left, so a heading never sits alone at the bottom."""
        if self.pdf.get_y() + mm > self.pdf.h - 22:
            self.pdf.add_page()

    def rule(self, color=RULE, width=0.2, gap=2):
        y = self.pdf.get_y()
        self.pdf.set_draw_color(*color)
        self.pdf.set_line_width(width)
        self.pdf.line(15, y, 195, y)
        self.pdf.ln(gap)

    def heading(self, title, note="", keep=26):
        self.number += 1
        self.need(keep)
        self.pdf.ln(1.8)
        self.font(11, True, NAVY)
        self.pdf.cell(0, 6, f"{self.number}.  {title}", new_x=self.XPos.LMARGIN, new_y=self.YPos.NEXT)
        y = self.pdf.get_y()
        self.pdf.set_draw_color(*TEAL)
        self.pdf.set_line_width(0.5)
        self.pdf.line(15, y + 0.4, 33, y + 0.4)
        self.pdf.set_draw_color(*RULE)
        self.pdf.set_line_width(0.2)
        self.pdf.line(33, y + 0.4, 195, y + 0.4)
        self.pdf.ln(2)
        if note:
            self.text(note, 7.6, color=MUTED, h=3.7)
            self.pdf.ln(0.8)

    def label(self, body, x=None, w=0):
        self.font(6.6, True, MUTED)
        if x is not None:
            self.pdf.set_x(x)
        self.pdf.cell(w, 3.6, body.upper(), new_x=self.XPos.LMARGIN, new_y=self.YPos.NEXT)

    def grid(self, pairs, cols=4, value_size=9):
        """Label-over-value metadata, `cols` per row; long values wrap in their column."""
        col_w = self.W / cols
        for i in range(0, len(pairs), cols):
            row = pairs[i:i + cols]
            # Values line up across the row even when one label wraps.
            self.font(6.6, True, MUTED)
            label_h = max(len(self.pdf.multi_cell(col_w - 3, 3.4, lab.upper(), dry_run=True, output="LINES"))
                          for lab, *_ in row) * 3.4
            y = self.pdf.get_y()
            bottoms = []
            for j, (lab, value, *color) in enumerate(row):
                x = 15 + j * col_w
                self.pdf.set_xy(x, y)
                self.font(6.6, True, MUTED)
                self.pdf.multi_cell(col_w - 3, 3.4, lab.upper(), align="L", new_x=self.XPos.LEFT,
                                    new_y=self.YPos.NEXT)
                self.pdf.set_xy(x, y + label_h)
                self.font(value_size, True, color[0] if color else TEXT)
                self.pdf.multi_cell(col_w - 3, 4.5, value or "—", align="L", new_x=self.XPos.LEFT,
                                    new_y=self.YPos.NEXT)
                bottoms.append(self.pdf.get_y())
            self.pdf.set_y(max(bottoms) + 2)

    def notice(self, title, body, color):
        """A thin-bordered notice; colour is for emphasis only, the title says what it is."""
        pdf = self.pdf
        self.font(8.2)
        lines = pdf.multi_cell(self.W - 9, 4.1, body, dry_run=True, output="LINES")
        h = 6 + 4.1 * len(lines) + 2.2
        self.need(h + 2)
        y = pdf.get_y()
        pdf.set_draw_color(*color)
        pdf.set_line_width(0.3)
        pdf.rect(15, y, self.W, h)
        pdf.set_fill_color(*color)
        pdf.rect(15, y, 1.4, h, style="F")
        pdf.set_xy(19.5, y + 1.6)
        self.font(8.2, True, color)
        pdf.cell(0, 4.2, title, new_x=self.XPos.LMARGIN, new_y=self.YPos.NEXT)
        pdf.set_x(19.5)
        self.font(8.2)
        pdf.multi_cell(self.W - 9, 4.1, body, align="L", new_x=self.XPos.LMARGIN, new_y=self.YPos.NEXT)
        pdf.set_y(y + h + 2.5)

    def bullet(self, body, size=8.6, x=17):
        self.need(7)
        self.font(size, False, TEAL)
        self.pdf.set_x(x)
        self.pdf.cell(4, 4.5, "•")
        self.text(body, size, x=x + 4)

    def value_for(self, key):
        """(result, unit) as entered, in the analysis's unit where it judged the value."""
        a, f = self.a, self.by_key.get(key)
        raw = a.inputs.get(key)
        if key == "bmi":
            return (f["display"], f["unit"]) if f and f["value"] is not None else ("Not measured", "")
        if raw in (None, ""):
            return "Not measured", ""
        if key == "sex":
            return {"M": "Male", "F": "Female"}.get(raw, str(raw)), ""
        if key == "troponin_i":
            return (f["display"] if f and f.get("display") else show_number(raw),
                    TROPONIN_UNIT.get(a.inputs.get("troponin_assay"), ""))
        if f and f.get("display") and f["kind"] == "measure":
            return f["display"], f["unit"]
        return show_number(raw), ""

    # ---- page 1: clinical summary
    def masthead(self):
        pdf, a, p = self.pdf, self.a, self.c["patient"]
        pdf.add_page()
        # Brand: the Cardio Sense logo and wordmark.
        logo_w = place_logo(pdf, 15, 12.6, 9.5)
        pdf.set_xy(15 + logo_w + 2.4, 14.6)
        self.font(12, True, NAVY)
        pdf.cell(60, 5.5, "Cardio Sense")
        self.font(7.5, False, MUTED)
        pdf.set_xy(100, 15.6)
        pdf.cell(95, 4.5, "Machine-learning heart risk assessment", align="R")
        pdf.set_xy(15, 24)
        self.font(18, True, NAVY)
        pdf.cell(0, 9, "Heart Health Assessment Report", new_x=self.XPos.LMARGIN, new_y=self.YPos.NEXT)
        pdf.ln(1.5)
        self.rule(TEAL, 0.6, 3)

        review = self.c["review"]
        sex = {"M": "Male", "F": "Female"}.get(p["sex"], "Not recorded")
        top = pdf.get_y()
        photo_w = 0
        if p.get("photo"):
            try:
                raw = base64.b64decode(p["photo"].split(",", 1)[1])
                pdf.image(io.BytesIO(raw), x=177, y=top, w=18, h=18)
                photo_w = 22
            except Exception:  # noqa: BLE001 (a bad photo never stops the report)
                photo_w = 0
        saved_w, self.W = self.W, self.W - photo_w
        self.grid([
            ("Patient", p["name"] or "Not provided"),
            ("Age", f"{p['age']} years" if p["age"] else "Not recorded"),
            ("Sex", sex),
            ("Review status", review["status"], AMBER if review is PENDING_REVIEW else TEAL),
            ("Report ID", report_id(a) + (f" · v{self.c['version'].version}" if self.c.get("version") else "")),
            ("Assessment ID", a.reference),
            ("Assessment date", self.when(a.created_at, zone=False)),
            ("Report generated", self.when(timezone.now(), zone=False)),
        ])
        self.W = saved_w
        self.text(f"Times are {self.zone_label(timezone.now().astimezone(self.tz))}.", 6.8, color=MUTED, h=3.4)
        pdf.set_y(max(pdf.get_y(), top + 20))
        self.rule()

    def risk(self):
        a, g = self.a, self.g
        self.heading("Machine-learning risk estimate",
                     f"The result saved with assessment {a.reference}. The model was not run again for this report.")
        pdf = self.pdf
        self.need(26)
        y = pdf.get_y()
        # Compact result block: number, band, model.
        pdf.set_fill_color(*SURFACE)
        pdf.rect(15, y, 52, 22, style="F")
        pdf.set_xy(19, y + 2.5)
        self.font(20, True, NAVY)
        pdf.cell(44, 9, f"{pct_text(a.probability)}%")
        pdf.set_xy(19, y + 12)
        self.font(8.6, True, STATUS_COLOR.get({"low": "normal", "moderate": "elevated", "high": "high"}
                                              .get(a.risk_level), TEXT))
        pdf.cell(44, 4.4, RISK_LABEL.get(a.risk_level, a.risk_level))
        pdf.set_xy(19, y + 16.4)
        self.font(7, False, MUTED)
        pdf.cell(44, 3.6, f"Band: {RISK_BAND.get(a.risk_level, '')}")

        pdf.set_xy(72, y)
        model = a.model_name or "the deployed model"
        lines = [
            ((g.get("risk") or {}).get("body") or "", 8.4, TEXT),
            (f"Model: {model}{self.calibration()}, trained {self.trained()}. Its accuracy was measured by internal "
             "testing on one hospital's data; the estimate has not been clinically validated and does not confirm "
             "or rule out heart disease.", 7.6, MUTED),
        ]
        for body, size, color in lines:
            if body:
                self.text(body, size, color=color, h=4, x=72)
                pdf.ln(1)
        pdf.set_y(max(pdf.get_y(), y + 22) + 2)

        cautions = []
        if a.missing_fields:
            cautions.append(f"Not measured, filled in by the model from typical values: {', '.join(a.missing_fields)}.")
        if a.outside_training:
            cautions.append("Outside the training data's range: " + "; ".join(
                f"{o['name']} {show_number(o['value'])} {o.get('unit', '')}".strip() for o in a.outside_training) + ".")
        if a.low_confidence:
            cautions.append("The app marked this estimate as low confidence.")
        if cautions:
            self.notice("Estimate reliability", " ".join(cautions), AMBER)

    def calibration(self):
        """", probabilities calibrated by …" when the model metadata says so for the model that made
        this assessment (same training time); nothing is claimed otherwise."""
        meta = model_metadata()
        method = (meta.get("calibration") or {}).get("method", "")
        if method and meta.get("trained_at") == self.a.model_trained_at:
            return f" with probabilities calibrated by {method.split(',')[0]}"
        return ""

    def trained(self):
        raw = self.a.model_trained_at
        try:
            return timezone.datetime.fromisoformat(raw).astimezone(self.tz).strftime("%d %b %Y")
        except (TypeError, ValueError):
            return raw or "date not recorded"

    def priorities(self):
        g = self.g
        groups = g.get("groups") or []
        self.heading("Priority findings",
                     "Areas outside their reference range, most serious first, as graded by the app's clinical rules.")
        if g.get("urgent"):
            self.notice("Needs prompt medical attention",
                        "At least one value is in a range where guidelines advise prompt medical attention. Contact "
                        "a doctor today; for chest pain, breathlessness, sweating or fainting, seek emergency care "
                        "now. Do not wait for a doctor's review of this report.", RED)
        if not groups:
            self.text("All assessed values are within their reference ranges.", 8.8, color=MUTED)
            return
        rank = {"normal": 0, "elevated": 1, "high": 2, "urgent": 3}
        rows = []
        for grp in groups[:5]:
            members = [f for f in self.g["findings"]
                       if f["status"] == "flagged" and FINDING_GROUP.get(f["key"]) == grp["id"]]
            measured = sorted((f for f in members if f["kind"] != "history"),
                              key=lambda f: -rank.get(f["level"], 0))
            if measured:
                status, level = status_text(measured[0])
            else:  # a reported condition or symptom, not a measurement
                status, level = "Reported", grp["level"]
            rows.append(([grp["title"], "; ".join(grp.get("findings") or []), status], level))
        self.table(["Area", "Findings", "Status"], rows, (40, 108, 32), align=("LEFT", "LEFT", "LEFT"))
        more = len(groups) - 5
        if more > 0:
            self.text(f"{more} further area{'s' if more > 1 else ''} outside range: see page 2.", 7.6, color=MUTED)

    def history_line(self):
        self.heading("Reported medical history", keep=16)
        pairs = []
        for key, lab in HISTORY:
            raw = self.a.inputs.get(key)
            value = "Not answered" if raw in (None, "") else ("Yes" if str(raw) in ("1", "True", "true") else "No")
            pairs.append((lab, value, RED if value == "Yes" else TEXT))
        self.grid(pairs)

    def about(self):
        self.heading("About this assessment", keep=20)
        self.text(
            "Cardio Sense compares routine measurements with patterns learned from one hospital's patient records "
            "and gives a statistical estimate. Separately, each value is checked against published reference "
            "ranges. The two are reported independently: an abnormal value is not proof of heart disease, and a "
            "high estimate does not mean any single value is wrong. Recommendations are general guidance from a "
            "rule-based system, not written by a doctor.", 8.2, h=4.1)
        self.pdf.ln(1)
        self.text("Not a diagnosis: it supports a conversation with a qualified doctor and does not replace an "
                  "examination, ECG or specialist tests.", 8.2, True, NAVY, h=4.1)

    # ---- page 2: measurements
    def table(self, headings, rows, widths, align=None, group_rows=()):
        """rows: (values, level); a level colours and bolds the last column. `group_rows`
        are indexes of rows that are section labels spanning the table."""
        from fpdf.enums import TableCellFillMode
        from fpdf.fonts import FontFace

        self.need(18)
        self.font(8)
        self.pdf.set_draw_color(*RULE)
        self.pdf.set_line_width(0.2)
        self.pdf.set_fill_color(255, 255, 255)  # nothing inherited from a notice's fill
        with self.pdf.table(
            col_widths=widths, width=self.W, line_height=4, padding=(1.1, 1.6),
            text_align=align or "LEFT", cell_fill_mode=TableCellFillMode.NONE,
            headings_style=FontFace(emphasis="BOLD", color=NAVY, fill_color=SURFACE, size_pt=7),
            borders_layout="HORIZONTAL_LINES",
        ) as t:
            head = t.row()
            for h in headings:
                head.cell(h.upper())
            for i, (values, level) in enumerate(rows):
                row = t.row()
                if i in group_rows:
                    row.cell(values[0], colspan=len(headings), align="LEFT",
                             style=FontFace(emphasis="BOLD", color=TEAL, size_pt=7.6))
                    continue
                for j, value in enumerate(values):
                    if j == len(values) - 1 and level and level != "normal":
                        row.cell(value, style=FontFace(emphasis="BOLD", color=STATUS_COLOR[level], size_pt=8))
                    else:
                        row.cell(value)
        self.pdf.ln(2)

    def new_page(self, unless_free_below=70):
        """Major parts start on a fresh page, unless the current one is still mostly
        empty (an overflow just started it): no near-blank pages."""
        if self.pdf.page_no() == 1 or self.pdf.get_y() > unless_free_below:
            self.pdf.add_page()
        else:
            self.pdf.ln(4)

    def measurements(self):
        self.new_page()
        self.heading("Clinical measurements and parameter analysis",
                     "Every value entered for this assessment, as saved. Reference ranges and statuses come from the "
                     "app's clinical rules (published guidelines and typical adult lab intervals, cited in the app); "
                     "the reporting lab's own range takes precedence.")
        rows, group_rows = [], []
        for title, items in MEASUREMENT_GROUPS:
            group_rows.append(len(rows))
            rows.append(([title], None))
            for key, lab, unit in items:
                f = self.by_key.get(key)
                result, shown_unit = self.value_for(key)
                status, level = status_text(f) if f else ("—", None)
                if key == "troponin_i" and self.a.inputs.get("troponin_assay"):
                    lab = f"Troponin-I ({self.a.inputs['troponin_assay'].replace('-', ' ')})"
                if key in ("height_cm", "weight_kg") and result != "Not measured":
                    status = "See BMI"
                if result == "Not measured":
                    shown_unit, status = "", "Not assessed"
                band = f["band"] if f and level and level != "normal" and f.get("band") else ""
                if band and band.lower() in status.lower():
                    band = ""  # "↑ High" needs no second "High"
                if band:
                    status = f"{status}\n{band}"
                rows.append(([lab, result, shown_unit or (unit if result != "Not measured" else ""),
                              (f or {}).get("range") or "—", status], level))
        self.table(["Parameter", "Result", "Unit", "Reference range", "Status"], rows, (52, 22, 17, 30, 59),
                   align=("LEFT", "RIGHT", "LEFT", "LEFT", "LEFT"), group_rows=group_rows)
        self.text("“Not measured” labs were left blank when the assessment was entered; the model filled them in "
                  "from typical values and the app did not grade them. Blood pressure is a single reading, treated "
                  "as systolic.", 7.4, color=MUTED, h=3.7)

        groups = self.g.get("groups") or []
        if groups:
            self.heading("Flagged areas: why they matter",
                         "General clinical context from the app for each area outside range (the values are in the "
                         "table above). Not a personal interpretation.", keep=24)
            for grp in groups:
                self.need(12)
                status = {"urgent": "Urgent", "high": "Outside range", "elevated": "Mildly outside range"}.get(
                    grp["level"], "")
                self.font(8.6, True, NAVY)
                self.pdf.cell(0, 4.6, f"{grp['title']}  ", new_x=self.XPos.END)
                self.font(7.6, True, STATUS_COLOR.get(grp["level"], TEXT))
                self.pdf.cell(0, 4.6, status, new_x=self.XPos.LMARGIN, new_y=self.YPos.NEXT)
                if grp.get("why"):
                    self.text(grp["why"], 7.6, color=MUTED, h=3.8)
                self.pdf.ln(1.4)

    # ---- page 3: recommendations and review
    def recommendations(self):
        self.new_page(unless_free_below=140)
        by_id = {s["id"]: s for s in self.g.get("sections", [])}
        self.heading("Recommendations",
                     "The suggestions the app's rule-based guidance system generated for this assessment"
                     f"{' (personalised with the patient profile)' if self.g.get('used_profile') else ''}, "
                     "unchanged. General guidance, not a treatment plan; not written by a doctor.")
        seen = set()
        for sid, title in SECTION_ORDER:
            section = by_id.get(sid)
            items = []
            for it in (section or {}).get("items", []):
                key = " ".join(it["text"].lower().split())
                if key not in seen:  # the same sentence is never printed twice
                    seen.add(key)
                    items.append(it)
            self.need(16)
            self.font(9.2, True, NAVY)
            self.pdf.cell(0, 5, title, new_x=self.XPos.LMARGIN, new_y=self.YPos.NEXT)
            self.pdf.ln(0.6)
            if not items:
                self.text("No recommendations were generated in this area for this assessment.", 8.2, color=MUTED,
                          x=17)
            for it in items:
                self.bullet(it["text"])
            related = []
            for it in items:
                for b in it.get("because") or []:
                    # "Blood pressure 185 mmHg · Hypertensive crisis range" → the measurement only;
                    # its grading is in the table on page 2.
                    b = b.split(" · ")[0]
                    if b.startswith(("Profile:", "Model estimate")) or b in related:
                        continue
                    related.append(b)
            if related:
                self.text("Related findings: " + "; ".join(related) + ".", 7.2, color=MUTED, h=3.6, x=21)
            if sid == "doctor":
                self.text("Lifestyle changes do not replace medical care. Prescribed medicines should not be stopped or "
                          "changed because of this report.", 7.6, color=MUTED, h=3.8, x=17)
            self.pdf.ln(2)

    def review(self):
        r = self.c["review"]
        pending = r is PENDING_REVIEW
        self.heading("Doctor's Clinical Review", keep=130)  # the whole block (~125 mm) stays on one page
        if pending:
            self.notice("Not yet reviewed by a doctor",
                        "No doctor has reviewed, verified or approved this report. This section is completed only "
                        "through an authenticated clinical review.", AMBER)
            self.grid([
                ("Review status", r["status"], AMBER),
                ("Reviewed by", r["reviewed_by"]),
                ("Review decision", r["decision"]),
                ("Review date", r["date"]),
            ])
        else:
            reg = r.get("registration_number") or "Not provided"
            if r.get("registration_number"):
                reg += " (checked by Cardio Sense)" if r.get("verified") else " (not checked)"
            self.grid([
                ("Reviewed by", r["reviewed_by"], NAVY),
                ("Doctor ID", r.get("doctor_id") or "—"),
                ("Specialty", r.get("specialty") or "Not provided"),
                ("Professional registration", reg),
                ("Review decision", r["decision"], TEAL),
                ("Review date", self.when(r["submitted_at"]) if r.get("submitted_at") else "—"),
                ("Review ID", r.get("review_id") or "—"),
                ("Hospital / organization", r.get("organization") or "Not provided"),
            ])
        pdf = self.pdf
        for lab, value, height in (("Doctor's remarks", r["remarks"], 24), ("Clinical action plan", r["action_plan"], 20)):
            self.need(height + 6)
            self.label(lab)
            y = pdf.get_y() + 0.6
            pdf.set_draw_color(*(RULE if pending else TEAL))
            pdf.set_line_width(0.25)
            self.font(8.4, False, MUTED if pending else TEXT)
            pdf.set_xy(17.5, y + 1.6)
            pdf.multi_cell(self.W - 5, 4.3, value, align="L", new_x=self.XPos.LMARGIN, new_y=self.YPos.NEXT)
            bottom = max(pdf.get_y() + 1.6, y + height)
            pdf.rect(15, y, self.W, bottom - y)
            pdf.set_y(bottom + 2.5)
        if not pending:
            self.text("Submitted electronically through the reviewer's authenticated Cardio Sense account; no "
                      "handwritten signature is reproduced. The machine-learning estimate and the rule-based "
                      "recommendations in this report are unchanged by the review: the doctor's own words are only "
                      "those in this section.", 7.4, color=MUTED, h=3.7)
            return
        self.need(16)
        y = pdf.get_y()
        self.label("Doctor's signature", x=15, w=88)
        pdf.set_xy(110, y)
        self.label("Name and registration number", x=110)
        self.font(8.4, False, MUTED)
        pdf.set_xy(15, y + 5)
        pdf.cell(88, 6, r["signature"])
        pdf.set_xy(110, y + 5)
        pdf.cell(85, 6, r["reviewed_by"])
        pdf.set_draw_color(*TEXT)
        pdf.set_line_width(0.25)
        pdf.line(15, y + 12, 95, y + 12)
        pdf.line(110, y + 12, 195, y + 12)
        pdf.set_y(y + 15)

    def disclaimer(self):
        self.need(22)
        self.pdf.ln(2)
        self.rule()
        self.label("Disclaimer")
        self.text(DISCLAIMER, 7.4, color=MUTED, h=3.7)

    def build(self):
        self.masthead()
        self.risk()
        self.priorities()
        self.history_line()
        self.about()
        self.measurements()
        self.recommendations()
        self.review()
        self.disclaimer()
        return bytes(self.pdf.output())


def patient_details(a):
    """Only what the app has: the profile's name and photo, and the age and sex the assessment used."""
    profile = Profile.objects.filter(user=a.user, deleted_at__isnull=True).first() if a.user_id else None
    name = (profile.full_name if profile else "") or (a.user.first_name if a.user_id else "")
    photo = profile.photo if profile and str(profile.photo).startswith("data:image/jpeg;base64,") else ""
    return {"name": name, "age": a.age, "sex": a.sex, "photo": photo}, profile


def render(a, review=None, version=None):
    """The PDF for one assessment. `review`: reviews.review_for_report(...) of a submitted
    review, or None for pending. `version`: the ReportVersion it is, if recorded."""
    patient, profile = patient_details(a)
    content = {"guidance": a.guidance or {}, "patient": patient, "review": review or PENDING_REVIEW,
               "tz": zone_for(profile), "version": version}
    return Builder(a, content).build()


def latest_version(a):
    return ReportVersion.objects.filter(assessment=a).order_by("-version").select_related("review").first()


def render_version(a, number=None):
    """PDF bytes for report version `number` (default: the latest), or None if there is no such version."""
    from .reviews import review_for_report

    if number is None:
        v = latest_version(a)
    else:
        v = ReportVersion.objects.filter(assessment=a, version=number).select_related("review").first()
        if v is None:
            return None
    review = v.review if v is not None and v.review_id else None
    return render(a, review=review_for_report(review) if review else None, version=v)


# ---------------------------------------------------------------- API

class GuidanceView(APIView):
    """PUT /api/history/<ref>/guidance/ { guidance } → 200 { recorded_at }.

    Records the app's reading of the assessment the first time it's sent and
    keeps it: sending again never replaces it, so the report always shows what
    the app said when the assessment was first opened."""

    def put(self, request, ref):
        a = owned_assessment(request.user, ref)
        if a is None:
            return Response({"detail": "No such assessment."}, status=404)
        if a.guidance is None:
            data = request.data if isinstance(request.data, dict) else {}
            try:
                cleaned = guidance_rules.clean(data.get("guidance"), a.inputs)
            except guidance_rules.GuidanceError as err:
                return Response({"detail": str(err)}, status=400)
            # Conditional update: with two tabs at once, only the first copy is kept.
            Assessment.objects.filter(pk=a.pk, guidance__isnull=True).update(
                guidance=cleaned, guidance_recorded_at=timezone.now())
            a.refresh_from_db(fields=["guidance", "guidance_recorded_at"])
            from .reviews import ensure_first_report

            ensure_first_report(a)
        return Response({"recorded_at": a.guidance_recorded_at.isoformat() if a.guidance_recorded_at else None})


class ReportView(APIView):
    """GET /api/history/<ref>/report/[?version=N] → the PDF (the signed-in user's own assessments only).
    The latest version by default: once a doctor has submitted a review, it includes the review."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "report"

    def get(self, request, ref):
        a = owned_assessment(request.user, ref)
        if a is None:
            return Response({"detail": "No such assessment."}, status=404)
        if not a.guidance:
            return Response({"detail": "This assessment's analysis hasn't been recorded yet. Open it in the app "
                                       "and try again."}, status=409)
        number = request.query_params.get("version")
        if number is not None and not (number.isascii() and number.isdigit()):
            return Response({"detail": "No such report version."}, status=404)
        data = render_version(a, int(number) if number else None)
        if data is None:
            return Response({"detail": "No such report version."}, status=404)
        response = HttpResponse(data, content_type="application/pdf")
        suffix = f"-v{number}" if number else ""
        response["Content-Disposition"] = f'attachment; filename="cardio-sense-report-{a.reference}{suffix}.pdf"'
        response["Cache-Control"] = "no-store"
        return response
