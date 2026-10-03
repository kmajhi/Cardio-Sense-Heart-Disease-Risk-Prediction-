// @vitest-environment jsdom
// The guided Prediction form: (?) help, level tables and lab units.
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import SliderField from './components/SliderField';
import FieldHelp from './components/FieldHelp';
import ResultCard from './components/ResultCard';
import { SECTIONS } from './fields';
import { INFO, bandRows, levelsFor } from './fieldInfo';
import { MEASURES } from '../../clinical/ranges';

afterEach(cleanup);

describe('Level tables from the clinical ranges', () => {
  it('turns exclusive and inclusive bounds into readable ranges', () => {
    const bp = MEASURES.find((m) => m.key === 'bp_mmhg');
    expect(bandRows(bp.bands, 0).map((r) => r.range)).toEqual(['< 90', '90–119', '120–129', '130–139', '140–180', '≥ 181']);
  });

  it('uses sex-specific bands and assay-specific troponin limits', () => {
    expect(levelsFor('hdl', { sex: 'M' }).rows[0].range).toBe('< 40');
    expect(levelsFor('hdl', { sex: 'F' }).rows[0].range).toBe('< 50');
    expect(levelsFor('troponin', { sex: 'M', assay: 'high-sensitivity' }).rows[0].range).toBe('≤ 34');
    expect(levelsFor('troponin', { sex: 'F', assay: 'quantitative' }).unit).toBe('ng/mL');
  });

  it('has help for every field on the form', () => {
    for (const key of ['age', 'sex', 'height', 'weight', 'bp', 'rbs', 'totalCholesterol', 'hdl', 'ldl', 'triglycerides',
      'hemoglobin', 'creatinine', 'platelets', 'sodium', 'potassium', 'chloride', 'troponin', 'familyHistory',
      'hypertension', 'diabetes', 'chestPain', 'bmi', 'maxHR']) {
      expect(INFO[key]?.what, key).toBeTruthy();
    }
  });
});

describe('The (?) help panel', () => {
  it('opens with the explanation and levels, marks the current band, and closes on Escape', () => {
    render(<FieldHelp info={INFO.rbs} levels={levelsFor('rbs')} current={{ display: '6.7', unit: 'mmol/L', band: 'Normal' }} />);
    const button = screen.getByRole('button', { name: /what is random blood sugar/i });
    fireEvent.click(button);
    const panel = screen.getByRole('dialog', { name: /about random blood sugar/i });
    expect(panel.textContent).toMatch(/without fasting/);
    expect(panel.textContent).toMatch(/mg\/dL ÷ 18 = mmol\/L/);
    expect(panel.querySelector('.is-current').textContent).toMatch(/3\.9–7\.7.*Normal/);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(button);
  });
});

const CHOL = {
  key: 'totalCholesterol', label: 'Total cholesterol', unit: 'mg/dL', min: 100, max: 320, step: 1, limit: [50, 600],
  units: [{ unit: 'mg/dL', factor: 1, step: 1 }, { unit: 'mmol/L', factor: 1 / 38.67, step: 0.01 }],
};

function Chol({ onValue }) {
  const [value, setValue] = useState(200);
  const [unit, setUnit] = useState(0);
  return (
    <SliderField
      field={CHOL}
      value={value}
      units={CHOL.units}
      unitIndex={unit}
      onUnit={setUnit}
      onChange={(v) => {
        setValue(v);
        onValue(v);
      }}
    />
  );
}

describe('Lab units', () => {
  it('shows and accepts another unit, but always reports the model’s unit', () => {
    const onValue = vi.fn();
    render(<Chol onValue={onValue} />);
    fireEvent.change(screen.getByRole('combobox', { name: /unit for total cholesterol/i }), { target: { value: '1' } });
    const box = screen.getByRole('spinbutton', { name: /total cholesterol, mmol\/l/i });
    expect(box.value).toBe('5.17');
    fireEvent.change(box, { target: { value: '6.5' } });
    expect(onValue).toHaveBeenLastCalledWith(251.355);
    expect(box.value).toBe('6.5'); // what was typed stays put
  });
});

const WEIGHT = SECTIONS.find((sec) => sec.id === 'profile').fields.find((f) => f.key === 'weight');

describe('Values outside the allowed range', () => {
  it('weight 300 is refused with the allowed range, kept on blur, and reported so the run is blocked', () => {
    const onChange = vi.fn();
    const onInvalid = vi.fn();
    render(<SliderField field={WEIGHT} value={63} onChange={onChange} onInvalid={onInvalid} />);
    const box = screen.getByRole('spinbutton', { name: /weight/i });
    fireEvent.change(box, { target: { value: '300' } });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/out of range: allowed 30–200 kg/i);
    expect(onInvalid).toHaveBeenLastCalledWith('Weight must be between 30 and 200 kg.');
    fireEvent.blur(box);
    expect(box.value).toBe('300'); // not silently swapped back to 63
    fireEvent.change(box, { target: { value: '200' } });
    expect(onChange).toHaveBeenLastCalledWith(200);
    expect(onInvalid).toHaveBeenLastCalledWith('');
  });

  it('an empty required field also blocks the run', () => {
    const onInvalid = vi.fn();
    render(<SliderField field={WEIGHT} value={63} onChange={() => {}} onInvalid={onInvalid} />);
    fireEvent.change(screen.getByRole('spinbutton', { name: /weight/i }), { target: { value: '' } });
    expect(onInvalid).toHaveBeenLastCalledWith('Weight: enter a value between 30 and 200 kg.');
  });

  it('the slider shows exactly the allowed range', () => {
    for (const f of SECTIONS.flatMap((sec) => sec.fields)) {
      expect([f.limit[0] === f.min || f.key === 'age', f.limit[1] === f.max], f.key).toEqual([true, true]);
    }
  });

  it('the result card explains the block and disables Run', () => {
    render(
      <ResultCard status="idle" data={null} stale={false} error="" notification={null}
        blocked="Weight must be between 30 and 200 kg." blockedTitle="Check the highlighted values. " onBlockedClick={() => {}} />,
    );
    expect(screen.getByRole('alert').textContent).toMatch(/check the highlighted values.*weight must be between 30 and 200 kg/i);
    expect(screen.getByRole('button', { name: /run/i }).disabled).toBe(true);
  });
});

describe('The "which tests do I need?" guide on About', () => {
  it('names a lab test for every lab on the form, and only the lipid profile is required', async () => {
    const { GET_NUMBERS } = await import('../About/content');
    const fills = GET_NUMBERS.tests.map((t) => t.fields).join(' ');
    for (const word of ['Total cholesterol', 'HDL', 'LDL', 'Triglycerides', 'Random blood sugar', 'Hemoglobin',
      'Platelets', 'Creatinine', 'Sodium', 'Potassium', 'Chloride', 'Troponin']) {
      expect(fills, word).toContain(word);
    }
    expect(GET_NUMBERS.tests.filter((t) => t.required).map((t) => t.ask)).toEqual(['Lipid profile']);
  });
});
