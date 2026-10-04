"""The app's automated reading of one assessment (Assessment.guidance).

The reference ranges and the rule-based diet, activity and habit guidance live
in the frontend (src/clinical/, unit-tested there), and every page computes them
in the browser. The PDF report (reports.py) needs a fixed copy of exactly what the
user was shown, so the browser sends it once (frontend clinical/snapshot.js) and
it is frozen here. The server can't recompute the advice, but it checks the
copy before keeping it: its shape and sizes, and that every value in it is the
value stored with the assessment, so a report can never show numbers the model
didn't see.

    {
      engine: "cardio-sense-guidance/1",
      risk: { level, pct, label, body, note },
      urgent: bool, missing: [label],
      findings: [{ key, label, kind: measure|derived|history, value, display, unit,
                   range, level, band, status, dir: high|low|null, source }],
      groups: [{ id, title, level, why, findings: [str] }],
      sections: [{ id: doctor|diet|activity|habits, title,
                   items: [{ id, text, because: [str], source }] }],
      used_profile: bool,
    }
"""

import math

ENGINE = "cardio-sense-guidance/1"
SECTIONS = ("doctor", "diet", "activity", "habits")
LEVELS = ("normal", "elevated", "high", "urgent", None)
STATUSES = ("ok", "flagged", "missing", "uncertain")
KINDS = ("measure", "derived", "history")
# Findings whose value is the payload value times a factor (ranges.js `scale`).
SCALE = {"platelets": 1 / 1000}
MAX_TEXT = 600
MAX_ITEMS = 40


class GuidanceError(ValueError):
    pass


def _text(value, limit=MAX_TEXT, required=False):
    if value is None:
        value = ""
    if not isinstance(value, str):
        raise GuidanceError("Guidance text must be strings.")
    value = value.strip()
    if required and not value:
        raise GuidanceError("Guidance is missing a required text.")
    if len(value) > limit:
        raise GuidanceError("Guidance text is too long.")
    return value


def _num(v):
    if v is None or v == "" or isinstance(v, bool):
        return None
    try:
        n = float(v)
    except (TypeError, ValueError):
        return None
    return n if math.isfinite(n) else None


def _same(a, b):
    return a is not None and b is not None and math.isclose(a, b, rel_tol=1e-6, abs_tol=1e-6)


def _check_value(finding, inputs):
    """The finding's value must be the stored input's (or derived from them, for BMI)."""
    key, value = finding["key"], finding["value"]
    if key == "bmi":
        h, w = _num(inputs.get("height_cm")), _num(inputs.get("weight_kg"))
        expected = w / (h / 100) ** 2 if h and w else None
    elif key in inputs or value is not None:
        raw = _num(inputs.get(key))
        expected = raw * SCALE.get(key, 1) if raw is not None else None
    else:
        return
    if value is None and expected is None:
        return
    if not _same(value, expected):
        raise GuidanceError(f"The guidance value for {finding['label'] or key} doesn't match the assessment.")


