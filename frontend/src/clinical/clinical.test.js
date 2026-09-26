import { describe as suite, expect, it } from 'vitest';
import { DEFAULTS, PRESETS, toPayload } from '../pages/Prediction/fields';
import { analyze } from './analyze';
import { egfr } from './egfr';
import { buildNotification } from './notifications';
import { recommend } from './recommend';
import { pctText, riskLevel } from './risk';

// A healthy adult: every value inside its reference range. (The form's defaults
// are the training-data medians, which are not all healthy: see the next test.)
const base = toPayload({ ...DEFAULTS, totalCholesterol: 180, triglycerides: 120, hemoglobin: 14.2, troponin: '0.01' });
const level = (changes, key) => analyze({ ...base, ...changes }).find(key);
const assessment = (changes = {}, result = { probability: 0.2, risk_level: 'low' }) => ({
  id: 'A-0001',
  inputs: { ...base, ...changes },
  result,
});

suite('reference bands', () => {
  it('a healthy baseline raises nothing', () => {
    const a = analyze(base);
    expect(a.flagged).toEqual([]);
    expect(a.groups).toEqual([]);
  });

  it('the dataset medians (the form defaults) already cross three guideline cut-offs', () => {
    const medians = analyze(toPayload({ ...DEFAULTS, troponin: '0.01' }));
    expect(medians.flagged.map((f) => [f.key, f.band])).toEqual([
      ['total_cholesterol', 'Borderline high'], // 200 mg/dL (ATP III: ≥200)
      ['triglycerides', 'Borderline high'], // 150 mg/dL (ATP III: ≥150)
      ['hemoglobin', 'Mild anemia range'], // 12.7 g/dL, male (WHO: <13)
    ]);
  });

  it.each([
    [119, 'normal'], [120, 'elevated'], [129, 'elevated'], [130, 'elevated'],
    [139, 'elevated'], [140, 'high'], [179, 'high'], [180, 'urgent'], [85, 'elevated'],
  ])('systolic BP %i mmHg → %s (ACC/AHA 2017)', (bp, expected) => {
    expect(level({ bp_mmhg: bp }, 'bp_mmhg').level).toBe(expected);
  });

  it.each([
    [2.9, 'urgent'], [3.5, 'high'], [3.9, 'normal'], [7.7, 'normal'], [7.8, 'elevated'], [11.1, 'high'],
  ])('random glucose %f mmol/L → %s (ADA)', (g, expected) => {
    expect(level({ rbs_mmol_l: g }, 'rbs_mmol_l').level).toBe(expected);
  });

  it.each([
    [129, 'normal'], [130, 'elevated'], [160, 'high'], [190, 'high'],
  ])('LDL %i mg/dL → %s (ATP III)', (ldl, expected) => {
    expect(level({ ldl }, 'ldl').level).toBe(expected);
  });

  it('HDL and hemoglobin use sex-specific limits', () => {
    expect(level({ hdl: 45, sex: 'M' }, 'hdl').level).toBe('normal');
    expect(level({ hdl: 45, sex: 'F' }, 'hdl').level).toBe('elevated');
    expect(level({ hemoglobin: 12.5, sex: 'M' }, 'hemoglobin').band).toBe('Mild anemia range');
    expect(level({ hemoglobin: 12.5, sex: 'F' }, 'hemoglobin').level).toBe('normal');
    expect(level({ hemoglobin: 7.5 }, 'hemoglobin').level).toBe('urgent');
  });

  it('upper limits are inclusive where the reference says so', () => {
    expect(level({ sodium: 145 }, 'sodium').level).toBe('normal');
    expect(level({ sodium: 146 }, 'sodium').level).toBe('high');
    expect(level({ potassium: 5.1 }, 'potassium').level).toBe('normal');
    expect(level({ potassium: 6.5 }, 'potassium').level).toBe('urgent');
  });

  it('platelets are judged in ×10³/µL although the payload sends a count', () => {
    expect(level({ platelets: 270000 }, 'platelets').level).toBe('normal');
    expect(level({ platelets: 40000 }, 'platelets').level).toBe('urgent');
  });

  it('BMI follows the WHO classes', () => {
    expect(level({ height_cm: 160, weight_kg: 60 }, 'bmi').band).toBe('Healthy weight');
    expect(level({ height_cm: 160, weight_kg: 80 }, 'bmi').band).toBe('Obesity class I');
    expect(level({ height_cm: 160, weight_kg: 45 }, 'bmi').dir).toBe('low');
  });
});

