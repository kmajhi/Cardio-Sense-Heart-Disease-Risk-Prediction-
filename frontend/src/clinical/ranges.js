// Clinical reference ranges for the 21 prediction inputs.
//
// This is the CLINICAL INTERPRETATION layer. It is independent of the model:
// the model's risk estimate comes from patterns in one hospital's data (see
// ml/README.md, which notes that Troponin-I behaves backwards in that data),
// whereas these bands come from published guidelines and standard laboratory
// reference intervals, cited per feature in `source`.
//
// Each band is [upper bound (exclusive), level, label, direction]. The first
// band whose bound is above the value applies. Levels, in increasing concern:
//   normal   inside the healthy / reference range
//   elevated borderline, or mildly outside the range
//   high     clearly outside the range
//   urgent   a range where guidelines advise prompt medical attention
// `dir` says which side of normal the value is on ('high' or 'low').
//
// Labs set their own reference intervals; where a value is a lab interval
// rather than a guideline cut-off, the source says so and the UI says "typical".

export const LEVELS = ['normal', 'elevated', 'high', 'urgent'];
export const rank = (level) => LEVELS.indexOf(level);
export const worst = (levels) => levels.reduce((a, b) => (rank(b) > rank(a) ? b : a), 'normal');

export const LEVEL_LABEL = { normal: 'Normal', elevated: 'Elevated', high: 'High', urgent: 'Urgent' };

const INF = Infinity;
// Band bounds are exclusive ("below 120"). through(n) makes n itself part of the band.
const through = (n) => n + 1e-9;

// ---------- Groups: related features are reported together ----------

export const GROUPS = {
  cardiac: {
    title: 'Heart muscle marker',
    why:
      'Troponin-I is released when heart muscle is injured. A result above the assay’s reference limit ' +
      'needs prompt medical review, whatever the model’s estimate says.',
  },
  bp: {
    title: 'Blood pressure',
    why:
      'Raised blood pressure strains the heart and arteries over time. It is one of the strongest ' +
      'modifiable causes of heart disease and stroke.',
  },
  glucose: {
    title: 'Blood sugar',
    why:
      'High blood sugar damages blood vessels over time, and diabetes roughly doubles the risk of ' +
      'heart disease. Very low blood sugar is dangerous in the short term.',
  },
  lipids: {
    title: 'Cholesterol & triglycerides',
    why:
      'LDL cholesterol builds up in artery walls (atherosclerosis). Low HDL and high triglycerides add to ' +
      'that risk.',
  },
  kidney: {
    title: 'Kidney function',
    why:
      'Reduced kidney function is linked to higher cardiovascular risk, and it changes which foods and ' +
      'medicines are safe.',
  },
  electrolytes: {
    title: 'Electrolytes',
    why:
      'Sodium, potassium and chloride keep fluid balance and the heartbeat steady. Potassium that is too ' +
      'high or too low can disturb heart rhythm.',
  },
  blood: {
    title: 'Blood count',
    why:
      'Low hemoglobin (anemia) makes the heart work harder to deliver oxygen. Abnormal platelet counts ' +
      'affect bleeding and clotting.',
  },
  weight: {
    title: 'Body weight',
    why:
      'Excess weight raises blood pressure, cholesterol and blood sugar. Being underweight can reflect ' +
      'poor nutrition or illness.',
  },
  history: {
    title: 'Reported history',
    why:
      'These are established risk factors or symptoms rather than measurements. Chest pain in particular ' +
      'should always be discussed with a clinician.',
  },
};

export const GROUP_ORDER = ['cardiac', 'bp', 'glucose', 'lipids', 'kidney', 'electrolytes', 'blood', 'weight', 'history'];

// ---------- Measured features ----------

/** Per-sex bands: pass { M: [...], F: [...] }. */
const bySex = (bands) => (sex) => bands[sex] ?? bands.M;

