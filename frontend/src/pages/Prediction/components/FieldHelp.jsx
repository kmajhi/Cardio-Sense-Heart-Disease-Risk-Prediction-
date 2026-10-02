import { useEffect, useId, useRef, useState } from 'react';

const LEVEL_TEXT = { normal: 'Normal', elevated: 'Borderline', high: 'High', urgent: 'Urgent' };

/**
 * The (?) next to a field label. Opens a small panel: what the value is, where
 * to find it, unit conversions and its clinical levels, with the patient's
 * current band highlighted. Closes on Escape (focus returns to the button),
 * an outside click, or the close button. On phones it becomes a bottom sheet.
 *
 * info:    an entry from fieldInfo.js INFO
 * levels:  levelsFor(...) → { rows, unit, healthy, source } | null
 * current: { display, unit, band } for the value as entered, or null
 */
export default function FieldHelp({ info, levels, current }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    const onDown = (e) => !wrapRef.current?.contains(e.target) && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  if (!info) return null;
  const activeRow = current?.band ? levels?.rows.findIndex((r) => r.label === current.band) : -1;

  return (
    <span className="pc-help" ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className={`pc-help-btn${open ? ' is-open' : ''}`}
        aria-label={`What is ${info.title}?`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        ?
      </button>
      {open && (
        <span className="pc-help-panel" id={panelId} role="dialog" aria-label={`About ${info.title}`}>
          <span className="pc-help-head">
            <strong>{info.title}</strong>
            <button type="button" className="pc-help-close" aria-label="Close" onClick={() => setOpen(false)}>
              ×
            </button>
          </span>
          <span className="pc-help-text">{info.what}</span>
          {info.find && (
            <span className="pc-help-block">
              <b>Where to find it</b>
              {info.find}
            </span>
          )}
          {info.convert && (
            <span className="pc-help-block is-convert">
              <b>Units</b>
              {info.convert}
            </span>
          )}
          {levels && (
            <span className="pc-help-levels">
              <b>
                Levels <i>({levels.unit})</i>
              </b>
              <span className="pc-help-table" role="list">
                {levels.rows.map((r, i) => (
                  <span key={r.range} role="listitem" className={`pc-help-row is-${r.level}${i === activeRow ? ' is-current' : ''}`}>
                    <span className="pc-help-dot" aria-hidden="true" />
                    <span className="pc-help-range">{r.range}</span>
                    <span className="pc-help-label">{r.label}</span>
                    {i === activeRow ? <span className="pc-help-you">You</span> : <span className="pc-visually-hidden">{LEVEL_TEXT[r.level]}</span>}
                  </span>
                ))}
              </span>
            </span>
          )}
          {current && current.band && activeRow === -1 && (
            <span className="pc-help-block">
              <b>This value</b>
              {current.display} {current.unit}: {current.band}
            </span>
          )}
          {info.note && <span className="pc-help-note">{info.note}</span>}
          {levels?.source && <span className="pc-help-source">Source: {levels.source}</span>}
        </span>
      )}
    </span>
  );
}
