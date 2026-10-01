// Inputs for the Northern Bangladesh model (see ml/notebooks and ml/training/data.py).
// Three ranges per field:
//   min/max  the slider: the values patients commonly have.
//   limit    what's physiologically possible for an adult; typed values may go
//            this far. Beyond it is a typo or a unit mix-up, and is refused
//            (the backend's LIMITS in prediction_service.py match).
//   train    what the training data covered (ml/artifacts/model_metadata.json).
//            Outside it the value is still used, but the model treats it like
//            the nearest value it saw, so the result is flagged low confidence.
// Age can be typed below 18 so a child's age gets a clear explanation instead
// of a silent refusal: the model only estimates adults (ADULT_AGE).
//
// `optional` labs can be marked "Not measured": they're sent as null, the model
// imputes them, and the result names them (the backend's OPTIONAL_FIELDS).
// Everything else is required for an estimate (its REQUIRED_FIELDS).

export const bmiFrom = (heightCm, weightKg) => weightKg / (heightCm / 100) ** 2;

/** The model only estimates adults (its training data had no healthy children). */
export const ADULT_AGE = 18;

// BMI outside this means height or weight was mistyped (the backend's BMI_LIMITS).
export const BMI_LIMIT = [10, 150];
// BMI the training data covered (from height and weight, not entered).
export const BMI_TRAIN = [14.7, 43.5];

/** Why this patient can't get an estimate, or '' when they can. */
export function patientError(v) {
  if (v.age < ADULT_AGE) {
    return (
      'Cardio Sense estimates heart disease risk for adults (18 or over) only. Its training data had no healthy ' +
      'children (all 13 under-18 records were heart-disease cases), so it can’t estimate a child’s risk. For a ' +
      'child, see a paediatrician or paediatric cardiologist.'
    );
  }
  const bmi = bmiFrom(v.height, v.weight);
  if (!(bmi >= BMI_LIMIT[0] && bmi <= BMI_LIMIT[1])) {
    return `Height ${v.height} cm and weight ${v.weight} kg give a BMI of ${Math.round(bmi)}, which isn’t possible. Check both values.`;
  }
  return '';
}

// MaxHR in the source data is a formula of age and sex, not a measurement,
// so it's computed here and never asked for.
export const maxHRFrom = (age, sex) => (sex === 'F' ? 206 - 0.88 * age : 208 - 0.7 * age);

export const maxHRFormula = (sex) => (sex === 'F' ? '206 − 0.88 × age' : '208 − 0.7 × age');

