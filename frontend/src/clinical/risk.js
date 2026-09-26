// MODEL-DERIVED RISK. The model returns a probability; the project's bands
// turn it into a level. They must match the backend's RISK_BANDS
// (backend/predictor/services/prediction_service.py). They are a presentation
// choice for this prototype, not clinically validated cut-offs.

export const RISK_BANDS = [
  { level: 'low', below: 0.35 },
  { level: 'moderate', below: 0.65 },
  { level: 'high', below: Infinity },
];

export const RISK = {
  low: { label: 'Low risk', range: 'under 35%', tone: 'low' },
  moderate: { label: 'Moderate risk', range: '35–64%', tone: 'moderate' },
  high: { label: 'High risk', range: '65% and above', tone: 'high' },
};

export const riskLevel = (probability) => RISK_BANDS.find((b) => probability < b.below).level;

/** "72", "<1" or ">99": a model estimate is never a flat 0% or 100%. */
export function pctText(probability) {
  const pct = Math.round(probability * 100);
  return pct < 1 ? '<1' : pct > 99 ? '>99' : String(pct);
}
