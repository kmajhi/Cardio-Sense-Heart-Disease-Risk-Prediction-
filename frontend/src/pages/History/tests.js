// The lab tests a record can hold, keyed like the /api/predict/ payload
// (see ../Prediction/fields.js → toPayload). Ranges and statuses come from the
// shared clinical module (src/clinical), the same one behind the notifications
// and the Guidance page, so every page judges a value the same way. Labs set
// their own ranges, so the UI always says "typical".
import { analyze } from '../../clinical/analyze';

export const TESTS = [
  { key: 'bp_mmhg', label: 'Systolic BP', unit: 'mmHg', group: 'Vitals' },
  { key: 'rbs_mmol_l', label: 'Random blood sugar', unit: 'mmol/L', group: 'Vitals' },
  { key: 'total_cholesterol', label: 'Total cholesterol', unit: 'mg/dL', group: 'Lipids' },
  { key: 'ldl', label: 'LDL', unit: 'mg/dL', group: 'Lipids' },
  { key: 'hdl', label: 'HDL', unit: 'mg/dL', group: 'Lipids' },
  { key: 'triglycerides', label: 'Triglycerides', unit: 'mg/dL', group: 'Lipids' },
  { key: 'hemoglobin', label: 'Hemoglobin', unit: 'g/dL', group: 'Blood panel' },
  { key: 'creatinine', label: 'Creatinine', unit: 'mg/dL', group: 'Blood panel' },
  { key: 'platelets', label: 'Platelets', unit: '×10³/µL', group: 'Blood panel' },
  { key: 'sodium', label: 'Sodium', unit: 'mmol/L', group: 'Blood panel' },
  { key: 'potassium', label: 'Potassium', unit: 'mmol/L', group: 'Blood panel' },
  { key: 'chloride', label: 'Chloride', unit: 'mmol/L', group: 'Blood panel' },
  { key: 'troponin_i', label: 'Troponin-I', group: 'Cardiac marker', troponin: true },
];

// Troponin units depend on the assay, and the two assays aren't interchangeable.
export const TROPONIN = {
  quantitative: { name: 'Quantitative', unit: 'ng/mL', digits: 2 },
  'high-sensitivity': { name: 'High-sensitivity', unit: 'ng/L', digits: 0 },
};

// Displayed decimals per test (the clinical module formats its own labels).
const DIGITS = { rbs_mmol_l: 1, hemoglobin: 1, creatinine: 1, potassium: 1 };

// One analysis per record's inputs, however many cells read from it.
const cache = new WeakMap();
const analysisOf = (inputs) => {
  if (!cache.has(inputs)) cache.set(inputs, analyze(inputs));
  return cache.get(inputs);
};

/** Display value, unit, typical range and clinical level for one test in one record. */
export function reading(test, inputs) {
  const f = analysisOf(inputs).find(test.key);
  if (!f || f.status === 'missing') return null;
  const assay = test.troponin ? inputs.troponin_assay : undefined;
  return {
    value: f.value,
    unit: test.troponin ? TROPONIN[assay].unit : test.unit,
    digits: test.troponin ? TROPONIN[assay].digits : DIGITS[test.key] ?? 0,
    range: f.range,
    level: f.level,
    dir: f.dir,
    band: f.band,
    uncertain: f.status === 'uncertain',
    assay,
  };
}

export function status(r) {
  if (!r) return 'missing';
  if (r.uncertain || r.level === 'normal') return 'ok';
  return r.dir === 'low' ? 'low' : 'high';
}

export const fmt = (r) => (r ? r.value.toFixed(r.digits) : '—');

export const rangeText = (r) => r?.range ?? '';

/** Latest-vs-previous change, or why there isn't one. */
export function change(latest, previous) {
  if (!latest || !previous) return { comparable: false, reason: 'No earlier result' };
  if (latest.assay && latest.assay !== previous.assay) {
    return { comparable: false, reason: 'Assay changed' };
  }
  return { comparable: true, delta: latest.value - previous.value };
}
