import { useEffect, useState } from 'react';

// Track colours for clinical levels (soft, so the thumb stays the focus).
const TRACK = {
  normal: 'rgba(26, 158, 112, 0.45)',
  elevated: 'rgba(227, 160, 8, 0.5)',
  high: 'rgba(239, 122, 60, 0.55)',
  urgent: 'rgba(224, 69, 123, 0.6)',
};

/** Clinical bands → a CSS gradient across the slider's min..max. */
function trackGradient(bands, min, max) {
  if (!bands) return null;
  const pct = (v) => ((Math.min(Math.max(v, min), max) - min) / (max - min)) * 100;
  const stops = bands
    .filter(([from, to]) => to > min && from < max)
    .map(([from, to, level]) => `${TRACK[level]} ${pct(from)}% ${pct(to)}%`);
  return stops.length ? `linear-gradient(90deg, ${stops.join(', ')})` : null;
}

const decimals = (step) => (String(step).split('.')[1] ?? '').length;

/**
 * A labelled value: an editable number with its unit, and a slider beneath.
 * The slider covers the values patients commonly have; typing can go past it
 * (real patients can). Outside `train`, the range the model was trained on,
 * a note says the model treats the value like the nearest one it saw.
 * Typed values outside `limit` (the accepted range, shown on the slider) are
 * never applied: the field says what's allowed and keeps the typed text until
 * it's fixed, and `onInvalid(message)` tells the page so it can block the run
 * (and `onInvalid('')` once the value is valid again).
 *
 * An `optional` field can be marked "Not measured" (value null): the slider is
 * disabled and nothing stands in for the missing result. Unticking it brings
 * back `fallback` (the training median) as a starting point.
 *
 * Optional extras, all off by default:
 * - help:    a node beside the label (the (?) panel)
 * - status:  { level, band }: a live chip with the value's clinical band
 * - healthy: the healthy range text, shown under the slider
 * - bands:   [[from, to, level]] colours the slider track by clinical level
 * - units:   [{ unit, factor, step }] alternative units; `unitIndex` picks one
 *            and `onUnit(i)` changes it. The value itself always stays in the
 *            field's own unit (what the model expects); only the display converts.
 */
