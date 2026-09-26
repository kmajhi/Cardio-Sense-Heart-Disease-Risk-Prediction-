// Personalised diet, activity and habit suggestions.
//
// Rule-based and transparent: every suggestion is a rule that fires on
// specific inputs (a flagged finding, the model's risk level, or profile
// details) and carries `because` (what triggered it) and `source` (the
// guideline it follows). General lifestyle guidance, not a treatment plan: the
// UI always says so and points to a clinician for anything abnormal.
import { describe } from './analyze';
import { GROUPS, rank } from './ranges';
import { RISK } from './risk';

const FISH = /fish|sea ?food|shellfish|prawn|shrimp|crab/i;
const NUTS = /nut|peanut|almond|walnut|cashew|pistachio/i;

function context(notification, profile) {
  const { analysis, risk } = notification;
  const f = (key) => analysis.find(key);
  const is = (key, dir) => f(key)?.status === 'flagged' && (!dir || f(key).dir === dir);
  const atLeast = (key, level) => f(key)?.status === 'flagged' && rank(f(key).level) >= rank(level);
  const why = (...keys) => keys.filter((k) => f(k)?.status === 'flagged').map((k) => describe(f(k)));
  const allergies = (profile?.allergies ?? []).join(' ');

  const bmi = f('bmi');

  return {
    f,
    why,
    risk,
    profile,
    age: analysis.age,
    sex: analysis.sex,
    weight: analysis.weightKg,
    bpHigh: is('bp_mmhg', 'high') || is('hypertension'),
    bpCrisis: f('bp_mmhg')?.level === 'urgent',
    glucoseHigh: is('rbs_mmol_l', 'high') || is('diabetes'),
    glucoseLow: is('rbs_mmol_l', 'low'),
    lipidsHigh: is('ldl', 'high') || is('total_cholesterol', 'high'),
    tgHigh: is('triglycerides', 'high'),
    hdlLow: is('hdl', 'low'),
    anemia: is('hemoglobin', 'low'),
    anemiaMarked: is('hemoglobin', 'low') && atLeast('hemoglobin', 'high'),
    kidney: is('creatinine'),
    kHigh: is('potassium', 'high'),
    kLow: is('potassium', 'low'),
    naLow: is('sodium', 'low'),
    overweight: is('bmi', 'high'),
    obese: bmi?.value >= 30,
    underweight: is('bmi', 'low'),
    troponinUp: f('troponin_i')?.level === 'urgent',
    chestPain: is('chest_pain_history'),
    urgent: notification.urgent,
    fishAllergy: FISH.test(allergies),
    nutAllergy: NUTS.test(allergies),
    riskWhy: risk.level !== 'low' ? [`Model estimate: ${risk.label} (${risk.pct}%)`] : [],
  };
}

const item = (id, text, because, source) => ({ id, text, because: because.filter(Boolean), source });

// ---------- When to talk to a doctor ----------

