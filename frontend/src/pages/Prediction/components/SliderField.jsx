import { useEffect, useState } from 'react';

/**
 * Slider plus an editable number, like the design's slider rows.
 * The slider covers the training-data range; typing can go past it
 * (real patients can), and then a note says the estimate is less reliable.
 * Typed values outside `limit` (the possible range) are never applied: the
 * field shows why, and leaving it restores the last good value.
 */
export default function SliderField({ field, value, onChange }) {
  const { key, label, unit, min, max, step, limit = [-Infinity, Infinity] } = field;
  const [low, high] = limit;
  const id = `pr-${key}`;
  const [draft, setDraft] = useState(String(value));

  useEffect(() => setDraft(String(value)), [value]);

  const accepts = (text) => {
    const n = Number(text);
    return text.trim() !== '' && Number.isFinite(n) && n >= low && n <= high;
  };

  const onType = (e) => {
    const text = e.target.value;
    setDraft(text);
    if (accepts(text)) onChange(Number(text));
  };

  const rejected = draft !== String(value) && !accepts(draft);
  const outside = !rejected && (value < min || value > max);
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
            className={`pc-pr-num${rejected ? ' is-invalid' : ''}`}
            aria-label={`${label}, ${unit}`}
            aria-invalid={rejected || undefined}
            aria-describedby={rejected ? `${id}-err` : undefined}
            min={Number.isFinite(low) ? low : undefined}
            max={Number.isFinite(high) ? high : undefined}
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
      {rejected && (
        <p id={`${id}-err`} className="pc-pr-warn is-error" role="alert">
          Enter {low}–{high} {unit}. Values outside that range aren't possible, so this one isn't used.
        </p>
      )}
      {outside && (
        <p className="pc-pr-warn">
          Outside the training data ({min}–{max} {unit}). The estimate is less reliable here.
        </p>
      )}
    </div>
  );
}