suite('eGFR (CKD-EPI 2021)', () => {
  it('matches a hand-worked value', () => {
    // 60-year-old man, creatinine 1.0 mg/dL: 142 × (1/0.9)^−1.2 × 0.9938^60 ≈ 86
    expect(egfr(1.0, 60, 'M')).toBeCloseTo(86.2, 0);
  });

  it('grades creatinine by eGFR, so age and sex matter', () => {
    expect(level({ creatinine: 1.9, age: 66, sex: 'M' }, 'creatinine').band).toMatch(/G3b/);
    expect(level({ creatinine: 1.2, age: 30, sex: 'M' }, 'creatinine').level).toBe('normal');
    expect(level({ creatinine: 1.2, age: 30, sex: 'F' }, 'creatinine').level).toBe('elevated');
  });
});

suite('Troponin-I', () => {
  it('uses the assay’s own limit', () => {
    expect(level({ troponin_i: 0.03, troponin_assay: 'quantitative' }, 'troponin_i').level).toBe('normal');
    expect(level({ troponin_i: 0.05, troponin_assay: 'quantitative' }, 'troponin_i').level).toBe('urgent');
    expect(level({ troponin_i: 20, troponin_assay: 'high-sensitivity', sex: 'M' }, 'troponin_i').level).toBe('normal');
    expect(level({ troponin_i: 20, troponin_assay: 'high-sensitivity', sex: 'F' }, 'troponin_i').level).toBe('urgent');
  });

  it('handles censored and missing results', () => {
    const hs = { troponin_assay: 'high-sensitivity' };
    expect(level({ ...hs, troponin_i: 2.5, troponin_qualifier: '<' }, 'troponin_i').level).toBe('normal');
    expect(level({ ...hs, troponin_i: 50, troponin_qualifier: '<' }, 'troponin_i').status).toBe('uncertain');
    expect(level({ ...hs, troponin_i: 25000, troponin_qualifier: '>' }, 'troponin_i').level).toBe('urgent');
    expect(level({ troponin_i: null }, 'troponin_i').status).toBe('missing');
  });
});

suite('coverage of the 21 inputs', () => {
  it('judges every model input except age, sex and the max-heart-rate formula', () => {
    const judged = analyze(base).findings.map((f) => f.key);
    const inputs = Object.keys(base).filter((k) => !['troponin_assay'].includes(k));
    // Height and weight are judged together as BMI; bmi/max_hr in the payload are recomputed.
    const notJudgedDirectly = ['age', 'sex', 'height_cm', 'weight_kg', 'max_hr'];
    for (const key of inputs) {
      if (!notJudgedDirectly.includes(key) && key !== 'bmi') expect(judged).toContain(key);
    }
    expect(judged).toContain('bmi');
  });

  it('missing labs are listed, not flagged', () => {
    const a = analyze({ ...base, hdl: '', chloride: null });
    expect(a.missing).toEqual(expect.arrayContaining(['HDL cholesterol', 'Chloride']));
    expect(a.flagged).toEqual([]);
  });
});

suite('grouped notifications', () => {
  it('groups related values into one alert, most serious first', () => {
    const n = buildNotification(assessment({ ldl: 180, triglycerides: 250, bp_mmhg: 185 }));
    expect(n.groups.map((g) => g.id)).toEqual(['bp', 'lipids']); // urgent before high
    expect(n.groups[1].findings.map((f) => f.key)).toEqual(['ldl', 'triglycerides']);
    expect(n.urgent.map((g) => g.id)).toEqual(['bp']);
  });

  it('keeps model risk and clinical findings apart', () => {
    const highOnly = buildNotification(assessment({}, { probability: 0.8, risk_level: 'high' }));
    expect(highOnly.groups).toEqual([]);
    expect(highOnly.risk.title).toBe('High estimated risk');
    expect(highOnly.risk.note).toMatch(/combination of factors/);

    const lowButAbnormal = buildNotification(assessment({ ldl: 200 }));
    expect(lowButAbnormal.risk.level).toBe('low');
    expect(lowButAbnormal.risk.body).toMatch(/deserve attention on their own/);
    expect(lowButAbnormal.needsAttention).toBe(true);
  });

  it('says nothing needs attention when all is well', () => {
    expect(buildNotification(assessment()).needsAttention).toBe(false);
  });

  it('reports the sample patients sensibly', () => {
    const high = PRESETS.find((p) => p.id === 'high');
    const n = buildNotification({ inputs: toPayload(high.values), result: { probability: 0.9, risk_level: 'high' } });
    expect(n.groups[0].id).toBe('cardiac'); // 850 ng/L hs troponin
    expect(n.groups.map((g) => g.id)).toEqual(expect.arrayContaining(['bp', 'glucose', 'lipids', 'kidney', 'history']));
  });
});

