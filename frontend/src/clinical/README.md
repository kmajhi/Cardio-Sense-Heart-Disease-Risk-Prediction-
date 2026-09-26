# Risk-based notifications and health guidance

This module turns one assessment (the 21 inputs sent to `/api/predict/` plus the model's
response) into:

1. a **notification**: the model's overall risk, plus one grouped alert per topic where values
   fall outside healthy ranges, and
2. **personalised guidance**: diet, physical activity and daily-habit suggestions, each with
   the reason it was given and the guideline it follows.

It is plain JavaScript with no React, so the same logic drives the Prediction result card, the
nav bell, the Dashboard alert, the History lab table and the Guidance page, and it's unit-tested
(`clinical.test.js`, run with `npm test`).

## Design principle: two independent readings

| | Model-derived risk | Clinical interpretation |
|---|---|---|
| Question | How likely is heart disease, given the pattern of all inputs? | Is each value inside its healthy range? |
| Source | Random Forest trained on one hospital's data (`ml/`) | Published guidelines and lab reference intervals (`ranges.js`) |
| Output | Probability → Low / Moderate / High (`risk.js`) | Per value: Normal / Elevated / High / Urgent (`analyze.js`) |
| Code | `risk.js` | `ranges.js`, `egfr.js`, `analyze.js` |

The two are never merged into one score, and the UI labels them separately ("model estimate" vs
"values outside healthy ranges"). This is necessary for this project in particular: `ml/README.md`
documents that in the training data Troponin-I runs *backwards* (a normal troponin raises the
prediction) and LDL almost separates the classes. A value can therefore be clinically alarming
while the model scores it low, or the reverse. An abnormal value is not proof of heart disease,
and a high estimate doesn't mean any single value is wrong. The notification text says both.

## Files

| File | Role |
|---|---|
| `ranges.js` | Thresholds for every input, with citations; topic groups and "why it matters" text |
| `egfr.js` | CKD-EPI 2021 eGFR, used to grade creatinine |
| `analyze.js` | Checks the 21 inputs → findings, flagged findings, topic groups |
| `risk.js` | The model's probability bands (must match the backend's `RISK_BANDS`) |
| `notifications.js` | One notification per assessment: risk message + grouped alerts |
| `recommend.js` | Rule-based diet, activity, habit and "see a doctor" suggestions |
| `clinical.test.js` | 44 tests: boundaries, formulas, grouping, rules, edge cases |

UI: `src/notifications/` (context, alert components, bell menu) and `src/pages/Guidance/`.

## Risk classification (model)

| Probability | Level | Notification |
|---|---|---|
| < 35% | Low | Reassurance; if any value is abnormal, says those deserve attention on their own |
| 35–64% | Moderate | Review habits, discuss risk factors at a routine check-up |
| ≥ 65% | High | Prominent alert: elevated risk, not a diagnosis, review guidance, consult a qualified doctor |

These bands are a presentation choice for the prototype, not validated clinical cut-offs. When
the risk is Moderate or High but no value is out of range, the notification says the estimate
comes from the combination of factors.

## Feature-level analysis: the 21 inputs

Levels, in increasing concern: **Normal** (in range), **Elevated** (borderline or mildly
outside), **High** (clearly outside), **Urgent** (a range where guidelines advise prompt medical
attention). Band bounds are exclusive unless noted ("<120" means 119.9 is still normal).

