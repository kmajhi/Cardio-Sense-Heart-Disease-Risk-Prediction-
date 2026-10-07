import { describe, expect, it } from 'vitest';
import { compactTimeline, drName, findingStatus, groupMeasurements, historyItems, keyFindings, missingForSubmit, patientLine, riskLine } from './format';

const f = (key, extra) => ({ key, label: key, kind: 'measure', status: 'ok', level: 'normal', dir: null, ...extra });

describe('Doctor Panel formatting', () => {
  it('writes statuses in words, never colour alone, and never calls a low value high', () => {
    expect(findingStatus(f('ldl', { status: 'flagged', level: 'elevated', dir: 'high' }))).toEqual({ text: '↑ Mildly high', tone: 'warn' });
    expect(findingStatus(f('hdl', { status: 'flagged', level: 'high', dir: 'low' }))).toEqual({ text: '↓ Low', tone: 'alert' });
    expect(findingStatus(f('ldl')).text).toBe('Within range');
    expect(findingStatus(f('ldl', { status: 'missing', level: null })).text).toBe('Not measured');
    expect(findingStatus(f('troponin_i', { status: 'flagged', level: 'urgent', dir: 'high' })).text).toBe('↑ Prompt attention (high)');
  });

  it('requires a decision, remarks, and an action plan only where the decision needs one', () => {
    const blank = { decision: '', remarks: '', action_plan: '', notes: '' };
    expect(missingForSubmit(blank)).toBe('Select a review decision.');
    expect(missingForSubmit({ ...blank, decision: 'approved' })).toBe('Write the diagnosis and advice in the prescription.');
    const unnamed = [{ name: 'Aspirin', strength: '75 mg' }, { name: ' ', strength: '20 mg' }];
    expect(missingForSubmit({ ...blank, decision: 'approved', remarks: 'Fine.', medications: unnamed })).toBe('Enter the name of medicine 2, or remove that row.');
    expect(missingForSubmit({ ...blank, decision: 'approved', remarks: 'Fine.', medications: [{ name: '', strength: '' }] })).toBe('');
    expect(missingForSubmit({ ...blank, decision: 'approved', remarks: 'Fine.' })).toBe('');
    expect(missingForSubmit({ ...blank, decision: 'follow_up_required', remarks: 'See me.' })).toMatch(/action plan/);
    expect(missingForSubmit({ ...blank, decision: 'follow_up_required', remarks: 'x', action_plan: 'Recheck in 3 months.' })).toBe('');
  });

  it('groups only the measurements the assessment has, like a lab sheet', () => {
    const groups = groupMeasurements([f('ldl'), f('bp_mmhg'), f('bmi'), f('hypertension', { kind: 'history' })]);
    expect(groups.map((g) => g.title)).toEqual(['Anthropometric', 'Blood pressure', 'Lipid profile']);
    expect(groups.flatMap((g) => g.rows.map((r) => r.key))).not.toContain('hypertension');
  });

  it('lists flagged measurements most serious first', () => {
    const items = keyFindings([
      f('ldl', { status: 'flagged', level: 'elevated' }),
      f('troponin_i', { status: 'flagged', level: 'urgent' }),
      f('bp_mmhg', { status: 'flagged', level: 'high' }),
      f('hdl'),
      f('family_history', { kind: 'history', status: 'flagged' }),
    ]);
    expect(items.map((i) => i.key)).toEqual(['troponin_i', 'bp_mmhg', 'ldl']);
  });

  it('never guesses missing patient details', () => {
    expect(patientLine({ age: 48, sex: 'M' })).toBe('48 years · Male');
    expect(patientLine({})).toBe('Age and sex not recorded');
    expect(historyItems({ diabetes: 1, hypertension: 0 }).map((h) => h.value)).toEqual(['No', 'Yes', 'Not answered', 'Not answered']);
    expect(riskLine({ probability: 0.52, level: 'moderate' })).toBe('52% · Moderate');
  });

  it('does not double the doctor title, and folds repeated draft saves', () => {
    expect(drName('Sarah Rahman')).toBe('Dr. Sarah Rahman');
    expect(drName('Dr. Sarah Rahman')).toBe('Dr. Sarah Rahman');
    const t = compactTimeline([{ kind: 'claimed' }, { kind: 'draft_saved', at: '1' }, { kind: 'draft_saved', at: '2' }, { kind: 'submitted' }]);
    expect(t.map((e) => e.label ?? e.kind)).toEqual(['claimed', 'Draft saved (2 times)', 'submitted']);
    expect(t[1].at).toBe('2');
  });
});
