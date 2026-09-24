// Sample assessment history until the Django History API exists
// (predictor/models.py will store each /api/predict/ call).
//
// Each record = the request the Prediction page sent (`inputs`, same keys as
// toPayload()) + the response it got back (`result`, the API contract).
// Made-up data for one demo patient; newest last.

const base = {
  age: 52, sex: 'M', height_cm: 168, family_history: 1, hypertension: 1,
  diabetes: 0, chest_pain_history: 0, hemoglobin: 13.8, platelets: 250000,
  sodium: 138, potassium: 4.4, chloride: 101,
};

const record = (id, created_at, inputs, probability, risk_level, top_factors) => ({
  id,
  created_at,
  inputs: { ...base, ...inputs },
  result: { probability, risk_level, top_factors },
});

export const historyMock = [
  record('A-1041', '2026-02-12T09:40:00', {
    weight_kg: 82, bp_mmhg: 150, rbs_mmol_l: 9.8, total_cholesterol: 262, hdl: 36, ldl: 172,
    triglycerides: 240, creatinine: 1.2, troponin_i: 0.03, troponin_assay: 'quantitative',
  }, 0.72, 'high', [
    { name: 'LDL', contribution: 0.142 },
    { name: 'Blood pressure', contribution: 0.081 },
    { name: 'Random blood sugar', contribution: 0.064 },
    { name: 'Triglycerides', contribution: 0.052 },
    { name: 'HDL', contribution: 0.041 },
  ]),
  record('A-1107', '2026-03-28T11:15:00', {
    weight_kg: 81, bp_mmhg: 146, rbs_mmol_l: 9.1, total_cholesterol: 250, hdl: 37, ldl: 160,
    triglycerides: 225, creatinine: 1.2, troponin_i: 0.02, troponin_assay: 'quantitative',
  }, 0.64, 'moderate', [
    { name: 'LDL', contribution: 0.118 },
    { name: 'Blood pressure', contribution: 0.069 },
    { name: 'Random blood sugar', contribution: 0.055 },
    { name: 'Triglycerides', contribution: 0.044 },
    { name: 'Age', contribution: 0.031 },
  ]),
  // The lab switched to the high-sensitivity assay from here on.
  record('A-1182', '2026-05-09T10:05:00', {
    weight_kg: 80, bp_mmhg: 140, rbs_mmol_l: 8.4, total_cholesterol: 236, hdl: 39, ldl: 148,
    triglycerides: 205, creatinine: 1.1, hemoglobin: 14.0, troponin_i: 9, troponin_assay: 'high-sensitivity',
  }, 0.55, 'moderate', [
    { name: 'LDL', contribution: 0.094 },
    { name: 'Blood pressure', contribution: 0.052 },
    { name: 'Random blood sugar', contribution: 0.041 },
    { name: 'Hypertension', contribution: 0.036 },
    { name: 'HDL', contribution: 0.022 },
  ]),
  record('A-1236', '2026-06-20T08:50:00', {
    weight_kg: 79, bp_mmhg: 134, rbs_mmol_l: 7.6, total_cholesterol: 221, hdl: 41, ldl: 132,
    triglycerides: 188, creatinine: 1.1, hemoglobin: 14.1, troponin_i: 7, troponin_assay: 'high-sensitivity',
  }, 0.41, 'moderate', [
    { name: 'LDL', contribution: 0.061 },
    { name: 'Hypertension', contribution: 0.034 },
    { name: 'Blood pressure', contribution: 0.028 },
    { name: 'Creatinine', contribution: -0.021 },
    { name: 'HDL', contribution: 0.018 },
  ]),
  record('A-1301', '2026-08-01T15:20:00', {
    weight_kg: 77, bp_mmhg: 128, rbs_mmol_l: 7.0, total_cholesterol: 205, hdl: 43, ldl: 118,
    triglycerides: 170, creatinine: 1.0, hemoglobin: 14.3, troponin_i: 6, troponin_assay: 'high-sensitivity',
  }, 0.3, 'low', [
    { name: 'LDL', contribution: -0.048 },
    { name: 'Triglycerides', contribution: -0.031 },
    { name: 'Hypertension', contribution: 0.029 },
    { name: 'Random blood sugar', contribution: -0.022 },
    { name: 'Age', contribution: 0.017 },
  ]),
  record('A-1362', '2026-09-21T14:32:00', {
    weight_kg: 76, bp_mmhg: 122, rbs_mmol_l: 6.4, total_cholesterol: 192, hdl: 46, ldl: 104,
    triglycerides: 150, creatinine: 1.0, hemoglobin: 14.4, troponin_i: 5, troponin_assay: 'high-sensitivity',
  }, 0.18, 'low', [
    { name: 'LDL', contribution: -0.081 },
    { name: 'Total cholesterol', contribution: -0.052 },
    { name: 'Blood pressure', contribution: -0.037 },
    { name: 'Triglycerides', contribution: -0.029 },
    { name: 'Hypertension', contribution: 0.024 },
  ]),
];