| # | Input | How it's judged | Healthy range | Grading | Source |
|---|---|---|---|---|---|
| 1 | Age | Context only (risk factor) | | men ≥45, women ≥55 noted | NCEP ATP III |
| 2 | Sex | Selects sex-specific ranges | | | |
| 3–4 | Height, weight | As BMI | 18.5–24.9 kg/m² | <18.5 underweight; 25–29.9 overweight; ≥30 obesity I–III | WHO |
| 5 | Family history | Reported risk factor | No | Yes → Elevated | ACC/AHA 2019 |
| 6 | Hypertension | Reported risk factor | No | Yes → Elevated (blood-pressure group) | ACC/AHA 2019 |
| 7 | Diabetes | Reported risk factor | No | Yes → Elevated (blood-sugar group) | ACC/AHA 2019 |
| 8 | Chest pain history | Reported symptom | No | Yes → High | AHA/ACC 2021 Chest Pain |
| 9 | Systolic BP | Bands | 90–119 mmHg | 120–129 elevated; 130–139 stage 1; ≥140 stage 2 (High); ≥180 crisis (Urgent); <90 low | ACC/AHA 2017 |
| 10 | Random blood sugar | Bands | 3.9–7.7 mmol/L | 7.8–11.0 elevated; ≥11.1 High; <3.9 High; <3.0 Urgent | ADA 2024 |
| 11 | Total cholesterol | Bands | <200 mg/dL | 200–239 borderline; ≥240 High | NCEP ATP III |
| 12 | HDL | Sex-specific | ≥40 (M) / ≥50 (F) mg/dL | below → Elevated | NCEP ATP III |
| 13 | LDL | Bands | <130 mg/dL | 130–159 borderline; 160–189 High; ≥190 very high | NCEP ATP III |
| 14 | Triglycerides | Bands | <150 mg/dL | 150–199 borderline; 200–499 High; ≥500 very high | NCEP ATP III |
| 15 | Hemoglobin | Sex-specific | 13.0–17.5 (M) / 12.0–15.5 (F) g/dL | mild / moderate (<11) / severe (<8, Urgent) anemia | WHO 2011 |
| 16 | Creatinine | Lab range + eGFR | 0.7–1.3 (M) / 0.6–1.1 (F) mg/dL | eGFR 45–59 Elevated; 15–44 High; <15 Urgent | CKD-EPI 2021, KDIGO 2012 |
| 17 | Platelets | Bands | 150–400 ×10³/µL | <150 mild; <75 High; <50 Urgent; >400 Elevated | MedlinePlus, CTCAE v5 |
| 18 | Sodium | Bands | 135–145 mmol/L | 130–134 mild; 125–129 High; <125 Urgent; >145 High | Spasovski 2014 |
| 19 | Potassium | Bands | 3.5–5.1 mmol/L | 5.2–5.9 Elevated; 6.0–6.4 High; ≥6.5 Urgent; lows likewise | ERC 2021 |
| 20 | Chloride | Lab range | 98–107 mmol/L | outside → Elevated | Lab reference |
| 21 | Troponin-I | Assay-specific 99th percentile | ≤0.04 ng/mL (quantitative); ≤16 (F) / ≤34 (M) ng/L (hs) | above → Urgent | 4th Universal Definition of MI (2018) |

Max heart rate is sent to the model but is a formula of age and sex, so it isn't judged.

### Grouping

Flagged values are grouped by topic so the user sees one alert per topic, not one per value:
heart muscle marker, blood pressure, blood sugar, cholesterol & triglycerides, kidney function,
electrolytes, blood count, body weight, and reported history. A group takes its most serious
member's level; groups are sorted Urgent → High → Elevated. Each group carries a short "why it
matters" explanation (`GROUPS` in `ranges.js`).

## Notification logic (`notifications.js`, `src/notifications/`)

- **One notification per assessment**, keyed by the assessment ID (or its time). Grouping stops
  duplicate alerts within it; the read state stops the same assessment re-alerting.
- **Where it appears:** the Prediction result card (live, right after running the model), the nav
  bell (on every page), and the Dashboard alert card.
- **Bell dot:** shown when the notification needs attention (risk not Low, or any value flagged)
  and hasn't been opened; red when something is Urgent. Opening the bell marks it read
  (per browser, `localStorage`).
- **Urgent values** get a banner that names the topic and says it needs prompt medical attention.
- **Call to action:** "See personalized diet & workout" → `/guidance`.

## Recommendation logic (`recommend.js`)

Each suggestion is a rule: a condition over the findings, the risk level and the profile, plus
text, `because` (the exact values or answers that triggered it) and `source`. Sections, in reading
order:

