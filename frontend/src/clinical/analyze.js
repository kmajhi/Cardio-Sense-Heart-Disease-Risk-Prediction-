// Feature-level analysis: checks each of the 21 prediction inputs against the
// clinical ranges in ranges.js and groups what's outside them. Pure functions,
// no React, so the same logic serves the Prediction, History, Dashboard and
// Guidance pages and is unit-tested (clinical.test.js).
//
// Input: an /api/predict/ request body (fields.js → toPayload). Output:
//   findings  every feature with its value, level and reference range
//   flagged   the findings above 'normal'
//   groups    flagged findings grouped by topic, most serious first
//   missing   features that weren't measured
import { AGE_RISK, BMI, GROUPS, GROUP_ORDER, HISTORY, MEASURES, TROPONIN, band, rank, worst } from './ranges';
import { EGFR_BANDS, egfr } from './egfr';

const num = (v) => {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const fmt = (n, digits) => n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

// A finding keeps the feature's name in `label` and the range it falls in (e.g.
// "Stage 2 hypertension range") in `band`.
const graded = ({ level, label, dir }) => ({ level, band: label, dir: dir ?? null, status: status(level) });

const bandsFor = (spec, sex) => (typeof spec.bands === 'function' ? spec.bands(sex) : spec.bands);

function measured(spec, inputs, sex) {
  const base = {
    key: spec.key,
    label: spec.label,
    short: spec.short ?? spec.label,
    unit: spec.unit,
    group: spec.group,
    kind: 'measure',
    source: spec.source,
    range: spec.range(sex),
  };
  const raw = num(inputs[spec.key]);
  if (raw === null) return { ...base, value: null, level: null, status: 'missing' };

  const value = raw * (spec.scale ?? 1);
  // Graded as displayed, so the label always agrees with the number shown
  // (145.4 shows as "145" and is Normal, not "145 · High").
  const shown = Number(value.toFixed(spec.digits));
  let result = band(bandsFor(spec, sex), shown);
  const extra = {};

  if (spec.key === 'creatinine') {
    // Creatinine alone depends on muscle mass; eGFR adds age and sex.
    const gfr = egfr(value, num(inputs.age), sex);
    if (gfr !== null) {
      extra.egfr = gfr;
      const g = band(EGFR_BANDS, gfr);
      if (rank(g.level) > rank(result.level)) result = { level: g.level, label: `eGFR ${Math.round(gfr)}: ${g.label}` };
      else if (result.level !== 'normal') result = { ...result, label: `${result.label} (eGFR ${Math.round(gfr)})` };
      if (result.level !== 'normal') result.dir = 'high'; // high creatinine = low eGFR
    }
  }

  return { ...base, value, display: fmt(value, spec.digits), ...graded(result), ...extra };
}

const status = (level) => (level === 'normal' ? 'ok' : 'flagged');

function troponin(inputs, sex) {
  const conf = TROPONIN[inputs.troponin_assay];
  const base = { key: 'troponin_i', label: 'Troponin-I', short: 'Troponin-I', group: 'cardiac', kind: 'measure' };
  const raw = num(inputs.troponin_i);
  if (raw === null || !conf) {
    return { ...base, unit: conf?.unit ?? '', value: null, level: null, status: 'missing', source: conf?.source ?? '' };
  }
  const limit = conf.limit(sex);
  const q = inputs.troponin_qualifier;
  const out = {
    ...base,
    unit: conf.unit,
    source: conf.source,
    range: `≤ ${fmt(limit, conf.digits)}`,
    value: raw,
    display: `${q === '<' || q === '>' ? q : ''}${fmt(raw, conf.digits)}`,
    assay: inputs.troponin_assay,
  };
  // A censored report ("<2.5", ">25000") only tells us one side of the value.
  const surelyAbove = q === '<' ? false : raw > limit;
  const surelyWithin = q === '>' ? false : raw <= limit;
  if (surelyAbove) {
    return { ...out, ...graded({ level: 'urgent', label: 'Above the 99th-percentile limit (possible heart muscle injury)', dir: 'high' }) };
  }
  if (surelyWithin) return { ...out, ...graded({ level: 'normal', label: 'Within the reference limit' }) };
  return { ...out, level: null, band: 'Censored result: can’t tell if it’s above the limit', dir: null, status: 'uncertain' };
}

function bmi(inputs) {
  const h = num(inputs.height_cm);
  const w = num(inputs.weight_kg);
  const base = { key: 'bmi', label: BMI.label, short: BMI.short, unit: BMI.unit, group: BMI.group, kind: 'derived', source: BMI.source, range: BMI.range() };
  if (!(h > 0) || !(w > 0)) return { ...base, value: null, level: null, status: 'missing' };
  const value = w / (h / 100) ** 2;
  return { ...base, value, display: fmt(value, BMI.digits), ...graded(band(BMI.bands, value)) };
}

function reported(spec, inputs) {
  const v = num(inputs[spec.key]);
  const base = { key: spec.key, label: spec.label, short: spec.label, group: spec.group, kind: 'history', source: spec.source };
  if (v === null) return { ...base, value: null, level: null, status: 'missing' };
  if (v === 1) return { ...base, value: 1, display: 'Yes', ...graded({ level: spec.level, label: 'Reported' }) };
  return { ...base, value: 0, display: 'No', ...graded({ level: 'normal', label: 'Not reported' }) };
}

/** One-line description of a flagged finding, e.g. "Blood pressure 160 mmHg · Stage 2 hypertension range". */
export function describe(f) {
  if (f.kind === 'history') return f.label;
  return `${f.short} ${f.display}${f.unit ? ` ${f.unit}` : ''} · ${f.band}`;
}

/**
 * All 21 inputs → findings. Age and sex aren't judged (they're not "abnormal"),
 * height and weight are judged through BMI, and max heart rate is a formula.
 */
export function analyze(inputs = {}) {
  const sex = inputs.sex === 'F' ? 'F' : 'M';
  const age = num(inputs.age);

  const findings = [
    troponin(inputs, sex),
    ...MEASURES.map((spec) => measured(spec, inputs, sex)),
    bmi(inputs),
    ...HISTORY.map((spec) => reported(spec, inputs)),
  ];

  const flagged = findings.filter((f) => f.status === 'flagged');
  const groups = GROUP_ORDER.map((id) => {
    const items = flagged.filter((f) => f.group === id).sort((a, b) => rank(b.level) - rank(a.level));
    return items.length ? { id, ...GROUPS[id], level: worst(items.map((f) => f.level)), findings: items } : null;
  })
    .filter(Boolean)
    .sort((a, b) => rank(b.level) - rank(a.level)); // stable: ties keep GROUP_ORDER

  return {
    sex,
    age,
    ageRisk: age !== null && age >= AGE_RISK[sex],
    weightKg: num(inputs.weight_kg),
    findings,
    flagged,
    groups,
    level: worst(flagged.map((f) => f.level)),
    missing: findings.filter((f) => f.status === 'missing').map((f) => f.label),
    uncertain: findings.filter((f) => f.status === 'uncertain'),
    find: (key) => findings.find((f) => f.key === key),
  };
}
