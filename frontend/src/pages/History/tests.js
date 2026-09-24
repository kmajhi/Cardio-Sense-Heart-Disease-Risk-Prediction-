// The lab tests a record can hold, keyed like the /api/predict/ payload
// (see ../Prediction/fields.js → toPayload), with display units and a
// typical adult reference range used only for a gentle "outside range" flag.
// Labs set their own ranges, so the UI always says "typical".

export const TESTS = [
  { key: 'bp_mmhg', label: 'Blood pressure', unit: 'mmHg', group: 'Vitals', high: 139 },
  { key: 'rbs_mmol_l', label: 'Random blood sugar', unit: 'mmol/L', group: 'Vitals', high: 7.7, digits: 1 },
  { key: 'total_cholesterol', label: 'Total cholesterol', unit: 'mg/dL', group: 'Lipids', high: 199 },
  { key: 'ldl', label: 'LDL', unit: 'mg/dL', group: 'Lipids', high: 129 },
  { key: 'hdl', label: 'HDL', unit: 'mg/dL', group: 'Lipids', low: { M: 40, F: 50 }, higherIsBetter: true },
  { key: 'triglycerides', label: 'Triglycerides', unit: 'mg/dL', group: 'Lipids', high: 149 },
  { key: 'hemoglobin', label: 'Hemoglobin', unit: 'g/dL', group: 'Blood panel', low: { M: 13.5, F: 12 }, high: { M: 17.5, F: 15.5 }, digits: 1 },
  { key: 'creatinine', label: 'Creatinine', unit: 'mg/dL', group: 'Blood panel', low: { M: 0.7, F: 0.6 }, high: { M: 1.3, F: 1.1 }, digits: 1 },
  { key: 'platelets', label: 'Platelets', unit: '×10³/µL', group: 'Blood panel', low: 150, high: 400, scale: 1 / 1000 },
  { key: 'sodium', label: 'Sodium', unit: 'mmol/L', group: 'Blood panel', low: 135, high: 145 },
  { key: 'potassium', label: 'Potassium', unit: 'mmol/L', group: 'Blood panel', low: 3.5, high: 5.1, digits: 1 },
  { key: 'chloride', label: 'Chloride', unit: 'mmol/L', group: 'Blood panel', low: 98, high: 107 },
  { key: 'troponin_i', label: 'Troponin-I', group: 'Cardiac marker', troponin: true },
];

// Troponin units depend on the assay, and the two assays aren't interchangeable.
export const TROPONIN = {
  quantitative: { name: 'Quantitative', unit: 'ng/mL', high: 0.04, digits: 2 },
  'high-sensitivity': { name: 'High-sensitivity', unit: 'ng/L', high: 14, digits: 0 },
};

const bySex = (limit, sex) => (limit && typeof limit === 'object' ? limit[sex] : limit);

/** Display value, unit and typical range for one test in one record. */
export function reading(test, inputs) {
  const raw = inputs[test.key];
  if (raw === null || raw === undefined || raw === '') return null;

  if (test.troponin) {
    const assay = TROPONIN[inputs.troponin_assay];
    return { value: raw, unit: assay.unit, digits: assay.digits, high: assay.high, assay: inputs.troponin_assay };
  }
  return {
    value: raw * (test.scale ?? 1),
    unit: test.unit,
    digits: test.digits ?? 0,
    low: bySex(test.low, inputs.sex),
    high: bySex(test.high, inputs.sex),
  };
}

export function status(r) {
  if (!r) return 'missing';
  if (r.high !== undefined && r.value > r.high) return 'high';
  if (r.low !== undefined && r.value < r.low) return 'low';
  return 'ok';
}

export const fmt = (r) => (r ? r.value.toFixed(r.digits) : '—');

export function rangeText(r) {
  if (!r) return '';
  const d = r.digits;
  if (r.low !== undefined && r.high !== undefined) return `${r.low.toFixed(d)}–${r.high.toFixed(d)}`;
  if (r.high !== undefined) return `≤ ${r.high.toFixed(d)}`;
  return `≥ ${r.low.toFixed(d)}`;
}

/** Latest-vs-previous change, or why there isn't one. */
export function change(latest, previous) {
  if (!latest || !previous) return { comparable: false, reason: 'No earlier result' };
  if (latest.assay && latest.assay !== previous.assay) {
    return { comparable: false, reason: 'Assay changed' };
  }
  return { comparable: true, delta: latest.value - previous.value };
}