export const SECTIONS = [
  {
    id: 'profile',
    title: 'Patient profile',
    fields: [
      // Under-18 records were excluded from the modeling population.
      { key: 'age', label: 'Age', unit: 'yrs', min: 18, max: 110, step: 1, limit: [1, 120], train: [18, 97], adultFrom: 18 },
      { key: 'height', label: 'Height', unit: 'cm', min: 120, max: 210, step: 1, limit: [50, 250], train: [141, 186] },
      { key: 'weight', label: 'Weight', unit: 'kg', min: 30, max: 200, step: 0.5, limit: [20, 400], train: [38, 101] },
    ],
  },
  {
    id: 'vitals',
    title: 'Blood pressure & glucose',
    fields: [
      { key: 'bp', label: 'Systolic blood pressure', unit: 'mmHg', min: 70, max: 220, step: 1, limit: [50, 300], train: [70, 220] },
      { key: 'rbs', label: 'Random blood sugar', unit: 'mmol/L', min: 3, max: 32, step: 0.1, limit: [1, 50], train: [3.16, 21.3], optional: true },
    ],
  },
  {
    id: 'lipids',
    title: 'Lipid profile',
    fields: [
      { key: 'totalCholesterol', label: 'Total cholesterol', unit: 'mg/dL', min: 100, max: 320, step: 1, limit: [50, 600], train: [120, 294] },
      { key: 'hdl', label: 'HDL', unit: 'mg/dL', min: 15, max: 90, step: 1, limit: [5, 150], train: [20, 80] },
      { key: 'ldl', label: 'LDL', unit: 'mg/dL', min: 40, max: 240, step: 1, limit: [10, 500], train: [48, 226] },
      { key: 'triglycerides', label: 'Triglycerides', unit: 'mg/dL', min: 40, max: 450, step: 1, limit: [20, 3000], train: [50, 400] },
    ],
  },
  {
    id: 'blood',
    title: 'Blood panel',
    fields: [
      { key: 'hemoglobin', label: 'Hemoglobin', unit: 'g/dL', min: 3, max: 18, step: 0.1, limit: [2, 25], train: [2.6, 17.6], optional: true },
      { key: 'creatinine', label: 'Creatinine', unit: 'mg/dL', min: 0.3, max: 10, step: 0.1, limit: [0.1, 20], train: [0.4, 9.5], optional: true },
      { key: 'platelets', label: 'Platelets', unit: '×10³/µL', min: 100, max: 600, step: 1, limit: [5, 1500], train: [100, 540], optional: true },
      { key: 'sodium', label: 'Sodium', unit: 'mmol/L', min: 110, max: 150, step: 0.1, limit: [100, 180], train: [112.5, 149.4], optional: true },
      { key: 'potassium', label: 'Potassium', unit: 'mmol/L', min: 2, max: 7, step: 0.1, limit: [1.5, 10], train: [2.3, 6.9], optional: true },
      { key: 'chloride', label: 'Chloride', unit: 'mmol/L', min: 75, max: 135, step: 0.1, limit: [60, 150], train: [78, 131.1], optional: true },
    ],
  },
];

export const HISTORY = [
  { key: 'familyHistory', label: 'Family history of heart disease' },
  { key: 'hypertension', label: 'Hypertension' },
  { key: 'diabetes', label: 'Diabetes' },
  { key: 'chestPain', label: 'History of chest pain' },
];

// The two platforms report in different units and are NOT interchangeable.
export const TROPONIN_ASSAYS = {
  // max is the same 500 ng/mL in both units (the backend's MAX_TROPONIN_NG_ML).
  quantitative: { label: 'Quantitative', unit: 'ng/mL', step: 0.01, placeholder: 'e.g. 0.02', max: 500 },
  'high-sensitivity': { label: 'High-sensitivity', unit: 'ng/L', step: 1, placeholder: 'e.g. 14', max: 500000 },
};

const base = {
  age: 45,
  sex: 'M',
  height: 159,
  weight: 63,
  familyHistory: 0,
  hypertension: 0,
  diabetes: 0,
  chestPain: 0,
  bp: 115,
  rbs: 6.7,
  totalCholesterol: 200,
  hdl: 45,
  ldl: 120,
  triglycerides: 150,
  hemoglobin: 12.7,
  creatinine: 1,
  platelets: 270,
  sodium: 139,
  potassium: 4.1,
  chloride: 101,
  troponinAssay: 'quantitative',
  troponin: '', // optional, and never defaulted: no sensible default for a cardiac marker
};

/** The keys a user can mark "Not measured". */
export const OPTIONAL_KEYS = SECTIONS.flatMap((s) => s.fields.filter((f) => f.optional).map((f) => f.key));

// Starting values sit at the training data's medians.
export const DEFAULTS = base;

