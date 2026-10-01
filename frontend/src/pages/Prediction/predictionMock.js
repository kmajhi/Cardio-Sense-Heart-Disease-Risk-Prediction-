// Demo-mode stand-in for POST /api/predict/ (no server). Same shape as the real API:
//   { probability, risk_level, top_factors: [{ name, contribution }], missing_fields, low_confidence }
//
// The numbers come from a rough hand-tuned score, NOT the trained model, and
// the UI says so wherever they appear (components/DemoBanner.jsx). Like the
// deployed model it ignores Troponin-I, and labs sent as null are left out
// and reported in missing_fields.

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

const INTERCEPT = -0.3;
const SCALE = 0.45; // keeps the samples in a believable 20–95% band

// The labs a user may mark "Not measured" (the backend's OPTIONAL_FIELDS).
const OPTIONAL = [
  ['rbs_mmol_l', 'Random blood sugar'],
  ['hemoglobin', 'Hemoglobin'],
  ['creatinine', 'Creatinine'],
  ['platelets', 'Platelets'],
  ['sodium', 'Sodium'],
  ['potassium', 'Potassium'],
  ['chloride', 'Chloride'],
];
const LOW_CONFIDENCE_MISSING = 3;
// The training data's range for the inputs most often outside it (the backend
// reads every field's range from model_metadata.json).
const TRAINED = [
  ['age', 'Age', 'years', 18, 97],
  ['height_cm', 'Height', 'cm', 141, 186],
  ['weight_kg', 'Weight', 'kg', 38, 101],
  ['bmi', 'BMI', 'kg/m²', 14.7, 43.5],
];
const absent = (v) => v === null || v === undefined || v === '';

function terms(p) {
  const yes = (flag, up, down) => (flag ? up : down);
  // A left-out lab contributes nothing, as if it sat at the typical value.
  const lab = (key, f) => (absent(p[key]) ? 0 : f(p[key]));

  return [
    ['Age', ((p.age - 45) / 10) * 0.35],
    ['Sex', p.sex === 'M' ? 0.2 : -0.2],
    ['History of chest pain', yes(p.chest_pain_history, 0.6, -0.2)],
    ['Hypertension', yes(p.hypertension, 0.4, -0.1)],
    ['Diabetes', yes(p.diabetes, 0.35, -0.08)],
    ['Family history of heart disease', yes(p.family_history, 0.3, -0.06)],
    ['Blood pressure', ((p.bp_mmhg - 115) / 20) * 0.3],
    ['Random blood sugar', lab('rbs_mmol_l', (v) => ((v - 6.7) / 4) * 0.3)],
    ['Total cholesterol', ((p.total_cholesterol - 200) / 40) * 0.25],
    ['HDL', (-(p.hdl - 45) / 10) * 0.3],
    ['LDL', ((p.ldl - 120) / 40) * 0.2],
    ['Triglycerides', ((p.triglycerides - 150) / 80) * 0.15],
    ['Creatinine', lab('creatinine', (v) => (v - 1) * 0.35)],
    ['Hemoglobin', lab('hemoglobin', (v) => (-(v - 12.7) / 2) * 0.2)],
    ['BMI', ((p.bmi - 25) / 5) * 0.15],
  ];
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function mockPredict(payload) {
  await delay(650);

  const parts = terms(payload).map(([name, value]) => [name, value * SCALE]);
  const logit = parts.reduce((sum, [, value]) => sum + value, 0);
  const probability = sigmoid(INTERCEPT + logit);

  // Share the move away from the baseline across the terms, so the
  // contributions add up like a SHAP breakdown (in probability units).
  const baseline = sigmoid(INTERCEPT);
  const perLogit = logit === 0 ? 0 : (probability - baseline) / logit;
  const top_factors = parts
    .map(([name, value]) => ({ name, contribution: Math.round(value * perLogit * 1000) / 1000 }))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 5);

  const missing_fields = OPTIONAL.filter(([key]) => absent(payload[key])).map(([, label]) => label);
  const outside_training = TRAINED.filter(([key, , , lo, hi]) => !absent(payload[key]) && (payload[key] < lo || payload[key] > hi)).map(
    ([key, name, unit, min, max]) => ({ name, value: payload[key], min, max, unit }),
  );
  return {
    probability: Math.round(probability * 1000) / 1000,
    risk_level: probability < 0.35 ? 'low' : probability < 0.65 ? 'moderate' : 'high',
    top_factors: top_factors.filter((f) => f.contribution !== 0),
    missing_fields,
    outside_training,
    low_confidence: missing_fields.length >= LOW_CONFIDENCE_MISSING || outside_training.length > 0,
  };
}
