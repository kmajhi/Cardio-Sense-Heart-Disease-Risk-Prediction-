import { useState } from 'react';
import { changePassword, exportData } from '../../../api/authApi';
import { useAuth } from '../../../auth/AuthContext';
import Modal from './Modal';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * The account itself: change the password, download everything stored, or
 * delete the account with all its data (QA M5, L8). Shown whether or not a
 * profile exists: assessments belong to the account, not the profile.
 *
 * An account made with Google or X sign-in has no password: it can set one
 * (no current password asked), and confirms deleting by typing DELETE.
 */
export default function AccountCard({ notify }) {
  const auth = useAuth();
  const hasPassword = auth?.user?.has_password !== false; // mock accounts always have one
  const signInWith = auth?.user?.sign_in_with ?? [];
  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const savePassword = async (e) => {
    e.preventDefault();
    setPwBusy(true);
    try {
      await changePassword({ currentPassword: hasPassword ? pw.current : '', newPassword: pw.next });
      setPw({ current: '', next: '' });
      notify(hasPassword ? 'Password changed.' : 'Password set. You can now also log in with your email.', 'ok');
      if (!hasPassword) auth?.refresh?.();
    } catch (err) {
      notify(err.message || "Couldn't change the password.", 'error');
    } finally {
      setPwBusy(false);
    }
  };

  const download = async () => {
    try {
      const data = await exportData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `cardio-sense-my-data-${today()}.json`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify('Your data was downloaded.', 'ok');
    } catch (err) {
      notify(err.message || "Couldn't download your data.", 'error');
    }
  };

  const closeConfirm = () => {
    setConfirming(false);
    setPassword('');
    setDeleteError('');
  };

  const remove = async (e) => {
    e.preventDefault();
    setDeleting(true);
    setDeleteError('');
    try {
      // Signs out; the protected page then goes home.
      await auth.deleteAccount(hasPassword ? { password } : { confirm: password });
    } catch (err) {
      setDeleteError(err.message || "Couldn't delete the account.");
      setDeleting(false);
    }
  };

  return (
    <section className="pc-p-account pc-enter" style={{ '--d': '520ms' }} aria-labelledby="pf-account-title">
      <h2 id="pf-account-title">Account &amp; data</h2>
      <div className="pc-p-account-grid">
        <form className="pc-p-account-block" onSubmit={savePassword}>
          <h3>{hasPassword ? 'Change password' : 'Set a password'}</h3>
          {!hasPassword && (
            <p>
              You sign in with {signInWith.map((id) => (id === 'gmail' ? 'Google' : 'X')).join(' or ') || 'Google or X'}.
              Add a password to also log in with your email.
            </p>
          )}
          <div className="pc-p-account-form">
            {hasPassword && (
              <>
                <label className="pc-p-label" htmlFor="pf-pw-current">
                  Current password
                </label>
                <input
                  id="pf-pw-current"
                  className="pc-p-input"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={pw.current}
                  onChange={(e) => setPw((v) => ({ ...v, current: e.target.value }))}
                />
              </>
            )}
            <label className="pc-p-label" htmlFor="pf-pw-new">
              New password
            </label>
            <input
              id="pf-pw-new"
              className="pc-p-input"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={pw.next}
              onChange={(e) => setPw((v) => ({ ...v, next: e.target.value }))}
            />
          </div>
          <button type="submit" className="pc-p-btn pc-p-btn--soft" disabled={pwBusy}>
            {pwBusy ? 'Saving…' : hasPassword ? 'Change password' : 'Set password'}
          </button>
        </form>

        <div className="pc-p-account-block">
          <h3>Your data</h3>
          <p>Download everything stored about you (account, profile and every assessment) as a JSON file.</p>
          <button type="button" className="pc-p-btn pc-p-btn--soft" onClick={download}>
            Download my data
          </button>
        </div>

        <div className="pc-p-account-block">
          <h3>Delete account</h3>
          <p>
            Permanently deletes your account, profile and all assessments. This can’t be undone. Deleting only the
            profile keeps your assessments.
          </p>
          <button type="button" className="pc-p-btn pc-p-btn--danger" onClick={() => setConfirming(true)}>
            Delete account…
          </button>
        </div>
      </div>

      <Modal
        open={confirming}
        onClose={closeConfirm}
        title="Delete your account?"
        subtitle={`Your account, profile and every assessment will be permanently deleted. ${
          hasPassword ? 'Enter your password to confirm.' : 'Type DELETE to confirm.'
        }`}
        size="sm"
        tone="danger"
      >
        <form onSubmit={remove} className="pc-p-account-form">
          <label className="pc-p-label" htmlFor="pf-delete-pw">
            {hasPassword ? 'Password' : 'Type DELETE'}
          </label>
          <input
            id="pf-delete-pw"
            className="pc-p-input"
            type={hasPassword ? 'password' : 'text'}
            autoComplete={hasPassword ? 'current-password' : 'off'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {deleteError && (
            <p className="pc-p-hint is-error" role="alert">
              {deleteError}
            </p>
          )}
          <div className="pc-p-modal-foot">
            <button type="button" className="pc-p-btn pc-p-btn--soft" onClick={closeConfirm}>
              Keep account
            </button>
            <button type="submit" className="pc-p-btn pc-p-btn--danger" disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete everything'}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