// Made-up example patients for demos, not real records. Each one lands in its
// band with the deployed model (checked 2026-10-01: about 1%, 52% and >99%) and
// tells a clinical story the app's checks recognise:
//   low       a healthy adult, every value in range
//   moderate  someone with risk factors: treated high blood pressure, a family
//             history, borderline cholesterol, mildly overweight
//   high      an emergency: a hypertensive crisis and a raised Troponin-I
//             (possible heart-muscle injury) with chest pain and diabetes
// The model leans on the lipid panel (ml/README.md), so the moderate sample
// sits in a narrow zone: re-check all three after retraining
// (clinical.test.js and the backend's test_prediction_service.py do).
export const PRESETS = [
  {
    id: 'low',
    label: 'Low risk',
    description: 'Healthy 34-year-old woman: every value in the normal range.',
    values: {
      ...base, age: 34, sex: 'F', height: 156, weight: 54, bp: 110, rbs: 5.4,
      totalCholesterol: 170, hdl: 55, ldl: 95, triglycerides: 110, hemoglobin: 12.8,
      creatinine: 0.8, platelets: 260, sodium: 139, potassium: 4.1, chloride: 102,
      troponinAssay: 'quantitative', troponin: '0.01',
    },
  },
  {
    id: 'moderate',
    label: 'Moderate risk',
    description:
      '48-year-old man with risk factors: treated high blood pressure, a family history, borderline cholesterol, mildly overweight.',
    values: {
      ...base, age: 48, height: 165, weight: 74, familyHistory: 1, hypertension: 1, bp: 132,
      rbs: 6.4, totalCholesterol: 205, hdl: 40, ldl: 135, triglycerides: 150, hemoglobin: 13.6,
      creatinine: 1, platelets: 250, sodium: 139, potassium: 4.2, chloride: 101,
      troponinAssay: 'quantitative', troponin: '0.02',
    },
  },
  {
    id: 'high',
    label: 'High risk · urgent',
    description:
      '66-year-old man in an emergency: blood pressure 185 (crisis) and a raised Troponin-I, with chest pain and diabetes.',
    values: {
      ...base, age: 66, height: 162, weight: 78, familyHistory: 1, hypertension: 1, diabetes: 1,
      chestPain: 1, bp: 185, rbs: 14.5, totalCholesterol: 270, hdl: 32, ldl: 185,
      triglycerides: 280, hemoglobin: 11.2, creatinine: 1.9, platelets: 230, sodium: 134,
      potassium: 4.6, chloride: 99, troponinAssay: 'high-sensitivity', troponin: '850',
    },
  },
];

/**
 * Why the Troponin-I entry can't be used, or '' when it's fine. It's optional:
 * the model doesn't use it (it ran backwards in the training data), but a
 * value is checked against the assay's clinical limit and flagged if raised.
 */
export function troponinError(v) {
  const { unit, max } = TROPONIN_ASSAYS[v.troponinAssay];
  const n = Number(v.troponin);
  if (String(v.troponin).trim() === '') return '';
  if (!Number.isFinite(n) || n < 0) return 'Enter the result as a number of 0 or more.';
  if (n > max) return `That's above ${max.toLocaleString()} ${unit}. Check the value and the assay type.`;
  return '';
}

const round1 = (n) => Math.round(n * 10) / 10;

// Body for POST /api/predict/. Troponin goes as reported plus its assay type;
// converting ng/L to the model's ng/mL is the backend's job, next to the model.
export function toPayload(v) {
  return {
    age: v.age,
    sex: v.sex,
    height_cm: v.height,
    weight_kg: v.weight,
    bmi: round1(bmiFrom(v.height, v.weight)),
    family_history: v.familyHistory,
    hypertension: v.hypertension,
    diabetes: v.diabetes,
    chest_pain_history: v.chestPain,
    bp_mmhg: v.bp,
    rbs_mmol_l: v.rbs,
    total_cholesterol: v.totalCholesterol,
    hdl: v.hdl,
    ldl: v.ldl,
    triglycerides: v.triglycerides,
    max_hr: round1(maxHRFrom(v.age, v.sex)),
    hemoglobin: v.hemoglobin,
    creatinine: v.creatinine,
    platelets: v.platelets === null ? null : v.platelets * 1000, // the dataset stores a raw count per µL
    sodium: v.sodium,
    potassium: v.potassium,
    chloride: v.chloride,
    troponin_i: v.troponin === '' ? null : Number(v.troponin),
    troponin_assay: v.troponin === '' ? null : v.troponinAssay,
  };
}