function doctor(c, notification) {
  const out = [];
  if (c.troponinUp) {
    out.push(item('troponin',
      'Contact a doctor today about the raised Troponin-I. If you have chest pain or pressure, breathlessness, ' +
      'sweating or fainting now, call emergency services.',
      c.why('troponin_i'), 'Fourth Universal Definition of Myocardial Infarction (2018)'));
  }
  if (c.bpCrisis) {
    out.push(item('bp-crisis',
      'Blood pressure of 180 mmHg or more: rest for 5 minutes and measure again. If it’s still that high, or you ' +
      'have chest pain, severe headache, vision changes, weakness or trouble speaking, get emergency care.',
      c.why('bp_mmhg'), 'American Heart Association: hypertensive crisis'));
  }
  const otherUrgent = notification.analysis.flagged.filter(
    (f) => f.level === 'urgent' && !['troponin_i', 'bp_mmhg'].includes(f.key),
  );
  if (otherUrgent.length) {
    out.push(item('urgent-labs',
      `${otherUrgent.map((f) => f.short).join(', ')} ${otherUrgent.length === 1 ? 'is' : 'are'} in a range that needs ` +
      'prompt review. Contact a doctor today rather than waiting for a routine visit.',
      otherUrgent.map(describe), 'See the reference for each value in “How your values were checked”'));
  }
  if (c.chestPain) {
    out.push(item('chest-pain',
      'Chest pain should be evaluated by a clinician, especially pain that comes on with exertion or at rest.',
      c.why('chest_pain_history'), '2021 AHA/ACC Chest Pain Guideline'));
  }
  if (c.naLow) {
    out.push(item('sodium-low',
      'Your sodium is low: don’t cut salt further or drink large amounts of water to “flush” your system until ' +
      'a doctor has looked at the cause.',
      c.why('sodium'), 'European hyponatremia guideline (Spasovski et al., 2014)'));
  }
  if (c.risk.level === 'high') {
    out.push(item('model-high',
      'Book an appointment to review your cardiovascular risk and these results with a doctor.',
      c.riskWhy, 'Project risk bands (model estimate)'));
  }
  // Each value is mentioned once: those with their own item above aren't repeated below.
  const handled = new Set([
    'troponin_i', 'bp_mmhg', 'chest_pain_history', ...(c.naLow ? ['sodium'] : []), ...otherUrgent.map((f) => f.key),
  ]);
  const soon = notification.analysis.flagged.filter((f) => f.level === 'high' && !handled.has(f.key));
  const routine = notification.analysis.flagged.filter((f) => f.level === 'elevated' && !handled.has(f.key));
  if (soon.length) {
    out.push(item('soon', `Discuss your ${list(soon)} with a doctor soon.`, soon.map(describe), ''));
  }
  if (routine.length) {
    out.push(item('routine', `Mention your ${list(routine)} at your next routine check-up.`, routine.map(describe), ''));
  }
  if (!out.length) {
    out.push(item('checkups', 'Nothing here needs a doctor right now. Keep up regular health check-ups.', [], ''));
  }
  return out;
}

// Mid-sentence names: "blood sugar", but acronyms stay as they are ("LDL", "BMI").
const inSentence = (name) => (/^[A-Z]{2}/.test(name) ? name : name[0].toLowerCase() + name.slice(1));

const list = (findings) => {
  const names = [...new Set(findings.map((f) => inSentence(f.kind === 'history' ? f.label : f.short)))];
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
};

// ---------- Diet ----------

