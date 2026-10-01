import { useEffect, useId, useRef, useState } from 'react';
import { SIGN_IN_PROVIDERS, requestPasswordReset, signInWith } from '../../api/authApi';
import { getProviders } from '../../api/connectApi';
import loginHeart from '../../assets/login-heart.webp';

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

const XIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" />
  </svg>
);

const PROVIDER_ICONS = { gmail: <GoogleIcon />, x: <XIcon /> };

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

const HEADS = {
  login: { title: 'Welcome back', sub: 'Log in to track your heart health and predictions.' },
  register: { title: 'Create your account', sub: 'Start tracking your heart health with AI insights.' },
};

/**
 * The Log in / Register dialog. It never changes size or moves when switching
 * tabs: both headings and both forms are always laid out, stacked in the same
 * grid cell, and only the active one is shown. The dialog is pinned from the
 * top, so an error message can only extend it downwards.
 *
 * With a `gate` (the visitor asked for something that needs an account) it
 * leads with a lock and says what signing in unlocks.
 *
 * Keyboard focus stays inside while it's open (Tab wraps around) and goes back
 * to whatever had it when it closes. "Forgot password?" swaps the login form
 * for a reset request in the same place.
 *
 * "Continue with Google / X" runs the provider's own sign-in on the server
 * (backend/predictor/social_login.py); only providers the server has keys for
 * are shown. `initialError` is a message from a sign-in that came back refused.
 */
