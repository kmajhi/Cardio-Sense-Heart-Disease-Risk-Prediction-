import { useState } from 'react';
import PhotoPicker from './PhotoPicker';
import { ACTIVITY, BLOOD_GROUPS, HISTORY, SEX, SMOKER, bmiBand, bmiFrom } from '../profileFields';

const YES_NO = [
  [0, 'No'],
  [1, 'Yes'],
];

function Field({ id, label, error, hint, children, wide }) {
  return (
    <div className={`pc-p-field${wide ? ' is-wide' : ''}${error ? ' is-invalid' : ''}`}>
      <label htmlFor={id} className="pc-p-label">
        {label}
      </label>
      {children}
      {(error || hint) && (
        <p id={`${id}-note`} className={`pc-p-hint${error ? ' is-error' : ''}`}>
          {error || hint}
        </p>
      )}
    </div>
  );
}

/** Pill toggle group; clicking the selected pill again clears it. */
function Choice({ id, label, options, value, onChange, clearable = true }) {
  return (
    <div className="pc-p-field">
      <span className="pc-p-label" id={id}>
        {label}
      </span>
      <div className="pc-p-seg" role="group" aria-labelledby={id}>
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(clearable && value === v ? (typeof v === 'number' ? null : '') : v)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function TagInput({ id, label, items, onChange, placeholder }) {
  const [text, setText] = useState('');
  const add = () => {
    const value = text.trim().replace(/\s+/g, ' ');
    if (value && !items.some((t) => t.toLowerCase() === value.toLowerCase()) && value.length <= 60) {
      onChange([...items, value]);
    }
    setText('');
  };
  return (
    <div className="pc-p-field is-wide">
      <label htmlFor={id} className="pc-p-label">
        {label}
      </label>
      <div className="pc-p-taginput">
        <ul className="pc-p-tags" aria-label={`${label} added`}>
          {items.map((t) => (
            <li key={t}>
              {t}
              <button type="button" onClick={() => onChange(items.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
                ×
              </button>
            </li>
          ))}
        </ul>
        <div className="pc-p-taginput-row">
          <input
            id={id}
            className="pc-p-input"
            value={text}
            placeholder={placeholder}
            maxLength={60}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                add();
              } else if (e.key === 'Backspace' && !text && items.length) {
                onChange(items.slice(0, -1));
              }
            }}
          />
          <button type="button" className="pc-p-btn pc-p-btn--soft" onClick={add} disabled={!text.trim()}>
            Add
          </button>
        </div>
      </div>
      <p className="pc-p-hint">Press Enter to add. Remove with ×.</p>
    </div>
  );
}

/**
 * Create / edit form. The parent owns the draft, so the identity card beside
 * it previews every change as it's typed.
 */
export default function ProfileForm({ draft, setDraft, errors, saving, isNew, onSubmit, onCancel }) {
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));
  const input = (key) => ({
    id: `pf-${key}`,
    name: key,
    className: 'pc-p-input',
    value: draft[key],
    onChange: (e) => set(key)(e.target.value),
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': `pf-${key}-note`,
  });
  const bmi = bmiFrom(draft.height_cm, draft.weight_kg);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form className="pc-p-form" onSubmit={onSubmit} noValidate aria-labelledby="pf-title">
      <header className="pc-p-form-head">
        <h2 id="pf-title" className="pc-p-tile-title">
          {isNew ? 'Create your profile' : 'Edit profile'}
        </h2>
        <p className="pc-p-muted">Only your name is required. Everything else helps fill your report.</p>
      </header>

      <fieldset className="pc-p-section" style={{ '--i': 0 }}>
        <legend>Personal</legend>
        <div className="pc-p-grid">
          <PhotoPicker value={draft.photo} name={draft.full_name} onChange={set('photo')} />
          <Field id="pf-full_name" label="Full name" error={errors.full_name} wide>
            <input {...input('full_name')} autoComplete="name" maxLength={80} required />
          </Field>
          <Field id="pf-email" label="Email" error={errors.email}>
            <input {...input('email')} type="email" autoComplete="email" inputMode="email" />
          </Field>
          <Field id="pf-phone" label="Phone" error={errors.phone}>
            <input {...input('phone')} type="tel" autoComplete="tel" placeholder="+880 1XXX XXXXXX" />
          </Field>
          <Field id="pf-date_of_birth" label="Date of birth" error={errors.date_of_birth}>
            <input {...input('date_of_birth')} type="date" max={today} autoComplete="bday" />
          </Field>
          <Choice id="pf-sex" label="Sex" options={SEX} value={draft.sex} onChange={set('sex')} />
        </div>
      </fieldset>

      <fieldset className="pc-p-section" style={{ '--i': 1 }}>
        <legend>Body</legend>
        <div className="pc-p-grid pc-p-grid--3">
          <Field id="pf-height_cm" label="Height (cm)" error={errors.height_cm}>
            <input {...input('height_cm')} type="number" inputMode="decimal" min="50" max="250" step="0.5" />
          </Field>
          <Field id="pf-weight_kg" label="Weight (kg)" error={errors.weight_kg}>
            <input {...input('weight_kg')} type="number" inputMode="decimal" min="2" max="400" step="0.1" />
          </Field>
          <Field id="pf-blood_group" label="Blood group">
            <select {...input('blood_group')}>
              <option value="">Not set</option>
              {BLOOD_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="pc-p-derived" aria-live="polite">
          BMI <b>{bmi === null ? '—' : bmi.toFixed(1)}</b>
          {bmi !== null && <span className={`pc-p-chip is-${bmiBand(bmi).tone}`}>{bmiBand(bmi).label}</span>}
        </p>
      </fieldset>

      <fieldset className="pc-p-section" style={{ '--i': 2 }}>
        <legend>Medical history</legend>
        <div className="pc-p-grid">
          {HISTORY.map((h) => (
            <Choice key={h.key} id={`pf-${h.key}`} label={h.label} options={YES_NO} value={draft[h.key]} onChange={set(h.key)} />
          ))}
        </div>
      </fieldset>

      <fieldset className="pc-p-section" style={{ '--i': 3 }}>
        <legend>Lifestyle</legend>
        <div className="pc-p-grid">
          <Choice id="pf-smoker" label="Smoking" options={SMOKER} value={draft.smoker} onChange={set('smoker')} />
          <Choice id="pf-activity" label="Physical activity" options={ACTIVITY} value={draft.activity} onChange={set('activity')} />
          <TagInput id="pf-medications" label="Medications" items={draft.medications} onChange={set('medications')} placeholder="e.g. Atorvastatin 10 mg" />
          <TagInput id="pf-allergies" label="Allergies" items={draft.allergies} onChange={set('allergies')} placeholder="e.g. Penicillin" />
        </div>
      </fieldset>

      <fieldset className="pc-p-section" style={{ '--i': 4 }}>
        <legend>Emergency contact</legend>
        <div className="pc-p-grid">
          <Field id="pf-emergency_name" label="Name">
            <input {...input('emergency_name')} maxLength={80} />
          </Field>
          <Field id="pf-emergency_phone" label="Phone" error={errors.emergency_phone}>
            <input {...input('emergency_phone')} type="tel" />
          </Field>
        </div>
      </fieldset>

      <footer className="pc-p-form-foot">
        {Object.keys(errors).length > 0 && (
          <p className="pc-p-hint is-error" role="alert">
            Fix the highlighted fields to save.
          </p>
        )}
        <button type="button" className="pc-p-btn pc-p-btn--soft" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="pc-p-btn pc-p-btn--primary" disabled={saving}>
          {saving ? 'Saving…' : isNew ? 'Create profile' : 'Save changes'}
          <span className="pc-hero-cta-arrow" aria-hidden="true">
            ✓
          </span>
        </button>
      </footer>
    </form>
  );
}