export const MEASURES = [
  {
    key: 'bp_mmhg',
    range: () => '90–119',
    label: 'Systolic blood pressure',
    short: 'Blood pressure',
    unit: 'mmHg',
    group: 'bp',
    digits: 0,
    bands: [
      [90, 'elevated', 'Low (hypotension range)', 'low'],
      [120, 'normal', 'Normal'],
      [130, 'elevated', 'Elevated', 'high'],
      [140, 'elevated', 'Stage 1 hypertension range', 'high'],
      [through(180), 'high', 'Stage 2 hypertension range', 'high'],
      [INF, 'urgent', 'Hypertensive crisis range', 'high'],
    ],
    source:
      '2017 ACC/AHA High Blood Pressure Guideline (Whelton et al., Hypertension 2018): normal <120, ' +
      'elevated 120–129, stage 1 130–139, stage 2 ≥140, crisis >180 mmHg. Low: <90 mmHg (AHA).',
  },
  {
    key: 'rbs_mmol_l',
    range: () => '3.9–7.7',
    label: 'Random blood sugar',
    short: 'Blood sugar',
    unit: 'mmol/L',
    group: 'glucose',
    digits: 1,
    bands: [
      [3.0, 'urgent', 'Clinically significant low (level 2 hypoglycemia)', 'low'],
      [3.9, 'high', 'Low (level 1 hypoglycemia)', 'low'],
      [7.8, 'normal', 'Normal'],
      [11.1, 'elevated', 'Above normal', 'high'],
      [INF, 'high', 'Diabetes-range random glucose', 'high'],
    ],
    source:
      'ADA Standards of Care in Diabetes 2024: random glucose ≥11.1 mmol/L (200 mg/dL) meets the diabetes ' +
      'criterion with symptoms; hypoglycemia level 1 <3.9, level 2 <3.0 mmol/L. 7.8 mmol/L (140 mg/dL) is ' +
      'the upper normal post-load value.',
  },
  {
    key: 'total_cholesterol',
    range: () => '< 200',
    label: 'Total cholesterol',
    unit: 'mg/dL',
    group: 'lipids',
    digits: 0,
    bands: [
      [200, 'normal', 'Desirable'],
      [240, 'elevated', 'Borderline high', 'high'],
      [INF, 'high', 'High', 'high'],
    ],
    source: 'NCEP ATP III (NHLBI 2002): desirable <200, borderline high 200–239, high ≥240 mg/dL.',
  },
  {
    key: 'ldl',
    range: () => '< 130',
    label: 'LDL cholesterol',
    short: 'LDL',
    unit: 'mg/dL',
    group: 'lipids',
    digits: 0,
    bands: [
      [100, 'normal', 'Optimal'],
      [130, 'normal', 'Near optimal'],
      [160, 'elevated', 'Borderline high', 'high'],
      [190, 'high', 'High', 'high'],
      [INF, 'high', 'Very high', 'high'],
    ],
    source: 'NCEP ATP III: optimal <100, near optimal 100–129, borderline 130–159, high 160–189, very high ≥190 mg/dL.',
  },
  {
    key: 'hdl',
    range: (sex) => (sex === 'F' ? '≥ 50' : '≥ 40'),
    label: 'HDL cholesterol',
    short: 'HDL',
    unit: 'mg/dL',
    group: 'lipids',
    digits: 0,
    bands: bySex({
      M: [[40, 'elevated', 'Low', 'low'], [INF, 'normal', 'Normal']],
      F: [[50, 'elevated', 'Low', 'low'], [INF, 'normal', 'Normal']],
    }),
    source: 'NCEP ATP III: low HDL <40 mg/dL in men and <50 mg/dL in women (metabolic syndrome criteria).',
  },
  {
    key: 'triglycerides',
    range: () => '< 150',
    label: 'Triglycerides',
    unit: 'mg/dL',
    group: 'lipids',
    digits: 0,
    bands: [
      [150, 'normal', 'Normal'],
      [200, 'elevated', 'Borderline high', 'high'],
      [500, 'high', 'High', 'high'],
      [INF, 'high', 'Very high', 'high'],
    ],
    source: 'NCEP ATP III: normal <150, borderline 150–199, high 200–499, very high ≥500 mg/dL.',
  },
  {
    key: 'hemoglobin',
    range: (sex) => (sex === 'F' ? '12.0–15.5' : '13.0–17.5'),
    label: 'Hemoglobin',
    unit: 'g/dL',
    group: 'blood',
    digits: 1,
    bands: bySex({
      M: [
        [8, 'urgent', 'Severe anemia range', 'low'],
        [11, 'high', 'Moderate anemia range', 'low'],
        [13, 'elevated', 'Mild anemia range', 'low'],
        [through(17.5), 'normal', 'Normal'],
        [INF, 'elevated', 'Above typical range', 'high'],
      ],
      F: [
        [8, 'urgent', 'Severe anemia range', 'low'],
        [11, 'high', 'Moderate anemia range', 'low'],
        [12, 'elevated', 'Mild anemia range', 'low'],
        [through(15.5), 'normal', 'Normal'],
        [INF, 'elevated', 'Above typical range', 'high'],
      ],
    }),
    source:
      'WHO 2011 hemoglobin thresholds for anemia (non-pregnant adults): men <13, women <12 g/dL; mild ' +
      '11–12.9 (men) / 11–11.9 (women), moderate 8–10.9, severe <8. Upper limit: typical lab reference ' +
      '(17.5 men, 15.5 women).',
  },
  {
    key: 'creatinine',
    range: (sex) => (sex === 'F' ? '0.6–1.1' : '0.7–1.3'),
    label: 'Creatinine',
    unit: 'mg/dL',
    group: 'kidney',
    digits: 2,
    // Graded by eGFR (see egfr.js), which accounts for age and sex; the lab
    // interval only adds a mild flag. See classifyCreatinine in analyze.js.
    bands: bySex({
      M: [[through(1.3), 'normal', 'Normal'], [INF, 'elevated', 'Above typical range', 'high']],
      F: [[through(1.1), 'normal', 'Normal'], [INF, 'elevated', 'Above typical range', 'high']],
    }),
    source:
      'Typical lab reference 0.7–1.3 (men) / 0.6–1.1 (women) mg/dL. Severity from eGFR (CKD-EPI 2021, ' +
      'race-free) using KDIGO 2012 categories: G3a 45–59, G3b 30–44, G4 15–29, G5 <15 mL/min/1.73m².',
  },
  {
    key: 'platelets',
    range: () => '150–400',
    label: 'Platelets',
    unit: '×10³/µL',
    group: 'blood',
    digits: 0,
    scale: 1 / 1000, // the payload stores a count per µL
    bands: [
      [50, 'urgent', 'Severely low', 'low'],
      [75, 'high', 'Moderately low', 'low'],
      [150, 'elevated', 'Mildly low', 'low'],
      [through(400), 'normal', 'Normal'],
      [INF, 'elevated', 'Above typical range', 'high'],
    ],
    source:
      'Typical lab reference 150–400 ×10³/µL (MedlinePlus). Low grades from CTCAE v5.0 platelet count ' +
      'decreased: grade 1 <150–75, grade 2 <75–50, grade 3–4 <50.',
  },
  {
    key: 'sodium',
    range: () => '135–145',
    label: 'Sodium',
    unit: 'mmol/L',
    group: 'electrolytes',
    digits: 0,
    bands: [
      [125, 'urgent', 'Profoundly low', 'low'],
      [130, 'high', 'Moderately low', 'low'],
      [135, 'elevated', 'Mildly low', 'low'],
      [through(145), 'normal', 'Normal'],
      [through(150), 'elevated', 'Mildly high', 'high'],
      [through(155), 'high', 'Moderately high', 'high'],
      [through(160), 'high', 'Markedly high', 'high'],
      [INF, 'urgent', 'Severely high', 'high'],
    ],
    source:
      'Reference 135–145 mmol/L. Hyponatremia grades from the European clinical practice guideline ' +
      '(Spasovski et al., 2014): mild 130–135, moderate 125–129, profound <125. Hypernatremia grades from ' +
      'CTCAE v5.0: grade 1 >145–150, grade 2 >150–155, grade 3 >155–160, grade 4 >160 mmol/L.',
  },
  {
    key: 'potassium',
    range: () => '3.5–5.1',
    label: 'Potassium',
    unit: 'mmol/L',
    group: 'electrolytes',
    digits: 1,
    bands: [
      [2.5, 'urgent', 'Severely low', 'low'],
      [3.0, 'high', 'Moderately low', 'low'],
      [3.5, 'elevated', 'Mildly low', 'low'],
      [through(5.1), 'normal', 'Normal'],
      [5.5, 'elevated', 'Above typical range', 'high'],
      [6.0, 'elevated', 'Mildly high', 'high'],
      [6.5, 'high', 'Moderately high', 'high'],
      [INF, 'urgent', 'Severely high', 'high'],
    ],
    source:
      'Typical reference 3.5–5.1 mmol/L. Hyperkalemia grades from the European Resuscitation Council ' +
      '2021 (mild 5.5–5.9, moderate 6.0–6.4, severe ≥6.5); hypokalemia: mild 3.0–3.4, moderate 2.5–2.9, ' +
      'severe <2.5.',
  },
  {
    key: 'chloride',
    range: () => '98–107',
    label: 'Chloride',
    unit: 'mmol/L',
    group: 'electrolytes',
    digits: 0,
    bands: [
      [98, 'elevated', 'Below typical range', 'low'],
      [through(107), 'normal', 'Normal'],
      [INF, 'elevated', 'Above typical range', 'high'],
    ],
    source: 'Typical lab reference 98–107 mmol/L. Interpreted with sodium; no separate severity grading is used.',
  },
];