function diet(c) {
  const out = [];
  const nuts = c.nutAllergy ? 'seeds' : 'unsalted nuts and seeds';

  if (c.bpHigh) {
    out.push(c.kHigh || c.kidney
      ? item('dash',
        'A DASH-style diet usually helps blood pressure, but it’s rich in potassium. Check with your doctor first, ' +
        'given your potassium or kidney result.',
        c.why('bp_mmhg', 'hypertension', 'potassium', 'creatinine'), 'NHLBI DASH eating plan; KDIGO 2012')
      : item('dash',
        'Follow a DASH-style eating pattern: plenty of vegetables, fruit, pulses, whole grains and low-fat dairy. ' +
        'In trials it lowered systolic pressure by about 11 mmHg in people with hypertension.',
        c.why('bp_mmhg', 'hypertension'), 'NHLBI DASH eating plan; 2017 ACC/AHA guideline'));
    if (!c.naLow) {
      out.push(item('salt',
        'Cut salt: aim for under 1,500 mg of sodium a day, or at least 1,000 mg less than now. Skip added salt, ' +
        'pickles, chips and instant noodles.',
        c.why('bp_mmhg', 'hypertension'), '2017 ACC/AHA guideline (sodium reduction: about 5–6 mmHg)'));
    }
  }
  if (c.lipidsHigh) {
    out.push(item('saturated-fat',
      'Keep saturated fat under 6% of calories: swap ghee, butter, coconut oil, fatty red meat and full-fat dairy ' +
      'for vegetable oils, fish, pulses and low-fat dairy.',
      c.why('ldl', 'total_cholesterol'), 'AHA/ACC 2013 Lifestyle Guideline'));
    out.push(item('soluble-fibre',
      'Add soluble fibre every day: oats, barley, lentils, beans, okra and apples all help lower LDL.',
      c.why('ldl', 'total_cholesterol'), 'AHA dietary guidance'));
  }
  if (c.tgHigh || c.hdlLow || c.lipidsHigh) {
    const omega = c.fishAllergy
      ? `Get omega-3 fats from ${c.nutAllergy ? 'flaxseed or chia seeds' : 'walnuts, flaxseed or chia'} (your profile lists a fish allergy).`
      : 'Eat fish twice a week, ideally oily fish such as sardine, mackerel or hilsa.';
    out.push(item('omega-3', omega, c.why('triglycerides', 'hdl', 'ldl'), 'AHA: fish twice a week'));
  }
  if (c.tgHigh || c.glucoseHigh || c.overweight) {
    const grams = c.sex === 'F' ? 25 : 36;
    out.push(item('sugar',
      `Limit added sugar to under ${grams} g a day (sweets, sugary drinks, desserts), and keep portions of white ` +
      'rice and refined flour small.',
      c.why('triglycerides', 'rbs_mmol_l', 'diabetes', 'bmi'), 'AHA added-sugar limits'));
  }
  if (c.tgHigh) {
    out.push(item('alcohol', 'Avoid alcohol: it raises triglycerides.', c.why('triglycerides'),
      'Endocrine Society 2012 hypertriglyceridemia guideline'));
  }
  if (c.glucoseHigh) {
    out.push(item('plate',
      'Use the plate method: half non-starchy vegetables, a quarter protein, a quarter whole grains or pulses, ' +
      'at regular meal times.',
      c.why('rbs_mmol_l', 'diabetes'), 'ADA Standards of Care 2024'));
  }
  if (c.glucoseLow) {
    out.push(item('hypo',
      'Don’t skip meals. If you feel shaky, sweaty or confused, take 15 g of fast sugar (e.g. half a glass of ' +
      'juice), recheck after 15 minutes, then eat a proper snack.',
      c.why('rbs_mmol_l'), 'ADA “15-15 rule”'));
  }
  if (c.anemia) {
    out.push(item('iron',
      'Eat iron-rich foods (lentils, leafy greens, eggs, fish, lean meat) with vitamin C (citrus, guava, tomato), ' +
      'and keep tea or coffee away from meals.',
      c.why('hemoglobin'), 'WHO nutrition guidance on anemia'));
  }
  if (c.kidney) {
    out.push(item('kidney',
      'Avoid protein powders and very high-protein diets, keep salt down, and ask before using potassium-based ' +
      'salt substitutes.',
      c.why('creatinine'), 'KDIGO 2012 CKD guideline'));
  }
  if (c.kHigh) {
    out.push(item('potassium-high',
      'Until your potassium is reviewed, limit very high-potassium foods (bananas, potatoes, coconut water, dried ' +
      'fruit) and avoid “low-sodium” salt substitutes, which contain potassium.',
      c.why('potassium'), 'European Resuscitation Council 2021'));
  }
  if (c.kLow) {
    out.push(item('potassium-low',
      'Include potassium-rich foods (bananas, oranges, potatoes, lentils, leafy greens), unless your doctor has ' +
      'told you otherwise.',
      c.why('potassium'), 'Dietary potassium guidance'));
  }
  if (c.overweight && c.weight > 0) {
    const lo = Math.round(c.weight * 0.05);
    const hi = Math.round(c.weight * 0.1);
    out.push(item('weight-loss',
      `Aim to lose 5–10% of your weight (about ${lo}–${hi} kg) over 6 months, with a modest deficit of about ` +
      '500 kcal a day.',
      c.why('bmi'), 'AHA/ACC/TOS 2013 Obesity Guideline'));
  }
  if (c.underweight) {
    out.push(item('weight-gain',
      `Add nutrient-dense calories: an extra meal or snack with eggs, milk, pulses, ${nuts} and whole grains.`,
      c.why('bmi'), 'WHO healthy diet'));
  }
  out.push(item('heart-pattern',
    `Base meals on vegetables, fruit, whole grains, pulses and ${nuts}. Choose vegetable oils over ghee or butter, ` +
    'and limit fried and processed food.',
    c.riskWhy, 'AHA 2021 Dietary Guidance to Improve Cardiovascular Health'));
  return out;
}

