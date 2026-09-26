import { useEffect, useId, useRef, useState } from 'react';

/**
 * A text field with a list of options under it (ARIA combobox pattern).
 * Typing calls onType; ↑/↓ move through the list, Enter picks (never submits
 * the form), Esc closes, × clears. The parent owns the text and the options.
 *
 * options: [{ key, label, detail?, note?, lead? }]  — lead is a small leading
 * glyph (a flag), note a second line.
 */
export default function Combobox({
  id,
  label,
  text,
  onType,
  options,
  onPick,
  onClear,
  open,
  setOpen,
  message = '',
  placeholder,
  hint,
  error,
  disabled = false,
}) {
  const listId = useId();
  const [active, setActive] = useState(0);
  const wrap = useRef(null);

  useEffect(() => setActive(0), [options]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => !wrap.current?.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open, setOpen]);

  // Keep the highlighted option in view while arrowing through a long list.
  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open, listId]);

  const onKeyDown = (e) => {
    if (e.key === 'Escape') return setOpen(false);
    if (e.key === 'ArrowDown' && !open) return setOpen(true);
    if (!open || !options.length) return undefined;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i - 1 + options.length) % options.length);
    } else if (e.key === 'Enter') {
      e.preventDefault(); // pick, don't submit the form
      onPick(options[active]);
    }
    return undefined;
  };

  const showList = open && (options.length > 0 || Boolean(message));

  return (
    <div className={`pc-p-field pc-p-combo${error ? ' is-invalid' : ''}`} ref={wrap}>
      <label htmlFor={id} className="pc-p-label">
        {label}
      </label>
      <div className="pc-p-city-box">
        <input
          id={id}
          className="pc-p-input"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && options.length ? `${listId}-${active}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-note`}
          autoComplete="off"
          placeholder={placeholder}
          maxLength={80}
          value={text}
          disabled={disabled}
          onChange={(e) => {
            onType(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {text && !disabled && (
          <button type="button" className="pc-p-city-clear" onClick={onClear} aria-label={`Clear ${label.toLowerCase()}`}>
            ×
          </button>
        )}
        {showList && (
          <ul id={listId} role="listbox" className="pc-p-city-list" aria-label={label}>
            {message && <li className="pc-p-city-note">{message}</li>}
            {options.map((o, i) => (
              <li
                key={o.key}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={`${i === active ? 'is-active' : ''}${o.lead ? ' has-lead' : ''}`}
                onPointerDown={(e) => e.preventDefault()} // keep focus in the input
                onClick={() => onPick(o)}
                onMouseEnter={() => setActive(i)}
              >
                {o.lead && (
                  <span className="pc-p-combo-lead" aria-hidden="true">
                    {o.lead}
                  </span>
                )}
                <b>{o.label}</b>
                {o.detail && <span>{o.detail}</span>}
                {o.note && <small>{o.note}</small>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p id={`${id}-note`} className={`pc-p-hint${error ? ' is-error' : ''}`}>
        {error || hint}
      </p>
    </div>
  );
}