1. **When to talk to a doctor.** Urgent items first (raised troponin → contact a doctor today,
   with emergency symptoms; BP ≥180 → re-measure, emergency signs), then other urgent labs, chest
   pain, low sodium, high model risk, then "discuss soon" (High) and "mention at your next
   check-up" (Elevated). Each value is mentioned once.
2. **Diet.** DASH and salt reduction for blood pressure; saturated fat and soluble fibre for LDL;
   omega-3 for triglycerides/HDL; added-sugar limits (25 g women / 36 g men); the plate method for
   glucose; iron with vitamin C for anemia; kidney, potassium and weight rules; always a general
   heart-healthy pattern.
3. **Physical activity & workout.** A safety gate first: raised troponin or BP ≥180 → no new
   exercise until reviewed; chest pain, high model risk or any urgent value → medical clearance
   before vigorous exercise. Then WHO 2020 targets (150–300 min/week moderate aerobic, strength on
   2+ days), adapted to the profile's activity level, plus condition-specific additions.
4. **Daily habits.** Smoking (from the profile), home BP monitoring, confirming a high random
   glucose with fasting glucose or HbA1c, rechecking lipids, keeping prescribed medicines, sleep,
   stress.

**Severity** changes the advice, not just whether it appears: e.g. BP 150 gets DASH and exercise
advice, BP 185 also gets the crisis instruction and holds back exercise.

**Conflicts are resolved explicitly:** DASH is rich in potassium, so with high potassium or reduced
kidney function it becomes "check with your doctor first"; low sodium suppresses salt restriction.

**Personal information used** (from the Profile page, when one exists): allergies (fish → omega-3
from seeds; nuts → seeds instead of nuts), smoking status, activity level, current medicines, and
the weight used for a 5–10% weight-loss target in kg. Age and sex come from the assessment itself.

## Validation

`clinical.test.js` (44 tests) covers:
- every threshold boundary that matters (e.g. BP 119/120/129/130/139/140/179/180);
- sex-specific ranges (HDL, hemoglobin, troponin, eGFR);
- the eGFR formula against a hand-worked value (60-year-old man, creatinine 1.0 → 86);
- censored and missing troponin; missing labs listed, not flagged;
- that every model input is judged or deliberately excluded;
- grouping and severity order; model risk and clinical findings staying separate;
- each recommendation rule, conflict handling, profile personalisation, no duplicates;
- the risk bands matching the backend.

The History page reads its ranges from this module too, so every page judges a value the same way.

## Edge cases

| Case | Behaviour |
|---|---|
| Lab left blank | Listed as "not measured", never flagged |
| Censored troponin (`<2.5`, `>25000`) | Judged only when the bound decides it; otherwise "unclear" |
| Troponin assay changed between visits | Not compared (History) |
| High model risk, all values normal | Notification explains the estimate comes from the combination of factors |
| Low model risk, abnormal values | Notification says those values deserve attention on their own |
| No profile | Guidance still works; profile-based rules are skipped |
| No assessment yet | Bell and Guidance page point to the Prediction page |
| Storage blocked | Read state lasts for the visit only |

## Limitations

- **Guidance, not diagnosis.** Suggestions are general lifestyle guidance from population
  guidelines; they don't replace clinical assessment, and every page says so.
- **Single readings.** Guidelines diagnose hypertension and diabetes from repeated or confirmatory
  measurements; one entry can only flag a value for follow-up.
- **Lab and assay variation.** Reference intervals and troponin 99th percentiles differ by lab and
  assay. The values used are documented defaults; a lab's own range takes precedence.
- **Population cut-offs.** WHO's lower BMI action points for Asian populations (23 and 27.5) are
  not applied; neither are pregnancy-specific ranges.
- **Systolic assumed.** The dataset's single blood-pressure value is treated as systolic.
- **Model caveats.** The model's estimate inherits the dataset's shortcuts (see `ml/README.md`);
  it is not externally validated or approved for clinical use.
