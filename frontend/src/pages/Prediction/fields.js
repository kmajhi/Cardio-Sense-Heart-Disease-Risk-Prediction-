// Inputs for the Northern Bangladesh model (see ml/notebooks and ml/training/data.py).
// Slider ranges follow the training data, so they don't invite values the
// model has never seen. Typed values outside a range are still accepted.

export const bmiFrom = (heightCm, weightKg) => weightKg / (heightCm / 100) ** 2;

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
      { key: 'age', label: 'Age', unit: 'yrs', min: 18, max: 97, step: 1 },
      { key: 'height', label: 'Height', unit: 'cm', min: 140, max: 190, step: 1 },
      { key: 'weight', label: 'Weight', unit: 'kg', min: 35, max: 110, step: 0.5 },
    ],
  },
  {
    id: 'vitals',
    title: 'Blood pressure & glucose',
    fields: [
      { key: 'bp', label: 'Blood pressure', unit: 'mmHg', min: 70, max: 220, step: 1 },
      { key: 'rbs', label: 'Random blood sugar', unit: 'mmol/L', min: 3, max: 32, step: 0.1 },
    ],
  },
  {
    id: 'lipids',
    title: 'Lipid profile',
    fields: [
      { key: 'totalCholesterol', label: 'Total cholesterol', unit: 'mg/dL', min: 100, max: 320, step: 1 },
      { key: 'hdl', label: 'HDL', unit: 'mg/dL', min: 15, max: 90, step: 1 },
      { key: 'ldl', label: 'LDL', unit: 'mg/dL', min: 40, max: 240, step: 1 },
      { key: 'triglycerides', label: 'Triglycerides', unit: 'mg/dL', min: 40, max: 450, step: 1 },
    ],
  },
  {
    id: 'blood',
    title: 'Blood panel',
    fields: [
      { key: 'hemoglobin', label: 'Hemoglobin', unit: 'g/dL', min: 3, max: 18, step: 0.1 },
      { key: 'creatinine', label: 'Creatinine', unit: 'mg/dL', min: 0.3, max: 10, step: 0.1 },
      { key: 'platelets', label: 'Platelets', unit: '×10³/µL', min: 100, max: 600, step: 1 },
      { key: 'sodium', label: 'Sodium', unit: 'mmol/L', min: 110, max: 150, step: 0.1 },
      { key: 'potassium', label: 'Potassium', unit: 'mmol/L', min: 2, max: 7, step: 0.1 },
      { key: 'chloride', label: 'Chloride', unit: 'mmol/L', min: 75, max: 135, step: 0.1 },
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
  quantitative: { label: 'Quantitative', unit: 'ng/mL', step: 0.01, placeholder: 'e.g. 0.02' },
  'high-sensitivity': { label: 'High-sensitivity', unit: 'ng/L', step: 1, placeholder: 'e.g. 14' },
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
  troponin: '', // must be entered: no sensible default for a cardiac marker
};

// Starting values sit at the training data's medians.
export const DEFAULTS = base;

// Made-up example patients for demos, not real records.
export const PRESETS = [
  {
    id: 'low',
    label: 'Lower-risk sample',
    values: {
      ...base, age: 34, sex: 'F', height: 156, weight: 54, bp: 110, rbs: 5.4,
      totalCholesterol: 170, hdl: 55, ldl: 95, triglycerides: 110, hemoglobin: 12.8,
      creatinine: 0.8, platelets: 260, sodium: 139, potassium: 4.1, chloride: 102,
      troponinAssay: 'quantitative', troponin: '0.01',
    },
  },
  {
    id: 'moderate',
    label: 'Moderate sample',
    values: {
      ...base, age: 55, height: 165, weight: 72, familyHistory: 1, hypertension: 1, bp: 135,
      rbs: 7.8, totalCholesterol: 225, hdl: 38, ldl: 150, triglycerides: 190, hemoglobin: 13.5,
      creatinine: 1.1, platelets: 250, sodium: 138, potassium: 4.3, chloride: 101,
      troponinAssay: 'quantitative', troponin: '0.03',
    },
  },
  {
    id: 'high',
    label: 'Higher-risk sample',
    values: {
      ...base, age: 66, height: 162, weight: 78, familyHistory: 1, hypertension: 1, diabetes: 1,
      chestPain: 1, bp: 160, rbs: 13.5, totalCholesterol: 260, hdl: 32, ldl: 180,
      triglycerides: 260, hemoglobin: 11.2, creatinine: 1.9, platelets: 230, sodium: 134,
      potassium: 4.6, chloride: 99, troponinAssay: 'high-sensitivity', troponin: '850',
    },
  },
];

export const troponinMissing = (v) => v.troponin === '' || !(Number(v.troponin) >= 0);

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
    platelets: v.platelets * 1000, // the dataset stores a raw count per µL
    sodium: v.sodium,
    potassium: v.potassium,
    chloride: v.chloride,
    troponin_i: v.troponin === '' ? null : Number(v.troponin),
    troponin_assay: v.troponinAssay,
  };
}