// ---------- Physical activity ----------

function activity(c) {
  const out = [];
  const holdOff = c.troponinUp || c.bpCrisis;
  if (holdOff) {
    const what = [c.troponinUp && 'Troponin-I', c.bpCrisis && 'blood pressure'].filter(Boolean).join(' and ');
    out.push(item('clearance',
      `Don’t start or step up exercise until a doctor has reviewed your ${what} result. Gentle daily movement, ` +
      'like short easy walks, is fine unless you have symptoms.',
      c.why('troponin_i', 'bp_mmhg'), 'ACSM exercise preparticipation screening (2015)'));
  } else if (c.chestPain || c.risk.level === 'high' || c.urgent.length) {
    out.push(item('clearance',
      'Get medical clearance before vigorous exercise. Start with light to moderate activity such as walking, and ' +
      'stop if you get chest pain, unusual breathlessness, dizziness or palpitations.',
      [...c.why('chest_pain_history'), ...c.riskWhy, ...c.urgent.flatMap((g) => g.findings.map(describe))],
      'ACSM exercise preparticipation screening (2015)'));
  }

  const level = c.profile?.activity;
  const start = level === 'high'
    ? 'You’re already active: keep it up and vary what you do.'
    : 'Start with 10-minute walks and add a few minutes each week.';
  out.push(item('aerobic',
    `${holdOff ? 'Once cleared, build' : 'Build'} up to 150–300 minutes a week of moderate aerobic activity (brisk ` +
    `walking, cycling, swimming), such as 30 minutes on 5 days. ${start}`,
    [level ? `Profile: ${level} activity` : null, ...c.riskWhy], 'WHO 2020 physical activity guidelines'));

  if (c.bpHigh && !holdOff) {
    out.push(item('bp-exercise',
      'Regular aerobic exercise lowers systolic blood pressure by about 5–8 mmHg: it’s one of the most effective ' +
      'non-drug steps.',
      c.why('bp_mmhg', 'hypertension'), '2017 ACC/AHA guideline'));
  }
  out.push(item('strength',
    'Add muscle-strengthening on 2 or more days a week (bodyweight squats, resistance bands, light weights).' +
    (c.bpHigh ? ' Breathe out as you lift, and avoid heavy lifting or holding your breath.' : ''),
    c.why('bp_mmhg', 'hypertension'), 'WHO 2020 physical activity guidelines'));
  if (c.glucoseHigh) {
    out.push(item('after-meals',
      'Take a 10–15 minute walk after meals and break up long sitting every 30 minutes: both lower blood sugar.',
      c.why('rbs_mmol_l', 'diabetes'), 'ADA Standards of Care 2024'));
  }
  if (c.glucoseLow) {
    out.push(item('hypo-exercise', 'Don’t exercise on an empty stomach, and carry a quick sugar source.',
      c.why('rbs_mmol_l'), 'ADA Standards of Care 2024'));
  }
  if (c.obese) {
    out.push(item('low-impact', 'Choose low-impact activities (walking, cycling, swimming) that are easier on the joints.',
      c.why('bmi'), 'AHA/ACC/TOS 2013 Obesity Guideline'));
  }
  if (c.anemiaMarked) {
    out.push(item('anemia-pace', 'Build up slowly: anemia can make you tired or breathless sooner.',
      c.why('hemoglobin'), 'General clinical advice'));
  }
  if (c.age >= 65) {
    out.push(item('balance', 'Include balance and strength exercises on 3 or more days a week to prevent falls.',
      [`Age ${c.age}`], 'WHO 2020 guidelines for older adults'));
  }
  out.push(item('sit-less', 'Break up long periods of sitting: stand up or walk for a few minutes every 30–60 minutes.',
    [], 'WHO 2020 physical activity guidelines'));
  return out;
}