// ---------- Troponin-I (assay-specific) ----------

// 99th-percentile upper reference limits. They differ by assay and lab; the
// Fourth Universal Definition of MI (Thygesen et al., 2018) defines myocardial
// injury as a value above the 99th percentile URL, with sex-specific limits
// recommended for high-sensitivity assays.
export const TROPONIN = {
  quantitative: {
    unit: 'ng/mL',
    digits: 2,
    limit: () => 0.04,
    source:
      'Contemporary (quantitative) cTnI: 0.04 ng/mL, the cut-off used in this project’s dataset (ml/README.md). ' +
      'Your lab’s 99th-percentile limit may differ.',
  },
  'high-sensitivity': {
    unit: 'ng/L',
    digits: 0,
    limit: (sex) => (sex === 'F' ? 16 : 34),
    source:
      'hs-cTnI sex-specific 99th percentiles, Abbott ARCHITECT (≈16 ng/L women, ≈34 ng/L men). Other hs ' +
      'assays use different limits. Fourth Universal Definition of MI (2018).',
  },
};

// ---------- BMI (from height and weight) ----------

export const BMI = {
  key: 'bmi',
  range: () => '18.5–24.9',
  label: 'Body mass index',
  short: 'BMI',
  unit: 'kg/m²',
  group: 'weight',
  digits: 1,
  bands: [
    [18.5, 'elevated', 'Underweight', 'low'],
    [25, 'normal', 'Healthy weight'],
    [30, 'elevated', 'Overweight', 'high'],
    [35, 'high', 'Obesity class I', 'high'],
    [40, 'high', 'Obesity class II', 'high'],
    [INF, 'high', 'Obesity class III', 'high'],
  ],
  source:
    'WHO adult BMI classification. For Asian populations WHO also gives lower public-health action points ' +
    '(23 and 27.5 kg/m²), not applied here.',
};