export default function SliderField({ field, value, onChange, fallback, help, status, healthy, bands, units, unitIndex = 0, onUnit, onInvalid }) {
  const { key, label, unit, min, max, step, limit = [-Infinity, Infinity], train = [min, max], optional = false, adultFrom } = field;
  const [low, high] = limit;
  const id = `pr-${key}`;
  const missing = value === null;

  const alt = units?.[unitIndex] && unitIndex > 0 ? units[unitIndex] : null;
  const factor = alt?.factor ?? 1;
  const shownUnit = alt?.unit ?? unit;
  const shownDigits = alt ? decimals(alt.step) : null;
  // Converted values can carry long decimals: show them a digit finer than the slider's step.
  const toText = (v) => (v === null ? '' : alt ? (v * factor).toFixed(shownDigits) : String(Number(v.toFixed(decimals(step) + 1))));

  const [draft, setDraft] = useState(toText(value));

  // Follow outside changes (slider, sample, unit switch), but never rewrite what's being typed.
  useEffect(() => {
    setDraft((d) => {
      const n = Number(d);
      const same = d.trim() !== '' && Number.isFinite(n) && value !== null && Math.abs(n / factor - value) < 1e-4;
      return same ? d : toText(value);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, factor]);

  const canonical = (text) => (alt ? Math.round((Number(text) / factor) * 1e4) / 1e4 : Number(text));
  const accepts = (text) => {
    const n = canonical(text);
    return text.trim() !== '' && Number.isFinite(n) && n >= low && n <= high;
  };

  const onType = (e) => {
    const text = e.target.value;
    setDraft(text);
    if (accepts(text)) onChange(canonical(text));
  };

  const shown = missing ? (fallback ?? min) : value;
  const rejected = !missing && draft !== toText(value) && !accepts(draft);
  const child = adultFrom !== undefined && !missing && !rejected && value < adultFrom;
  const outside = !missing && !rejected && !child && (value < train[0] || value > train[1]);
  const fill = ((Math.min(Math.max(shown, min), max) - min) / (max - min)) * 100;
  const track = trackGradient(bands, min, max);
  const fmtLimit = (n) => (alt ? (n * factor).toFixed(shownDigits) : n);
  // Age's limit starts at 1 only so a child gets its own message; the allowed adult range starts at 18.
  const allowedLow = adultFrom ?? low;
  const problem = rejected
    ? draft.trim() === ''
      ? `${label}: enter a value between ${fmtLimit(allowedLow)} and ${fmtLimit(high)} ${shownUnit}.`
      : `${label} must be between ${fmtLimit(allowedLow)} and ${fmtLimit(high)} ${shownUnit}.`
    : '';

  useEffect(() => {
    onInvalid?.(problem);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [problem]);
  useEffect(() => () => onInvalid?.(''), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`pc-pr-field${missing ? ' is-missing' : ''}`}>
      <div className="pc-pr-field-top">
        <span className="pc-pr-label-row">
          <label htmlFor={id} className="pc-pr-label">
            {label}
          </label>
          {help}
        </span>
        <span className="pc-pr-readout">
          <input
            type="number"
            inputMode="decimal"
            className={`pc-pr-num${rejected ? ' is-invalid' : ''}`}
            disabled={missing}
            placeholder={missing ? '—' : undefined}
            aria-label={`${label}, ${shownUnit}`}
            aria-invalid={rejected || undefined}
            aria-describedby={rejected ? `${id}-err` : undefined}
            min={Number.isFinite(low) ? fmtLimit(low) : undefined}
            max={Number.isFinite(high) ? fmtLimit(high) : undefined}
            step={alt?.step ?? step}
            value={draft}
            onChange={onType}
            // A valid value is tidied on leaving; an invalid one stays, with its message, until it's fixed.
            onBlur={() => !rejected && setDraft(toText(value))}
          />
          {units?.length > 1 ? (
            <select className="pc-pr-unit-pick" aria-label={`Unit for ${label}`} value={unitIndex} onChange={(e) => onUnit?.(Number(e.target.value))}>
              {units.map((u, i) => (
                <option key={u.unit} value={i}>
                  {u.unit}
                </option>
              ))}
            </select>
          ) : (
            <span className="pc-pr-unit">{unit}</span>
          )}
        </span>
      </div>
      {(status?.band || optional) && (
        <div className="pc-pr-field-meta">
          {status?.band && !missing && !rejected && (
            <span className={`pc-pr-chip is-${status.level}`} title={status.band}>
              <span aria-hidden="true" className="pc-pr-chip-dot" />
              {status.band}
            </span>
          )}
          {optional && (
            <label className="pc-pr-missing">
              <input type="checkbox" checked={missing} onChange={(e) => onChange(e.target.checked ? null : fallback ?? min)} />
              Not measured
            </label>
          )}
        </div>
      )}
      <input
        id={id}
        type="range"
        className={`pc-pr-range${track ? ' has-bands' : ''}`}
        min={min}
        max={max}
        step={step}
        disabled={missing}
        value={Math.min(Math.max(shown, min), max)}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--fill': `${fill}%`, ...(track ? { '--track': track } : {}) }}
      />
      <div className="pc-pr-scale" aria-hidden="true">
        <span>{fmtLimit(min)}</span>
        {healthy && (
          <span className="pc-pr-healthy">
            Healthy {healthy} {unit}
          </span>
        )}
        <span>{fmtLimit(max)}</span>
      </div>
      {rejected && (
        <p id={`${id}-err`} className="pc-pr-warn is-error" role="alert">
          {draft.trim() === '' ? 'Enter a value' : 'Out of range'}: allowed {fmtLimit(allowedLow)}–{fmtLimit(high)} {shownUnit}. Fix it to run
          the prediction.
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
