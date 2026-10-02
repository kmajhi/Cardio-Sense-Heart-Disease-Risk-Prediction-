// "What is this?" help for every input on the Prediction page: a plain-language
// explanation, where to find the value (or how it's measured), unit
// conversions, and the clinical levels from src/clinical/ranges.js, so the help,
// the live level chips and the post-result checks always agree.
import { AGE_RISK, BMI, MEASURES, TROPONIN } from '../../clinical/ranges';

// Form key → the /api/predict/ key that ranges.js and analyze.js use.
export const PAYLOAD_KEY = {
  bp: 'bp_mmhg',
  rbs: 'rbs_mmol_l',
  totalCholesterol: 'total_cholesterol',
  hdl: 'hdl',
  ldl: 'ldl',
  triglycerides: 'triglycerides',
  hemoglobin: 'hemoglobin',
  creatinine: 'creatinine',
  platelets: 'platelets',
  sodium: 'sodium',
  potassium: 'potassium',
  chloride: 'chloride',
  familyHistory: 'family_history',
  hypertension: 'hypertension',
  diabetes: 'diabetes',
  chestPain: 'chest_pain_history',
};

export const INFO = {
  age: {
    title: 'Age',
    what: 'The patient’s age in whole years. Risk of heart disease rises with age.',
    find: 'Use completed years, as on the patient’s record.',
    note: 'The model only estimates adults (18 or over): its training data had no healthy children.',
  },
  sex: {
    title: 'Sex',
    what: 'Sex as recorded on the medical record.',
    find: 'Several reference ranges differ by sex (HDL, hemoglobin, creatinine, high-sensitivity troponin), and so does the maximum heart rate formula.',
  },
  height: {
    title: 'Height',
    what: 'Standing height, used with weight to calculate body mass index (BMI).',
    find: 'Measured without shoes. 1 inch = 2.54 cm; 5 ft 6 in ≈ 168 cm.',
  },
  weight: {
    title: 'Weight',
    what: 'Body weight, used with height to calculate body mass index (BMI).',
    find: 'Measured in light clothing. 1 lb ≈ 0.45 kg; 150 lb ≈ 68 kg.',
  },
  bp: {
    title: 'Systolic blood pressure',
    what: 'The top number of a blood pressure reading: the pressure in the arteries when the heart beats. In “130/85”, the systolic pressure is 130.',
    find: 'Seated, after 5 minutes’ rest, arm supported at heart level. Average two readings taken a minute apart if you can.',
  },
  rbs: {
    title: 'Random blood sugar (RBS)',
    what: 'Blood glucose measured at any time of day, without fasting. It’s not the same test as fasting blood sugar (FBS) or HbA1c, which have different normal ranges.',
    find: 'On a lab report as “RBS”, “Random glucose” or “Glucose (random)”. A glucometer reading also works.',
    convert: 'mg/dL ÷ 18 = mmol/L (126 mg/dL ≈ 7.0 mmol/L). Switch the unit beside the value if your report uses mg/dL.',
  },
  totalCholesterol: {
    title: 'Total cholesterol',
    what: 'All the cholesterol carried in the blood: LDL, HDL and others together.',
    find: 'The first line of a lipid profile, often as “TC” or “Cholesterol, total”.',
    convert: 'mmol/L × 38.67 = mg/dL (5.2 mmol/L ≈ 200 mg/dL).',
  },
  hdl: {
    title: 'HDL cholesterol',
    what: 'The “good” cholesterol: HDL carries cholesterol away from the arteries to the liver, so higher is better.',
    find: 'In the lipid profile as “HDL” or “HDL-C”.',
    convert: 'mmol/L × 38.67 = mg/dL (1.0 mmol/L ≈ 39 mg/dL).',
  },
  ldl: {
    title: 'LDL cholesterol',
    what: 'The “bad” cholesterol: LDL builds up in artery walls as plaque, the main cause of heart attacks. Lower is better.',
    find: 'In the lipid profile as “LDL” or “LDL-C”. Many labs calculate it from the other lipid values.',
    convert: 'mmol/L × 38.67 = mg/dL (3.4 mmol/L ≈ 130 mg/dL).',
  },
  triglycerides: {
    title: 'Triglycerides',
    what: 'The most common type of fat in the blood. Levels rise after meals, with alcohol and with high blood sugar.',
    find: 'In the lipid profile as “TG”. Usually measured after a 9–12 hour fast.',
    convert: 'mmol/L × 88.57 = mg/dL (1.7 mmol/L ≈ 150 mg/dL).',
  },
  hemoglobin: {
    title: 'Hemoglobin',
    what: 'The protein in red blood cells that carries oxygen. Low hemoglobin (anemia) makes the heart work harder.',
    find: 'On a complete blood count (CBC) as “Hb” or “HGB”.',
    convert: 'g/L ÷ 10 = g/dL (135 g/L = 13.5 g/dL).',
  },
  creatinine: {
    title: 'Creatinine',
    what: 'A waste product from muscle that the kidneys filter out. A higher level usually means the kidneys are filtering less.',
    find: 'In kidney function tests or a “serum creatinine” result.',
    convert: 'µmol/L ÷ 88.4 = mg/dL (88 µmol/L ≈ 1.0 mg/dL).',
    note: 'The app also estimates kidney filtering (eGFR, CKD-EPI 2021) from creatinine, age and sex, and grades the result on that.',
  },
  platelets: {
    title: 'Platelets',
    what: 'Small cell fragments that help blood clot.',
    find: 'On a complete blood count as “PLT”. A count of 250,000 /µL is entered as 250 (×10³/µL is the same number as ×10⁹/L).',
  },
  sodium: {
    title: 'Sodium',
    what: 'The main salt in the blood. It controls fluid balance; levels that are too low or too high affect the brain and heart.',
    find: 'In “serum electrolytes” as “Na⁺”.',
  },
  potassium: {
    title: 'Potassium',
    what: 'An electrolyte that keeps the heartbeat steady. Too high or too low can disturb heart rhythm.',
    find: 'In “serum electrolytes” as “K⁺”. A delayed or haemolysed sample can read falsely high.',
  },
  chloride: {
    title: 'Chloride',
    what: 'An electrolyte that works with sodium to keep fluid and acid–base balance.',
    find: 'In “serum electrolytes” as “Cl⁻”.',
  },
  troponin: {
    title: 'Troponin-I',
    what: 'A protein released into the blood when heart muscle is injured, for example during a heart attack.',
    find: 'Enter the value exactly as reported and pick the assay: quantitative tests report ng/mL, high-sensitivity tests ng/L. The two units are not interchangeable.',
    note: 'Optional, and not used by the model (it ran backwards in the training data). A raised value is still flagged as urgent.',
  },
  familyHistory: {
    title: 'Family history of heart disease',
    what: 'A parent, brother or sister diagnosed with heart disease or a heart attack. It matters most when it happened at a younger age.',
  },
  hypertension: {
    title: 'Hypertension',
    what: 'High blood pressure diagnosed by a clinician, or taking blood pressure medicine. Answer yes even if today’s reading is normal on treatment.',
  },
  diabetes: {
    title: 'Diabetes',
    what: 'Diabetes diagnosed by a clinician, or taking diabetes tablets or insulin.',
  },
  chestPain: {
    title: 'History of chest pain',
    what: 'Any past episodes of chest pain, pressure or tightness, especially on exertion (angina).',
    note: 'Chest pain happening now, with breathlessness, sweating or fainting, is an emergency: call emergency services.',
  },
  bmi: {
    title: 'Body mass index (BMI)',
    what: 'Weight in kilograms divided by height in metres squared. Calculated for you from height and weight.',
  },
  maxHR: {
    title: 'Maximum heart rate',
    what: 'The highest heart rate expected for the patient’s age and sex. The training data recorded it as a formula, not a measurement, so it’s calculated for you and never typed in.',
  },
};

