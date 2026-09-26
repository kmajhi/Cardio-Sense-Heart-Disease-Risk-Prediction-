// Turns one assessment into the user-facing notification: the model's overall
// risk plus one grouped alert per topic with values outside healthy ranges.
// The two parts are always kept apart, because an abnormal value is not proof
// of heart disease and a high estimate doesn't mean any single value is wrong.
import { analyze } from './analyze';
import { RISK, pctText, riskLevel } from './risk';

function riskMessage(level, pct, groups) {
  const anyOutside = groups.length > 0;
  if (level === 'high') {
    return (
      `The model estimates a ${pct}% probability of heart disease, in the high band (${RISK.high.range}). ` +
      'This is a statistical estimate, not a diagnosis. Review the health guidance and consider booking ' +
      'a check-up with a qualified doctor.'
    );
  }
  if (level === 'moderate') {
    return (
      `The model estimates a ${pct}% probability, in the moderate band (${RISK.moderate.range}). ` +
      'Worth reviewing your habits and discussing your risk factors at a routine check-up.'
    );
  }
  return anyOutside
    ? `The model’s overall estimate is low (${pct}%), but some values are outside healthy ranges and deserve attention on their own.`
    : `The model estimates a low probability (${pct}%). Keep up heart-healthy habits.`;
}

/**
 * assessment: { id?, created_at?, inputs, result: { probability, risk_level } }
 * → { key, risk, groups, urgent, analysis, count, headline, needsAttention }
 */
export function buildNotification(assessment) {
  if (!assessment?.inputs || !assessment?.result) return null;
  const { inputs, result } = assessment;
  const analysis = analyze(inputs);
  const level = RISK[result.risk_level] ? result.risk_level : riskLevel(result.probability);
  const pct = pctText(result.probability);

  const risk = {
    level,
    pct,
    label: RISK[level].label,
    title: level === 'high' ? 'High estimated risk' : level === 'moderate' ? 'Moderate estimated risk' : 'Low estimated risk',
    body: riskMessage(level, pct, analysis.groups),
    // When nothing is out of range, say where a high estimate comes from.
    note:
      level !== 'low' && analysis.groups.length === 0
        ? 'None of the entered values is outside its reference range: the estimate comes from the combination of factors.'
        : '',
  };

  const urgent = analysis.groups.filter((g) => g.level === 'urgent');
  const count = analysis.flagged.length;
  const areas = analysis.groups.length;
  const headline = [
    level !== 'low' ? risk.label : null,
    areas ? `${areas} ${areas === 1 ? 'area needs' : 'areas need'} attention` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return {
    key: assessment.id ?? assessment.created_at ?? JSON.stringify(inputs),
    createdAt: assessment.created_at ?? null,
    risk,
    groups: analysis.groups,
    urgent,
    analysis,
    count,
    headline: headline || 'No alerts: values in range and low estimated risk',
    // Worth a bell dot: anything beyond "low risk, all in range".
    needsAttention: level !== 'low' || areas > 0,
  };
}
