import { useEffect, useState } from 'react';

/**
 * Slider plus an editable number, like the design's slider rows.
 * The slider covers the training-data range; typing can go past it
 * (real patients can), and then a note says the estimate is less reliable.
 */
export default function SliderField({ field, value, onChange }) {
  const { key, label, unit, min, max, step } = field;
  const id = `pr-${key}`;
  const [draft, setDraft] = useState(String(value));

  useEffect(() => setDraft(String(value)), [value]);

  const onType = (e) => {
    const text = e.target.value;
    setDraft(text);
    const n = Number(text);
    if (text !== '' && Number.isFinite(n)) onChange(n);
  };

  const outside = value < min || value > max;
  const fill = ((Math.min(Math.max(value, min), max) - min) / (max - min)) * 100;

  return (
    <div className="pc-pr-field">
      <div className="pc-pr-field-top">
        <label htmlFor={id} className="pc-pr-label">
          {label}
        </label>
        <span className="pc-pr-readout">
          <input
            type="number"
            className="pc-pr-num"
            aria-label={`${label}, ${unit}`}
            step={step}
            value={draft}
            onChange={onType}
            onBlur={() => setDraft(String(value))}
          />
          <span className="pc-pr-unit">{unit}</span>
        </span>
      </div>
      <input
        id={id}
        type="range"
        className="pc-pr-range"
        min={min}
        max={max}
        step={step}
        value={Math.min(Math.max(value, min), max)}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--fill': `${fill}%` }}
      />
      <div className="pc-pr-scale" aria-hidden="true">
        <span>{min}</span>
        <span>{max}</span>
      </div>
      {outside && (
        <p className="pc-pr-warn">
          Outside the training data ({min}–{max} {unit}). The estimate is less reliable here.
        </p>
      )}
    </div>
  );
}