// ---------- Reported history (yes/no) ----------

export const HISTORY = [
  {
    key: 'hypertension',
    label: 'Diagnosed hypertension',
    group: 'bp',
    level: 'elevated',
    source: 'Established major risk factor (ACC/AHA 2019 Primary Prevention Guideline).',
  },
  {
    key: 'diabetes',
    label: 'Diagnosed diabetes',
    group: 'glucose',
    level: 'elevated',
    source: 'Established major risk factor (ACC/AHA 2019 Primary Prevention Guideline).',
  },
  {
    key: 'family_history',
    label: 'Family history of heart disease',
    group: 'history',
    level: 'elevated',
    source: 'Risk-enhancing factor (ACC/AHA 2019 Primary Prevention Guideline).',
  },
  {
    key: 'chest_pain_history',
    label: 'History of chest pain',
    group: 'history',
    level: 'high',
    source: 'A symptom that needs clinical evaluation (2021 AHA/ACC Chest Pain Guideline).',
  },
];

// Age is a risk factor, not an abnormal value: shown as context only.
export const AGE_RISK = { M: 45, F: 55, source: 'NCEP ATP III age risk factor: men ≥45, women ≥55.' };

/** The band a value falls in → { level, label, dir }. */
export function band(bands, value) {
  const [, level, label, dir] = bands.find(([upper]) => value < upper) ?? bands.at(-1);
  return { level, label, dir: dir ?? null };
}