// ---------- Daily habits ----------

function habits(c) {
  const out = [];
  const smoker = c.profile?.smoker;
  if (smoker === 'current') {
    out.push(item('smoking',
      'Stopping smoking is the single most effective step for your heart. Ask about quit support: counselling and ' +
      'nicotine replacement make quitting much more likely.',
      ['Profile: current smoker'], 'WHO; ACC/AHA 2019 Primary Prevention Guideline'));
  } else if (smoker === 'former') {
    out.push(item('smoke-free', 'Stay smoke-free, and avoid second-hand smoke.', ['Profile: former smoker'],
      'ACC/AHA 2019 Primary Prevention Guideline'));
  } else if (!smoker) {
    out.push(item('smoking', 'If you smoke or use tobacco, quitting is the most effective step for your heart.', [],
      'ACC/AHA 2019 Primary Prevention Guideline'));
  }
  if (c.bpHigh) {
    out.push(item('home-bp',
      'Check your blood pressure at home: sit quietly for 5 minutes, arm supported at heart level, take 2 readings ' +
      'a minute apart, and keep a log to show your doctor.',
      c.why('bp_mmhg', 'hypertension'), '2017 ACC/AHA guideline (home BP monitoring)'));
  }
  if (c.f('rbs_mmol_l')?.status === 'flagged' && c.f('rbs_mmol_l').dir === 'high' && !c.f('diabetes')?.value) {
    out.push(item('confirm-glucose',
      'Ask for a fasting glucose or HbA1c test: one random reading can’t diagnose diabetes.',
      c.why('rbs_mmol_l'), 'ADA Standards of Care 2024'));
  }
  if (c.lipidsHigh || c.tgHigh || c.hdlLow) {
    out.push(item('recheck-lipids', 'Recheck your lipid profile after about 3 months of changes, as your doctor advises.',
      c.why('ldl', 'total_cholesterol', 'triglycerides', 'hdl'), 'ACC/AHA 2018 Cholesterol Guideline'));
  }
  const meds = c.profile?.medications ?? [];
  if (meds.length) {
    out.push(item('medicines',
      `Keep taking your prescribed medicines (${meds.join(', ')}). Don’t stop or change them because of this app.`,
      ['Profile: medications'], ''));
  }
  out.push(item('sleep', 'Aim for 7–9 hours of sleep a night.', [], 'AHA Life’s Essential 8'));
  out.push(item('stress', 'Manage stress with regular activity, breathing exercises and time with people you trust.',
    [], 'AHA Life’s Essential 8'));
  return out;
}

/**
 * notification (buildNotification) + optional profile → the Guidance page's content.
 * Sections come in the order a reader needs them: doctor first when anything is urgent.
 */
export function recommend(notification, profile = null) {
  if (!notification) return null;
  const c = context(notification, profile);
  const sections = [
    { id: 'doctor', title: 'When to talk to a doctor', items: doctor(c, notification) },
    { id: 'diet', title: 'Diet', items: diet(c) },
    { id: 'activity', title: 'Physical activity & workout', items: activity(c) },
    { id: 'habits', title: 'Daily habits', items: habits(c) },
  ];
  return {
    sections,
    risk: notification.risk,
    groups: notification.groups.map((g) => ({ id: g.id, title: GROUPS[g.id].title, level: g.level })),
    usedProfile: Boolean(profile),
    riskRange: RISK[notification.risk.level].range,
  };
}
