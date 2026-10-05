import { useId, useState } from 'react';
import { doctorApi } from '../../../api/doctorApi';
import { Icon, PasswordInput, useToast } from '../ui';

/** Current + new password. The server checks the current one and the password rules. */
export function PasswordForm({ onDone, submitLabel = 'Change password' }) {
  const ids = { cur: useId(), next: useId(), again: useId(), err: useId() };
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (next !== again) {
      setError('The new passwords don’t match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const me = await doctorApi.changePassword(current, next);
      setCurrent('');
      setNext('');
      setAgain('');
      onDone?.(me);
    } catch (err) {
      setError(err.status === 400 ? err.message : 'We couldn’t change your password. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="dr-form" style={{ marginTop: 20 }} onSubmit={submit} noValidate>
      <div className="dr-field">
        <label className="dr-label" htmlFor={ids.cur}>
          Current password
        </label>
        <PasswordInput id={ids.cur} value={current} onChange={setCurrent} autoComplete="current-password" />
      </div>
      <div className="dr-field">
        <label className="dr-label" htmlFor={ids.next}>
          New password
        </label>
        <PasswordInput id={ids.next} value={next} onChange={setNext} autoComplete="new-password" invalid={Boolean(error)} describedBy={error ? ids.err : undefined} />
        <p className="dr-help">At least 8 characters, not only numbers, and not a common password.</p>
      </div>
      <div className="dr-field">
        <label className="dr-label" htmlFor={ids.again}>
          Confirm new password
        </label>
        <PasswordInput id={ids.again} value={again} onChange={setAgain} autoComplete="new-password" invalid={Boolean(error)} describedBy={error ? ids.err : undefined} />
      </div>
      {error && (
        <p id={ids.err} className="dr-field-error" role="alert">
          {error}
        </p>
      )}
      <div>
        <button type="submit" className="dr-btn is-primary" disabled={busy || !current || !next || !again}>
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

export default function Security() {
  const toast = useToast();
  return (
    <>
      <div className="dr-page-head">
        <div>
          <h1 className="dr-h1">Security</h1>
          <p className="dr-sub">Change the password you use to sign in to the Doctor Portal.</p>
        </div>
      </div>
      <section className="dr-card dr-section dr-narrow">
        <div className="dr-section-head">
          <div>
            <h2 className="dr-h2">Password</h2>
            <p>Changing it signs you out on every other device.</p>
          </div>
        </div>
        <div className="dr-section-body">
          <PasswordForm onDone={() => toast('Password changed.')} />
        </div>
      </section>
      <div className="dr-callout is-info dr-narrow">
        <Icon name="shield" />
        <p>Never share your password. Cardio Sense staff will never ask for it; an administrator can set a new temporary one if you lose it.</p>
      </div>
    </>
  );
}
