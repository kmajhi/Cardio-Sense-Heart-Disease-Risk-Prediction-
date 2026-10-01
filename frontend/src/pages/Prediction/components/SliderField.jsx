import { useEffect, useState } from 'react';

/**
 * Slider plus an editable number, like the design's slider rows.
 * The slider covers the values patients commonly have; typing can go past it
 * (real patients can). Outside `train`, the range the model was trained on,
 * a note says the model treats the value like the nearest one it saw.
 * Typed values outside `limit` (the possible range) are never applied: the
 * field shows why, and leaving it restores the last good value.
 *
 * An `optional` field can be marked "Not measured" (value null): the slider is
 * disabled and nothing stands in for the missing result. Unticking it brings
 * back `fallback` (the training median) as a starting point.
 */
export default function SliderField({ field, value, onChange, fallback }) {
  const { key, label, unit, min, max, step, limit = [-Infinity, Infinity], train = [min, max], optional = false, adultFrom } = field;
  const [low, high] = limit;
  const id = `pr-${key}`;
  const missing = value === null;
  const [draft, setDraft] = useState(missing ? '' : String(value));

  useEffect(() => setDraft(value === null ? '' : String(value)), [value]);

  const accepts = (text) => {
    const n = Number(text);
    return text.trim() !== '' && Number.isFinite(n) && n >= low && n <= high;
  };

  const onType = (e) => {
    const text = e.target.value;
    setDraft(text);
    if (accepts(text)) onChange(Number(text));
  };

  const shown = missing ? (fallback ?? min) : value;
  const rejected = !missing && draft !== String(value) && !accepts(draft);
  const child = adultFrom !== undefined && !missing && !rejected && value < adultFrom;
  const outside = !missing && !rejected && !child && (value < train[0] || value > train[1]);
  const fill = ((Math.min(Math.max(shown, min), max) - min) / (max - min)) * 100;

  return (
    <div className={`pc-pr-field${missing ? ' is-missing' : ''}`}>
      <div className="pc-pr-field-top">
        <label htmlFor={id} className="pc-pr-label">
          {label}
        </label>
        <span className="pc-pr-readout">
          <input
            type="number"
            className={`pc-pr-num${rejected ? ' is-invalid' : ''}`}
            disabled={missing}
            placeholder={missing ? '—' : undefined}
            aria-label={`${label}, ${unit}`}
            aria-invalid={rejected || undefined}
            aria-describedby={rejected ? `${id}-err` : undefined}
            min={Number.isFinite(low) ? low : undefined}
            max={Number.isFinite(high) ? high : undefined}
            step={step}
            value={draft}
            onChange={onType}
            onBlur={() => setDraft(missing ? '' : String(value))}
          />
          <span className="pc-pr-unit">{unit}</span>
        </span>
      </div>
      {optional && (
        <label className="pc-pr-missing">
          <input
            type="checkbox"
            checked={missing}
            onChange={(e) => onChange(e.target.checked ? null : fallback ?? min)}
          />
          Not measured
        </label>
      )}
      <input
        id={id}
        type="range"
        className="pc-pr-range"
        min={min}
        max={max}
        step={step}
        disabled={missing}
        value={Math.min(Math.max(shown, min), max)}
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
      {missing && <p className="pc-pr-warn">Left out: the model fills it in, and the result says so.</p>}
      {child && (
        <p className="pc-pr-warn is-error" role="alert">
          Under {adultFrom}: the model only estimates adults, so it can’t run for this patient.
        </p>
      )}
      {outside && (
        <p className="pc-pr-warn">
          Beyond the training data ({train[0]}–{train[1]} {unit}): the model treats it like{' '}
          {value < train[0] ? train[0] : train[1]} {unit}, so the estimate is less reliable.
        </p>
      )}
    </div>
  );
}