export default function AuthModal({ mode, gate, onMode, onClose, login, register, onSignedIn, initialError = '' }) {
  const uid = useId();
  const dialogRef = useRef(null);
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(null); // the mode being submitted
  const [providers, setProviders] = useState({}); // { gmail: true, x: false } from the server
  const [offline, setOffline] = useState(false); // the API couldn't be reached

  useEffect(() => {
    let alive = true;
    getProviders()
      .then((p) => alive && setProviders(p ?? {}))
      .catch(() => alive && setOffline(true)); // say so, rather than silently hiding Google / X
    return () => {
      alive = false;
    };
  }, []);

  const social = SIGN_IN_PROVIDERS.filter((p) => providers[p.id]);
  const continueWith = (id) => {
    setBusy(id);
    signInWith(id);
  };
  const [forgot, setForgot] = useState(false); // login form shows the reset request instead
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab' || !dialogRef.current) return;
      // Trap focus: only the visible, enabled controls of the dialog take part.
      const items = [...dialogRef.current.querySelectorAll(FOCUSABLE)].filter(
        (el) => !el.closest('[inert]') && el.offsetParent !== null,
      );
      if (!items.length) return;
      const first = items[0];
      const last = items.at(-1);
      if (e.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Give focus back to whatever opened the dialog.
  useEffect(() => {
    const opener = document.activeElement;
    return () => opener?.focus?.({ preventScroll: true });
  }, []);

  // Focus the first field once, when the dialog opens.
  useEffect(() => {
    dialogRef.current?.querySelector(`[data-mode="${mode}"] input`)?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `moveFocus`: the control that was clicked is in the form being hidden,
  // so keyboard focus goes to the newly selected tab.
  const switchTo = (next, moveFocus = false) => {
    setError('');
    setForgot(false);
    setResetSent(false);
    onMode(next);
    if (moveFocus) requestAnimationFrame(() => dialogRef.current?.querySelector(`[data-tab="${next}"]`)?.focus());
  };

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const submit = (how) => async (e) => {
    e.preventDefault();
    setBusy(how);
    setError('');
    try {
      if (how === 'login') await login({ email: values.email.trim(), password: values.password });
      else await register({ name: values.name.trim(), email: values.email.trim(), password: values.password });
      onSignedIn(how);
    } catch (err) {
      setBusy(null);
      setError(err.message || "Couldn't reach the server. Try again.");
    }
  };

  const sendReset = async (e) => {
    e.preventDefault();
    setBusy('reset');
    setError('');
    try {
      await requestPasswordReset(values.email.trim());
      setResetSent(true);
    } catch (err) {
      setError(err.message || "Couldn't reach the server. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const showForgot = (on) => {
    setError('');
    setResetSent(false);
    setForgot(on);
    requestAnimationFrame(() => dialogRef.current?.querySelector('[data-mode="login"] input')?.focus());
  };

  const resetForm = () => (
    <form key="reset" data-mode="login" className="hm-form is-active" onSubmit={sendReset}>
      <p className="hm-reset-note">
        Enter your account’s email and we’ll send a link to set a new password.
      </p>
      {field('login', 'email', 'Email', { type: 'email', autoComplete: 'email', placeholder: 'you@example.com' })}
      {error && (
        <p className="hm-error" role="alert">
          {error}
        </p>
      )}
      {resetSent && (
        <p className="hm-success" role="status">
          If that email has an account, a reset link is on its way. It works once and expires in 2 hours.
        </p>
      )}
      <button type="submit" className="hm-btn-main" disabled={busy !== null}>
        {busy === 'reset' ? 'Sending…' : resetSent ? 'Send again' : 'Send reset link'}
      </button>
      <div className="hm-form-foot">
        <p className="hm-switch">
          Remembered it?{' '}
          <button type="button" className="hm-linkish" onClick={() => showForgot(false)}>
            Back to log in
          </button>
        </p>
      </div>
    </form>
  );

  const field = (how, key, label, props) => (
    <label className="hm-label" htmlFor={`${uid}-${how}-${key}`}>
      {label}
      <input
        id={`${uid}-${how}-${key}`}
        className="hm-input"
        required
        value={values[key]}
        onChange={set(key)}
        {...props}
      />
    </label>
  );

  const form = (how) => {
    const active = mode === how;
    const isLogin = how === 'login';
    if (isLogin && forgot && active) return resetForm();
    return (
      <form
        key={how}
        data-mode={how}
        className={`hm-form${active ? ' is-active' : ''}`}
        onSubmit={submit(how)}
        aria-hidden={!active}
        {...(active ? {} : { inert: '' })}
      >
        {!isLogin && field(how, 'name', 'Full name', { type: 'text', maxLength: 80, autoComplete: 'name', placeholder: 'Your name' })}
        {field(how, 'email', 'Email', { type: 'email', autoComplete: active ? 'email' : 'off', placeholder: 'you@example.com' })}
        {field(how, 'password', 'Password', {
          type: 'password',
          minLength: isLogin ? undefined : 8,
          autoComplete: active ? (isLogin ? 'current-password' : 'new-password') : 'off',
          placeholder: isLogin ? 'Your password' : 'At least 8 characters',
        })}

        {isLogin && (
          <button type="button" className="hm-linkish hm-forgot" onClick={() => showForgot(true)}>
            Forgot password?
          </button>
        )}

        {active && error && (
          <p className="hm-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="hm-btn-main" disabled={busy !== null}>
          {busy === how ? (isLogin ? 'Logging in…' : 'Creating account…') : isLogin ? 'Login' : 'Create Account'}
        </button>

        {/* Pinned to the bottom, so both forms end at the same place. */}
        <div className="hm-form-foot">
          {offline && (
            <p className="hm-error" role="status">
              Can’t reach the Cardio Sense server, so logging in won’t work yet (Google sign-in included). Make
              sure the backend is running, then reopen this window.
            </p>
          )}
          {social.length > 0 && (
            <>
              <div role="separator" aria-label="Or" className="hm-or">
                <span />
                Or
                <span />
              </div>
              <div className={`hm-social${social.length === 1 ? ' is-single' : ''}`}>
                {social.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`hm-btn-social is-${p.id}`}
                    onClick={() => continueWith(p.id)}
                    disabled={busy !== null}
                  >
                    {PROVIDER_ICONS[p.id]}
                    {busy === p.id ? `Opening ${p.name}…` : `${isLogin ? 'Continue' : 'Sign up'} with ${p.name}`}
                  </button>
                ))}
              </div>
            </>
          )}
          <p className="hm-switch">
            {isLogin ? 'New to Cardio Sense? ' : 'Already have an account? '}
            <button type="button" className="hm-linkish" onClick={() => switchTo(isLogin ? 'register' : 'login', true)}>
              {isLogin ? 'Create an account' : 'Log in'}
            </button>
          </p>
        </div>
      </form>
    );
  };

  const head = (key, title, sub, active) => (
    <div key={key} className={`hm-dlg-head${active ? ' is-active' : ''}`} aria-hidden={!active}>
      <h3 id={active ? `${uid}-title` : undefined}>{title}</h3>
      <p>{sub}</p>
    </div>
  );

  return (
    <div className="hm-modal">
      <button type="button" className="hm-scrim" aria-label="Close" tabIndex={-1} onClick={onClose} />
      {/* Decoration only: the glass-anatomy heart, faded into the backdrop on the left. */}
      <div className="hm-auth-art" aria-hidden="true" style={{ '--hm-auth-art': `url(${loginHeart})` }} />
      <div ref={dialogRef} className="hm-dialog" role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`}>
        <button type="button" className="hm-x" aria-label="Close" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M2 2 L12 12 M12 2 L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {gate ? (
          <div className="hm-dlg-head hm-dlg-head--gate is-active">
            <span className="hm-lock">
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="4.5" y="10.5" width="15" height="10" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <h3 id={`${uid}-title`}>{gate.title}</h3>
            <p>{gate.text}</p>
          </div>
        ) : (
          <div className="hm-stack">
            {head('login', HEADS.login.title, HEADS.login.sub, mode === 'login')}
            {head('register', HEADS.register.title, HEADS.register.sub, mode === 'register')}
          </div>
        )}

        <div role="tablist" aria-label="Account" className="hm-tabs" data-mode={mode}>
          <span className="hm-tabs-pill" aria-hidden="true" />
          <button type="button" role="tab" data-tab="login" aria-selected={mode === 'login'} className="hm-tab" onClick={() => switchTo('login')}>
            Log in
          </button>
          <button type="button" role="tab" data-tab="register" aria-selected={mode === 'register'} className="hm-tab" onClick={() => switchTo('register')}>
            Register
          </button>
        </div>

        <div className="hm-stack hm-forms">
          {form('login')}
          {form('register')}
        </div>
      </div>
    </div>
  );
}