const fmt = (n, digits) => n.toFixed(digits);

/**
 * ranges.js bands → readable rows: [{ range, label, level }].
 * A band's upper bound is exclusive unless it was made with through(n) (n + 1e-9).
 */
export function bandRows(bands, digits) {
  const step = 10 ** -digits;
  const isThrough = (b) => Number.isFinite(b) && Math.abs(b - Math.round(b / step) * step) > 1e-12;
  let prevTop = null; // the highest value (inclusive) the previous band covered
  return bands.map(([upper, level, label]) => {
    const through = isThrough(upper);
    const top = through ? Math.round(upper / step) * step : upper - step;
    const low = prevTop === null ? null : prevTop + step;
    let range;
    if (low === null) range = through ? `≤ ${fmt(top, digits)}` : `< ${fmt(upper, digits)}`;
    else if (!Number.isFinite(upper)) range = `≥ ${fmt(low, digits)}`;
    else range = `${fmt(low, digits)}–${fmt(top, digits)}`;
    prevTop = top;
    return { range, label, level };
  });
}

const measureFor = (payloadKey) => MEASURES.find((m) => m.key === payloadKey);
const bandsOf = (spec, sex) => (typeof spec.bands === 'function' ? spec.bands(sex) : spec.bands);

/**
 * Levels for a field's help: { rows, unit, healthy, source } or null when the
 * field has no graded levels. `sex` picks sex-specific bands.
 */
export function levelsFor(key, { sex = 'M', assay = 'quantitative' } = {}) {
  if (key === 'height' || key === 'weight' || key === 'bmi') {
    return { rows: bandRows(BMI.bands, 1), unit: 'kg/m² (BMI)', healthy: BMI.range(), source: BMI.source };
  }
  if (key === 'age') {
    return {
      rows: [
        { range: `< ${AGE_RISK[sex]}`, label: 'Not an age risk factor', level: 'normal' },
        { range: `≥ ${AGE_RISK[sex]}`, label: 'Age is a risk factor', level: 'elevated' },
      ],
      unit: 'years',
      healthy: null,
      source: AGE_RISK.source,
    };
  }
  if (key === 'troponin') {
    const conf = TROPONIN[assay];
    const limit = fmt(conf.limit(sex), conf.digits);
    return {
      rows: [
        { range: `≤ ${limit}`, label: 'Within the reference limit', level: 'normal' },
        { range: `> ${limit}`, label: 'Possible heart muscle injury', level: 'urgent' },
      ],
      unit: conf.unit,
      healthy: `≤ ${limit}`,
      source: conf.source,
    };
  }
  const spec = measureFor(PAYLOAD_KEY[key]);
  if (!spec) return null;
  // Platelets: the bands are already in ×10³/µL (spec.scale converts the payload).
  return { rows: bandRows(bandsOf(spec, sex), spec.digits), unit: spec.unit, healthy: spec.range(sex), source: spec.source };
}

/** Band bounds in the form's own units, for colouring a slider's track: [[from, to, level]].
 *  Lab values only: age is context, not something to colour as good or bad. */
export function trackBands(key, sex = 'M') {
  const spec = measureFor(PAYLOAD_KEY[key]);
  if (!spec) return null;
  let from = -Infinity;
  return bandsOf(spec, sex).map(([upper, level]) => {
    const seg = [from, upper, level];
    from = upper;
    return seg;
  });
}
