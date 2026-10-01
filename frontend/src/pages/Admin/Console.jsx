import { useCallback, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { USE_MOCK } from '../../api/mode';
import { HeartMark } from '../../components/NavBar';
import { ToastProvider } from './ui';
import Overview from './sections/Overview';
import Users from './sections/Users';
import Assessments from './sections/Assessments';
import Model from './sections/Model';
import Activity from './sections/Activity';
import System from './sections/System';
import Maintenance from './sections/Maintenance';
import SiteControls from './sections/SiteControls';
import './console.css';

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: 'M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 4v4h6V4z' },
  { id: 'users', label: 'Users', icon: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 19v-1a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8' },
  { id: 'assessments', label: 'Assessments', icon: 'M3 12h4l2-6 4 12 2-6h6' },
  { id: 'model', label: 'Model', icon: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12 4 7.5' },
  { id: 'activity', label: 'Activity log', icon: 'M4 6h16M4 12h16M4 18h10' },
  { id: 'system', label: 'System health', icon: 'M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10Z' },
  { id: 'maintenance', label: 'Maintenance', icon: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z' },
  { id: 'site', label: 'Site controls', icon: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6' },
];

/**
 * Cardio Sense admin console (/console/<section>). Staff only: the backend
 * checks every call (predictor/admin_api.py); this only decides what to show.
 */
export default function Console() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const section = pathname.split('/')[2] || 'overview';
  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];
  const [openRef, setOpenRef] = useState(null); // an assessment to open (from a user's drawer)
  const [menuOpen, setMenuOpen] = useState(false);

  const go = useCallback(
    (id) => {
      setMenuOpen(false);
      navigate(`/console/${id}`);
    },
    [navigate],
  );
  const clearOpenRef = useCallback(() => setOpenRef(null), []);

  if (user === undefined) return null;
  if (!user) return <Navigate to="/" replace state={{ from: { pathname } }} />;
  if (!user.is_staff) {
    return (
      <div className="ad-denied">
        <h1>Staff only</h1>
        <p>The admin console is for Cardio Sense staff. Ask an administrator for access.</p>
        <Link to="/dashboard" className="ad-btn is-primary">
          Back to the app
        </Link>
      </div>
    );
  }

  let body;
  switch (current.id) {
    case 'users':
      body = <Users openAssessment={(ref) => { setOpenRef(ref); go('assessments'); }} />;
      break;
    case 'assessments':
      body = <Assessments initialRef={openRef} onOpened={clearOpenRef} />;
      break;
    case 'model':
      body = <Model />;
      break;
    case 'activity':
      body = <Activity />;
      break;
    case 'system':
      body = <System />;
      break;
    case 'maintenance':
      body = <Maintenance />;
      break;
    case 'site':
      body = <SiteControls />;
      break;
    default:
      body = <Overview go={go} />;
  }

  return (
    <ToastProvider>
      <div className="ad-shell">
        <aside className={`ad-side${menuOpen ? ' is-open' : ''}`}>
          <div className="ad-brand">
            <HeartMark className="ad-brand-mark" />
            <div>
              <strong>Cardio Sense</strong>
              <span>Admin console</span>
            </div>
          </div>
          <nav aria-label="Admin sections">
            <ul>
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <button type="button" className={`ad-nav-item${s.id === current.id ? ' is-active' : ''}`} aria-current={s.id === current.id ? 'page' : undefined} onClick={() => go(s.id)}>
                    <Icon d={s.icon} />
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ad-side-foot">
            <Link to="/dashboard" className="ad-nav-item">
              <Icon d="M15 18l-6-6 6-6" />
              Back to the app
            </Link>
          </div>
        </aside>

        <div className="ad-main">
          <header className="ad-top">
            <button type="button" className="ad-icon-btn ad-menu-btn" aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
              ☰
            </button>
            <span className="ad-crumb">
              Admin <span aria-hidden="true">/</span> <strong>{current.label}</strong>
            </span>
            <div className="ad-top-user">
              <span className="ad-avatar" aria-hidden="true">
                {(user.name || user.email).slice(0, 1).toUpperCase()}
              </span>
              <div>
                <strong>{user.name}</strong>
                <span>{user.is_superuser ? 'Superuser' : 'Staff'}</span>
              </div>
              <button type="button" className="ad-btn is-small" onClick={() => logout().then(() => navigate('/'))}>
                Log out
              </button>
            </div>
          </header>
          {USE_MOCK && <div className="ad-callout is-warn">The console needs the Cardio Sense server: it doesn’t work in demo mode.</div>}
          <main className="ad-content" key={current.id}>
            {body}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