def clean(snapshot, inputs):
    """A guidance snapshot from the browser → the cleaned copy to store, or GuidanceError."""
    if not isinstance(snapshot, dict) or snapshot.get("engine") != ENGINE:
        raise GuidanceError("Unrecognised guidance format. Reload the page and try again.")
    risk = snapshot.get("risk") or {}
    if not isinstance(risk, dict):
        raise GuidanceError("Guidance risk must be an object.")

    findings = []
    raw_findings = snapshot.get("findings")
    if not isinstance(raw_findings, list) or not 0 < len(raw_findings) <= MAX_ITEMS:
        raise GuidanceError("Guidance has no findings.")
    seen = set()
    for f in raw_findings:
        if not isinstance(f, dict):
            raise GuidanceError("Each finding must be an object.")
        key = _text(f.get("key"), 40, required=True)
        if key in seen:
            raise GuidanceError("Duplicate finding.")
        seen.add(key)
        kind, level, status = f.get("kind"), f.get("level"), f.get("status")
        if kind not in KINDS or level not in LEVELS or status not in STATUSES:
            raise GuidanceError("Unrecognised finding level or status.")
        value = f.get("value")
        if value is not None and _num(value) is None:
            raise GuidanceError("Finding values must be numbers.")
        item = {
            "key": key,
            "label": _text(f.get("label"), 120, required=True),
            "kind": kind,
            "value": _num(value),
            "display": _text(f.get("display"), 40),
            "unit": _text(f.get("unit"), 20),
            "range": _text(f.get("range"), 160),
            "level": level,
            "band": _text(f.get("band"), 300),
            "status": status,
            "dir": f.get("dir") if f.get("dir") in ("high", "low") else None,
            "source": _text(f.get("source"), MAX_TEXT),
        }
        if key != "troponin_i":  # troponin's value is in its assay's unit, checked below
            _check_value(item, inputs)
        elif not (_same(item["value"], _num(inputs.get("troponin_i"))) or (item["value"] is None and
                                                                             _num(inputs.get("troponin_i")) is None)):
            raise GuidanceError("The guidance value for Troponin-I doesn't match the assessment.")
        findings.append(item)

    sections = []
    raw_sections = snapshot.get("sections")
    if not isinstance(raw_sections, list) or len(raw_sections) > len(SECTIONS):
        raise GuidanceError("Guidance sections are missing.")
    ids = set()
    for s in raw_sections:
        if not isinstance(s, dict) or s.get("id") not in SECTIONS or s["id"] in ids:
            raise GuidanceError("Unrecognised guidance section.")
        items = s.get("items")
        if not isinstance(items, list) or len(items) > MAX_ITEMS:
            raise GuidanceError("Too many suggestions in one section.")
        clean_items, item_ids = [], set()
        for it in items:
            if not isinstance(it, dict):
                raise GuidanceError("Each suggestion must be an object.")
            item_id = _text(it.get("id"), 40, required=True)
            if item_id in item_ids:
                raise GuidanceError("Duplicate suggestion.")
            item_ids.add(item_id)
            because = it.get("because") or []
            if not isinstance(because, list) or len(because) > 10:
                raise GuidanceError("Suggestion reasons must be a short list.")
            clean_items.append({
                "id": item_id,
                "text": _text(it.get("text"), 1000, required=True),
                "because": [_text(b, 300) for b in because],
                "source": _text(it.get("source"), MAX_TEXT),
            })
        ids.add(s["id"])
        sections.append({"id": s["id"], "title": _text(s.get("title"), 80, required=True), "items": clean_items})

    groups = []
    for g in snapshot.get("groups") or []:
        if not isinstance(g, dict) or g.get("level") not in LEVELS:
            raise GuidanceError("Unrecognised guidance group.")
        lines = g.get("findings") or []
        if not isinstance(lines, list) or len(lines) > MAX_ITEMS:
            raise GuidanceError("Guidance group findings must be a short list.")
        groups.append({
            "id": _text(g.get("id"), 40), "title": _text(g.get("title"), 80), "level": g["level"],
            "why": _text(g.get("why"), MAX_TEXT), "findings": [_text(line, 400) for line in lines],
        })

    missing = snapshot.get("missing") or []
    if not isinstance(missing, list) or len(missing) > MAX_ITEMS:
        raise GuidanceError("Guidance missing-values list is invalid.")

    return {
        "engine": ENGINE,
        "risk": {
            "level": _text(risk.get("level"), 20),
            "pct": _text(str(risk.get("pct", "")), 8),
            "label": _text(risk.get("label"), 40),
            "body": _text(risk.get("body"), MAX_TEXT),
            "note": _text(risk.get("note"), MAX_TEXT),
        },
        "urgent": bool(snapshot.get("urgent")),
        "missing": [_text(m, 80) for m in missing],
        "findings": findings,
        "groups": groups[:MAX_ITEMS],
        "sections": sections,
        "used_profile": bool(snapshot.get("used_profile")),
    }
