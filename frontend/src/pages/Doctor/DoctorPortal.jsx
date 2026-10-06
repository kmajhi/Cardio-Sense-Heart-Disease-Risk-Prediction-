import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { USE_MOCK } from '../../api/mode';
import { doctorApi, notificationsApi } from '../../api/doctorApi';
import { HeartMark } from '../../components/NavBar';
import RolePicker from '../../components/RolePicker';
import { Avatar, Icon, PasswordInput, ThemeProvider, ThemeToggle, ToastProvider } from './ui';
import { drName, fmtDateTime } from './format';
import Dashboard from './pages/Dashboard';
import Requests from './pages/Requests';
import MyReviews from './pages/MyReviews';
import Workspace from './pages/Workspace';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import Security, { PasswordForm } from './pages/Security';
import './doctor.css';

const NAV = [
  { to: '/doctor', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/doctor/requests', label: 'Review Requests', icon: 'inbox', count: 'awaiting' },
  { to: '/doctor/active', label: 'My Reviews', icon: 'clipboard', count: 'active' },
  { to: '/doctor/completed', label: 'Completed', icon: 'checkCircle' },
  { to: '/doctor/notifications', label: 'Notifications', icon: 'bell', count: 'unread' },
];
const NAV_ACCOUNT = [
  { to: '/doctor/profile', label: 'Profile', icon: 'user' },
  { to: '/doctor/security', label: 'Security', icon: 'lock' },
];

/** The signed-in doctor (GET /api/doctor/me/), refreshed on demand. */
function useDoctor() {
  const [me, setMe] = useState(undefined);
  const load = useCallback(() => doctorApi.me().then(setMe).catch(() => setMe(null)), []);
  useEffect(() => {
    load();
  }, [load]);
  return [me, load, setMe];
}

// ---------------------------------------------------------------- sign in


function Login({ onSignedIn }) {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  // Patients (and admins) sign in on the main site's login window.
  const chooseRole = (role) => {
    if (role === 'patient') navigate('/', { state: { auth: 'login' } });
  };
  const ids = { who: useId(), pass: useId(), err: useId() };
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await doctorApi.login(identifier.trim(), password);
      await refresh();
      onSignedIn();
    } catch (err) {
      setError(err.status === 400 ? err.message : 'We couldn’t sign you in. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div className="dr-root dr-login">
      <main className="dr-card dr-login-card">
        <div className="dr-login-brand">
          <HeartMark />
          <strong style={{ color: 'var(--dr-navy)', fontWeight: 600 }}>Cardio Sense</strong>
          <ThemeToggle className="dr-login-theme" />
        </div>
        <RolePicker role="doctor" onRole={chooseRole} />
        <h1 style={{ marginTop: 20 }}>Doctor Portal</h1>
        <p className="dr-sub">Clinical Review Workspace</p>
        <form onSubmit={submit} noValidate>
          <div className="dr-field">
            <label className="dr-label" htmlFor={ids.who}>
              Doctor ID or email
            </label>
            <input
              id={ids.who}
              className="dr-input"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
              placeholder="DR-0001 or name@hospital.org"
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? ids.err : undefined}
              required
            />
          </div>
          <div className="dr-field">
            <label className="dr-label" htmlFor={ids.pass}>
              Password
            </label>
            <PasswordInput id={ids.pass} value={password} onChange={setPassword} autoComplete="current-password" invalid={Boolean(error)} describedBy={error ? ids.err : undefined} />
          </div>
          {error && (
            <p id={ids.err} className="dr-field-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="dr-btn is-primary" disabled={busy || !identifier.trim() || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <Link className="dr-link" to="/reset-password" style={{ fontSize: 13 }}>
            Forgot your password?
          </Link>
        </form>
        <p className="dr-login-foot">
          <Icon name="shield" size={15} />
          Secure access for verified clinical reviewers
        </p>
      </main>
    </div>
  );
}

function NotDoctor() {
  return (
    <div className="dr-root dr-login">
      <main className="dr-card dr-login-card">
        <h1>Doctor accounts only</h1>
        <p className="dr-sub" style={{ marginTop: 8 }}>
          The Doctor Portal is for clinical reviewers whose accounts were created by a Cardio Sense administrator. You’re signed in with a
          patient account.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
          <Link to="/dashboard" className="dr-btn is-primary">
            Back to Cardio Sense
          </Link>
        </div>
      </main>
    </div>
  );
}

function FirstPassword({ me, onDone, onLogout }) {
  return (
    <div className="dr-root dr-login">
      <main className="dr-card dr-login-card">
        <h1>Choose your password</h1>
        <p className="dr-sub" style={{ marginTop: 8 }}>
          Welcome, {drName(me.name)}. Your account was set up with a temporary password. Choose your own before entering the Doctor Panel.
        </p>
        <PasswordForm onDone={onDone} submitLabel="Set password and continue" />
        <button type="button" className="dr-btn is-ghost is-sm" style={{ marginTop: 12 }} onClick={onLogout}>
          Sign out
        </button>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------- shell

function NotificationsBell({ unread, onOpened }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const wrap = useRef(null);
  const navigate = useNavigate();
  useEffect(() => {
    if (!open) return undefined;
    notificationsApi
      .list()
      .then((d) => setItems(d.results.slice(0, 8)))
      .catch(() => setItems([]));
    const onDoc = (e) => !wrap.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const markAll = () => notificationsApi.markRead().then(() => {
    setItems((list) => list?.map((n) => ({ ...n, read: true })));
    onOpened();
  });
  return (
    <div className="dr-pop-wrap" ref={wrap}>
      <button type="button" className="dr-icon-btn" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Icon name="bell" />
        {unread > 0 && <span className="dr-dot-count">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="dr-pop" role="dialog" aria-label="Notifications">
          <div className="dr-pop-head">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button type="button" className="dr-btn is-ghost is-sm" onClick={markAll}>
                Mark all read
              </button>
            )}
          </div>
          {items === null ? (
            <div className="dr-skel-rows">
              <span className="dr-skel" />
              <span className="dr-skel" />
            </div>
          ) : items.length === 0 ? (
            <p className="dr-muted" style={{ padding: 16, margin: 0 }}>
              No notifications yet.
            </p>
          ) : (
            <ul className="dr-note-list">
              {items.map((n) => (
                <li key={n.id} className={`dr-note${n.read ? '' : ' is-unread'}`}>
                  <span className="dr-note-dot" aria-hidden="true" />
                  <div>
                    <strong>{n.title}</strong>
                    {n.body && <p>{n.body}</p>}
                    <time dateTime={n.created_at}>{fmtDateTime(n.created_at)}</time>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="dr-pop-head" style={{ borderTop: '1px solid var(--dr-line-2)', borderBottom: 0 }}>
            <button
              type="button"
              className="dr-btn is-ghost is-sm"
              onClick={() => {
                setOpen(false);
                navigate('/doctor/notifications');
              }}
            >
              View all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Shell({ me, reloadMe, onLogout }) {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [counts, setCounts] = useState({});
  const refreshCounts = useCallback(() => {
    Promise.all([
      me.verified && me.is_active ? doctorApi.overview().then((o) => o.counts) : Promise.resolve({}),
      notificationsApi.list().then((n) => n.unread),
    ])
      .then(([c, unread]) => setCounts({ ...c, unread }))
      .catch(() => {});
  }, [me.verified, me.is_active]);

  useEffect(() => {
    setMenuOpen(false);
    refreshCounts();
  }, [pathname, refreshCounts]);
  // New requests arrive while the panel is open: check again every minute.
  useEffect(() => {
    const t = setInterval(refreshCounts, 60000);
    return () => clearInterval(t);
  }, [refreshCounts]);

  const title = [...NAV, ...NAV_ACCOUNT].find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)))?.label ?? (pathname.includes('/review/') ? 'Clinical Review' : 'Doctor Panel');
  useEffect(() => {
    document.title = `${title} · Cardio Sense Doctor`;
    return () => {
      document.title = 'Cardio Sense';
    };
  }, [title]);

  const link = (n) => (
    <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `dr-nav-item${isActive ? ' is-active' : ''}`}>
      <Icon name={n.icon} size={17} />
      <span>{n.label}</span>
      {n.count && counts[n.count] > 0 && <span className="dr-nav-count">{counts[n.count]}</span>}
    </NavLink>
  );

  const blocked = !me.is_active ? 'inactive' : !me.verified ? 'unverified' : '';
  const shared = { me, reloadMe, refreshCounts, blocked };

  return (
    <div className="dr-root">
      <a href="#dr-main" className="dr-skip">
        Skip to content
      </a>
      <div className="dr-shell">
        {menuOpen && <button type="button" className="dr-scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}
        <aside className={`dr-side${menuOpen ? ' is-open' : ''}`} aria-label="Doctor Panel">
          <div className="dr-brand">
            <HeartMark className="dr-brand-mark" />
            <div>
              <strong>Cardio Sense</strong>
              <span>Clinical Review Workspace</span>
            </div>
          </div>
          <nav className="dr-nav" aria-label="Doctor sections">
            {NAV.map(link)}
            <div className="dr-nav-sep" role="separator" />
            {NAV_ACCOUNT.map(link)}
            <button type="button" className="dr-nav-item" onClick={onLogout}>
              <Icon name="logout" size={17} />
              <span>Sign out</span>
            </button>
          </nav>
          <div className="dr-side-foot">
            <Avatar name={me.name} photo={me.photo} size={34} />
            <div style={{ minWidth: 0 }}>
              <strong>{drName(me.name)}</strong>
              {me.verified ? (
                <span className="dr-verified">✓ Verified · {me.doctor_id}</span>
              ) : (
                <span>Not yet verified · {me.doctor_id}</span>
              )}
            </div>
          </div>
        </aside>

        <div className="dr-main">
          <header className="dr-top">
            <button type="button" className="dr-icon-btn dr-menu-btn" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
              <Icon name="menu" />
            </button>
            <span className="dr-top-title">{title}</span>
            <div className="dr-top-actions">
              <ThemeToggle />
              <NotificationsBell unread={counts.unread ?? 0} onOpened={refreshCounts} />
              <Link to="/doctor/profile" className="dr-icon-btn" aria-label="Your profile" style={{ width: 'auto', padding: '0 4px' }}>
                <Avatar name={me.name} photo={me.photo} size={30} />
              </Link>
            </div>
          </header>
          {USE_MOCK && (
            <div className="dr-content" style={{ paddingBottom: 0 }}>
              <div className="dr-callout is-warn">
                <Icon name="alert" />
                <p>The Doctor Panel needs the Cardio Sense server: it doesn’t work in demo mode.</p>
              </div>
            </div>
          )}
          <main id="dr-main" className="dr-content" tabIndex={-1}>
            {blocked && (
              <div className={`dr-callout ${blocked === 'inactive' ? 'is-alert' : 'is-info'}`} style={{ marginBottom: 24 }} role="status">
                <Icon name={blocked === 'inactive' ? 'alert' : 'info'} />
                <p>
                  {blocked === 'inactive'
                    ? 'This doctor account is inactive. You can’t see patient assessments or accept reviews. Contact a Cardio Sense administrator.'
                    : 'Your account is waiting for verification by a Cardio Sense administrator. Patient assessments appear here once your registration has been checked.'}
                </p>
              </div>
            )}
            <Routes>
              <Route index element={<Dashboard {...shared} />} />
              <Route path="requests" element={<Requests {...shared} />} />
              <Route path="active" element={<MyReviews {...shared} scope="active" />} />
              <Route path="completed" element={<MyReviews {...shared} scope="completed" />} />
              <Route path="review/:id" element={<Workspace {...shared} />} />
              <Route path="notifications" element={<Notifications onChange={refreshCounts} />} />
              <Route path="profile" element={<Profile {...shared} />} />
              <Route path="security" element={<Security />} />
              <Route path="*" element={<Navigate to="/doctor" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}

/**
 * Cardio Sense Doctor Panel (/doctor/*): the clinical review workspace.
 * The backend decides every permission (predictor/doctor_api.py); this only
 * chooses which screen to show.
 */
export default function DoctorPortal() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isDoctor = Boolean(user?.doctor);
  const [me, reloadMe, setMe] = useDoctor();

  useEffect(() => {
    if (isDoctor) reloadMe();
    else setMe(null);
  }, [isDoctor, reloadMe, setMe]);

  const signOut = () => logout().then(() => navigate('/doctor'));

  return (
    <ThemeProvider>
      <ToastProvider>
        {user === undefined || (isDoctor && me === undefined) ? null : !user ? (
          <Login onSignedIn={reloadMe} />
        ) : !isDoctor ? (
          <NotDoctor />
        ) : !me ? (
          <div className="dr-root dr-login">
            <main className="dr-card dr-login-card">
              <h1>Couldn’t load your account</h1>
              <p className="dr-sub">Check your connection and try again.</p>
              <button type="button" className="dr-btn is-primary" style={{ marginTop: 16 }} onClick={reloadMe}>
                Try again
              </button>
            </main>
          </div>
        ) : me.must_change_password ? (
          <FirstPassword me={me} onDone={setMe} onLogout={signOut} />
        ) : (
          <Shell me={me} reloadMe={reloadMe} onLogout={signOut} />
        )}
      </ToastProvider>
    </ThemeProvider>
  );
}
