// Estimated glomerular filtration rate from serum creatinine, age and sex:
// the CKD-EPI 2021 equation (Inker et al., NEJM 2021), which has no race term.
//
//   eGFR = 142 × min(Scr/κ, 1)^α × max(Scr/κ, 1)^−1.200 × 0.9938^age × (1.012 if female)
//   κ = 0.7 (female) / 0.9 (male),  α = −0.241 (female) / −0.302 (male)
//
// Result in mL/min/1.73 m². Graded with the KDIGO 2012 GFR categories.

export function egfr(creatinineMgDl, age, sex) {
  if (!(creatinineMgDl > 0) || !(age >= 18) || (sex !== 'M' && sex !== 'F')) return null;
  const female = sex === 'F';
  const k = female ? 0.7 : 0.9;
  const a = female ? -0.241 : -0.302;
  const ratio = creatinineMgDl / k;
  return 142 * Math.min(ratio, 1) ** a * Math.max(ratio, 1) ** -1.2 * 0.9938 ** age * (female ? 1.012 : 1);
}

// KDIGO 2012 GFR categories. G1–G2 alone don't define kidney disease.
export const EGFR_BANDS = [
  [15, 'urgent', 'Kidney failure range (G5)', 'low'],
  [30, 'high', 'Severely decreased (G4)', 'low'],
  [45, 'high', 'Moderately to severely decreased (G3b)', 'low'],
  [60, 'elevated', 'Mildly to moderately decreased (G3a)', 'low'],
  [Infinity, 'normal', 'Normal or mildly decreased (G1–G2)'],
];