suite('recommendations', () => {
  const ids = (plan, section) => plan.sections.find((s) => s.id === section).items.map((i) => i.id);

  it('fires rules from the findings and says why', () => {
    const plan = recommend(buildNotification(assessment({ bp_mmhg: 150, ldl: 170 })));
    expect(ids(plan, 'diet')).toEqual(expect.arrayContaining(['dash', 'salt', 'saturated-fat', 'soluble-fibre']));
    const dash = plan.sections[1].items.find((i) => i.id === 'dash');
    expect(dash.because[0]).toMatch(/Blood pressure 150 mmHg/);
    expect(dash.source).toMatch(/DASH/);
  });

  it('adapts to conflicting findings', () => {
    const plan = recommend(buildNotification(assessment({ bp_mmhg: 150, potassium: 5.8, sodium: 128 })));
    const diet = plan.sections.find((s) => s.id === 'diet').items;
    expect(diet.find((i) => i.id === 'dash').text).toMatch(/check with your doctor first/i);
    expect(ids(plan, 'diet')).not.toContain('salt'); // low sodium: no salt restriction
    expect(ids(plan, 'doctor')).toContain('sodium-low');
  });

  it('holds back exercise when troponin is raised', () => {
    const plan = recommend(buildNotification(assessment({ troponin_i: 0.5 }, { probability: 0.8, risk_level: 'high' })));
    expect(ids(plan, 'doctor')[0]).toBe('troponin');
    const activity = plan.sections.find((s) => s.id === 'activity').items;
    expect(activity[0].id).toBe('clearance');
    expect(activity.find((i) => i.id === 'aerobic').text).toMatch(/^Once cleared/);
  });

  it('uses the profile: allergies, smoking, activity, medicines', () => {
    const profile = { allergies: ['Fish'], smoker: 'current', activity: 'low', medications: ['Amlodipine 5 mg'] };
    const plan = recommend(buildNotification(assessment({ triglycerides: 300 })), profile);
    const all = plan.sections.flatMap((s) => s.items);
    expect(all.find((i) => i.id === 'omega-3').text).toMatch(/walnuts, flaxseed or chia/);
    expect(all.find((i) => i.id === 'smoking').because).toContain('Profile: current smoker');
    expect(all.find((i) => i.id === 'aerobic').text).toMatch(/10-minute walks/);
    expect(all.find((i) => i.id === 'medicines').text).toMatch(/Amlodipine/);
    expect(plan.usedProfile).toBe(true);
  });

  it('gives a weight target from the actual weight', () => {
    const plan = recommend(buildNotification(assessment({ height_cm: 160, weight_kg: 80 })));
    expect(plan.sections[1].items.find((i) => i.id === 'weight-loss').text).toMatch(/about 4–8 kg/);
  });

  it('mentions each value once in the doctor section, in sentence case', () => {
    const plan = recommend(buildNotification(assessment({ sodium: 132, ldl: 170, rbs_mmol_l: 12 })));
    const doctor = plan.sections.find((s) => s.id === 'doctor').items;
    expect(doctor.filter((i) => /sodium/i.test(i.text))).toHaveLength(1);
    expect(doctor.find((i) => i.id === 'soon').text).toBe('Discuss your blood sugar and LDL with a doctor soon.');
  });

  it('history findings keep their name', () => {
    const f = analyze({ ...base, chest_pain_history: 1 }).find('chest_pain_history');
    expect(f.label).toBe('History of chest pain');
    expect(f.band).toBe('Reported');
  });

  it('never repeats a suggestion within a section', () => {
    const high = PRESETS.find((p) => p.id === 'high');
    const plan = recommend(buildNotification({ inputs: toPayload(high.values), result: { probability: 0.9, risk_level: 'high' } }),
      { allergies: [], smoker: 'current', activity: 'low', medications: [] });
    for (const s of plan.sections) expect(new Set(s.items.map((i) => i.id)).size).toBe(s.items.length);
  });
});

suite('model risk bands', () => {
  it('match the backend’s RISK_BANDS', () => {
    expect([0.34, 0.35, 0.64, 0.65].map(riskLevel)).toEqual(['low', 'moderate', 'moderate', 'high']);
    expect([0.004, 0.5, 0.996].map(pctText)).toEqual(['<1', '50', '>99']);
  });
});
