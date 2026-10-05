import { useId, useState } from 'react';
import { admin } from '../../../api/adminApi';
import { generatePassword, passwordProblem } from '../labels';
import { useToast } from '../ui';

/**
 * New password + confirmation, with Show, Generate and Copy. The fields start
 * read-only and unlock on focus, so the browser can't autofill the
 * administrator's own saved password into them.
 */
export function PasswordFields({ value, confirm, onChange, label = 'New password' }) {
  const ids = { pw: useId(), again: useId(), hint: useId() };
  const [shown, setShown] = useState(false);
  const [locked, setLocked] = useState(true);
  const [copied, setCopied] = useState(false);
  const notify = useToast();
  const unlock = () => setLocked(false);
  const generate = () => {
    const pw = generatePassword();
    onChange(pw, pw);
    setShown(true);
    setCopied(false);
  };
  const copy = () =>
    navigator.clipboard
      ?.writeText(value)
      .then(() => setCopied(true))
      .catch(() => notify('Couldn’t copy. Select the password and copy it yourself.', 'error'));
  const problem = value || confirm ? passwordProblem(value, confirm) : '';
  const common = {
    type: shown ? 'text' : 'password',
    autoComplete: 'new-password',
    readOnly: locked,
    onFocus: unlock,
    spellCheck: false,
    'data-lpignore': 'true',
    'data-1p-ignore': 'true',
  };
  return (
    <div className="cx-pw">
      <label className="cx-field" htmlFor={ids.pw}>
        <span>{label}</span>
      </label>
      <div className="cx-pw-row">
        <input id={ids.pw} name="doctor-new-password" value={value} aria-describedby={ids.hint} onChange={(e) => onChange(e.target.value, confirm)} {...common} />
        <button type="button" className="cx-btn is-small" onClick={() => setShown((v) => !v)} aria-pressed={shown}>
          {shown ? 'Hide' : 'Show'}
        </button>
      </div>
      <label className="cx-field" htmlFor={ids.again}>
        <span>Confirm password</span>
      </label>
      <div className="cx-pw-row">
        <input id={ids.again} name="doctor-new-password-confirm" value={confirm} onChange={(e) => onChange(value, e.target.value)} {...common} />
      </div>
      <p id={ids.hint} className={`cx-pw-hint${problem ? ' is-bad' : ''}`} role={problem ? 'alert' : undefined}>
        {problem || 'At least 8 characters, not only numbers, and not a common password.'}
      </p>
      <div className="cx-actions-row">
        <button type="button" className="cx-btn is-small" onClick={generate}>
          Generate strong password
        </button>
        <button type="button" className="cx-btn is-small" onClick={copy} disabled={!value}>
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

/** Admin → Doctors → a doctor → "Set new password": for a doctor who forgot theirs. */
export default function SetDoctorPassword({ doctor, onDone }) {
  const notify = useToast();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState({ value: '', confirm: '' });
  const [requireChange, setRequireChange] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const problem = passwordProblem(pw.value, pw.confirm);

  const save = async (e) => {
    e.preventDefault();
    if (problem) return;
    setBusy(true);
    setError('');
    try {
      const res = await admin.resetDoctorPassword(doctor.id, pw.value, requireChange);
      notify(res.detail);
      setPw({ value: '', confirm: '' });
      setOpen(false);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="cx-actions-row">
        <button type="button" className="cx-btn" onClick={() => setOpen(true)}>
          Set new password
        </button>
        <span className="cx-muted">For a doctor who forgot their password. Their current sessions end.</span>
      </div>
    );
  }
  return (
    <form className="cx-pw-form" onSubmit={save} noValidate autoComplete="off">
      <PasswordFields value={pw.value} confirm={pw.confirm} onChange={(value, confirm) => setPw({ value, confirm })} />
      <label className="cx-check-label" style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 12 }}>
        <input type="checkbox" className="cx-checkbox" checked={requireChange} onChange={(e) => setRequireChange(e.target.checked)} />
        <span>
          Require {doctor.name} to choose a new password at next sign-in <span className="cx-muted">(recommended)</span>
        </span>
      </label>
      {error && (
        <div className="cx-callout is-warn" role="alert" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}
      <p className="cx-muted" style={{ margin: '12px 0 0' }}>
        Give the password to the doctor in person or by phone, never by email. It is stored hashed and can’t be shown again after you save.
      </p>
      <div className="cx-actions-row" style={{ marginTop: 12 }}>
        <button type="submit" className="cx-btn is-primary" disabled={busy || Boolean(problem)}>
          {busy ? 'Saving…' : 'Save new password'}
        </button>
        <button
          type="button"
          className="cx-btn"
          onClick={() => {
            setOpen(false);
            setPw({ value: '', confirm: '' });
            setError('');
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
