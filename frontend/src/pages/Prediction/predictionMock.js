// Stand-in for POST /api/predict/ until the Django endpoint exists.
// Returns the same shape as the real API:
//   { probability, risk_level, top_factors: [{ name, contribution }] }
//
// The numbers come from a rough hand-tuned score, NOT the trained model. They
// only exist so the page has plausible output to render during frontend work.

const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);
const sigmoid = (z) => 1 / (1 + Math.exp(-z));

const INTERCEPT = -0.3;
const SCALE = 0.45; // keeps the samples in a believable 20–95% band

function terms(p) {
  const troponinNgMl = p.troponin_assay === 'high-sensitivity' ? p.troponin_i / 1000 : p.troponin_i;
  const yes = (flag, up, down) => (flag ? up : down);

  return [
    ['Troponin-I', clamp(Math.log10(Math.max(troponinNgMl, 0.001) / 0.04), -1.5, 4) * 0.75],
    ['Age', ((p.age - 45) / 10) * 0.35],
    ['Sex', p.sex === 'M' ? 0.2 : -0.2],
    ['History of chest pain', yes(p.chest_pain_history, 0.6, -0.2)],
    ['Hypertension', yes(p.hypertension, 0.4, -0.1)],
    ['Diabetes', yes(p.diabetes, 0.35, -0.08)],
    ['Family history of heart disease', yes(p.family_history, 0.3, -0.06)],
    ['Blood pressure', ((p.bp_mmhg - 115) / 20) * 0.3],
    ['Random blood sugar', ((p.rbs_mmol_l - 6.7) / 4) * 0.3],
    ['Total cholesterol', ((p.total_cholesterol - 200) / 40) * 0.25],
    ['HDL', (-(p.hdl - 45) / 10) * 0.3],
    ['LDL', ((p.ldl - 120) / 40) * 0.2],
    ['Triglycerides', ((p.triglycerides - 150) / 80) * 0.15],
    ['Creatinine', (p.creatinine - 1) * 0.35],
    ['Hemoglobin', (-(p.hemoglobin - 12.7) / 2) * 0.2],
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

  return {
    probability: Math.round(probability * 1000) / 1000,
    risk_level: probability < 0.35 ? 'low' : probability < 0.65 ? 'moderate' : 'high',
    top_factors,
  };
}
