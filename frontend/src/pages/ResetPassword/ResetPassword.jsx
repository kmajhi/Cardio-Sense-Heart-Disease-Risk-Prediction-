import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import NavBar from '../../components/NavBar';
import SiteFooter from '../../components/SiteFooter';
import { confirmPasswordReset } from '../../api/authApi';
import '../Dashboard/Dashboard.css'; // shared tokens, nav
import '../Home/Home.css'; // form controls (hm-*)
import './ResetPassword.css';

/**
 * Where the password-reset email lands: /reset-password?uid=…&token=…
 * (backend/predictor/accounts.py → PasswordResetRequestView). Sets a new
 * password, then sends the user to log in with it.
 */
export default function ResetPassword({ user, LinkComponent = 'a', activePath = '/reset-password' }) {
  const params = new URLSearchParams(useLocation().search);
  const uid = params.get('uid') ?? '';
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState('idle'); // idle | busy | done
  const [error, setError] = useState('');
  const L = LinkComponent;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('The two passwords don’t match.');
      return;
    }
    setStatus('busy');
    try {
      await confirmPasswordReset({ uid, token, password });
      setStatus('done');
    } catch (err) {
      setError(err.message || "Couldn't reach the server. Try again.");
      setStatus('idle');
    }
  };

  return (
    <div className="pc-dash pc-reset">
      <NavBar user={user} activePath={activePath} LinkComponent={LinkComponent} />
      <main className="pc-reset-main">
        <section className="pc-reset-card" aria-labelledby="reset-title">
          <h1 id="reset-title">Set a new password</h1>
          {!uid || !token ? (
            <p className="hm-error" role="alert">
              This link is incomplete. Open the link from your email again, or ask for a new one from the login
              window.
            </p>
          ) : status === 'done' ? (
            <>
              <p className="hm-success" role="status">
                Your password has been changed. Log in with the new one.
              </p>
              <L className="hm-btn-main pc-reset-cta" href="/" to="/" state={{ auth: 'login' }}>
                Go to log in
              </L>
            </>
          ) : (
            <form className="hm-form" onSubmit={submit}>
              <label className="hm-label" htmlFor="reset-new">
                New password
                <input
                  id="reset-new"
                  className="hm-input"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </label>
              <label className="hm-label" htmlFor="reset-confirm">
                Repeat it
                <input
                  id="reset-confirm"
                  className="hm-input"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </label>
              {error && (
                <p className="hm-error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="hm-btn-main" disabled={status === 'busy'}>
                {status === 'busy' ? 'Saving…' : 'Save new password'}
              </button>
            </form>
          )}
        </section>
      </main>
      <SiteFooter LinkComponent={LinkComponent} activePath={activePath} />
    </div>
  );
}
