import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { USE_MOCK } from '../../api/mode';
import { admin, download } from '../../api/adminApi';
import { HeartMark } from '../../components/NavBar';
import ThemeSwitch from '../../components/ThemeSwitch';
import { Avatar, Icon, Kbd, ToastProvider, useStoredState, useToast } from './ui';
import CommandPalette, { ShortcutsDialog } from './CommandPalette';
import Inbox, { useNotifications } from './Inbox';
import Overview from './sections/Overview';
import Users from './sections/Users';
import Assessments from './sections/Assessments';
import Model from './sections/Model';
import Activity from './sections/Activity';
import Security from './sections/Security';
import System from './sections/System';
import Maintenance from './sections/Maintenance';
import SiteControls from './sections/SiteControls';
import Doctors from './sections/Doctors';
import Reviews from './sections/Reviews';
import './console.css';

// `keys` are the "g then letter" shortcuts.
const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: 'overview', group: 'Insights', keys: ['G', 'O'] },
  { id: 'activity', label: 'Activity log', icon: 'activity', group: 'Insights', keys: ['G', 'L'] },
  { id: 'users', label: 'Users', icon: 'users', group: 'Manage', keys: ['G', 'U'] },
  { id: 'assessments', label: 'Assessments', icon: 'assessments', group: 'Manage', keys: ['G', 'A'] },
  { id: 'doctors', label: 'Doctors', icon: 'doctor', group: 'Clinical', keys: ['G', 'D'] },
  { id: 'reviews', label: 'Review requests', icon: 'reviews', group: 'Clinical', keys: ['G', 'R'] },
  { id: 'security', label: 'Security', icon: 'security', group: 'Platform', keys: ['G', 'S'] },
  { id: 'model', label: 'Model', icon: 'model', group: 'Platform', keys: ['G', 'M'] },
  { id: 'system', label: 'System health', icon: 'system', group: 'Platform', keys: ['G', 'H'] },
  { id: 'site', label: 'Site controls', icon: 'site', group: 'Settings', keys: ['G', 'C'] },
  { id: 'maintenance', label: 'Maintenance', icon: 'maintenance', group: 'Settings', keys: ['G', 'X'] },
];
const GROUPS = ['Insights', 'Manage', 'Clinical', 'Platform', 'Settings'];
const ENV = typeof window !== 'undefined' && /^(localhost|127\.|\[::1\])/.test(window.location.hostname) ? 'Local' : 'Production';
const THEMES = [
  ['light', 'Light', 'sun'],
  ['dark', 'Dark', 'moon'],
  ['system', 'System', 'monitor'],
];

/** 'light' | 'dark' for the stored choice, following the OS when it's 'system'. */
function useResolvedTheme(choice) {
  const query = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const [osDark, setOsDark] = useState(Boolean(query?.matches));
  useEffect(() => {
    if (!query) return undefined;
    const on = (e) => setOsDark(e.matches);
    query.addEventListener('change', on);
    return () => query.removeEventListener('change', on);
  }, [query]);
  return choice === 'system' ? (osDark ? 'dark' : 'light') : choice;
}

const typing = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

function UserMenu({ user, theme, setTheme, onShortcuts, onLogout, collapsed }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="cx-pop-wrap cx-me" ref={ref}>
      <button type="button" className="cx-me-btn" aria-expanded={open} aria-label="Account menu" onClick={() => setOpen((v) => !v)} title={collapsed ? user.name : undefined}>
        <Avatar name={user.name} email={user.email} size={30} />
        <span className="cx-me-text">
          <strong>{user.name}</strong>
          <span>{user.is_superuser ? 'Superuser' : 'Staff'}</span>
        </span>
        <span className="cx-me-chev" aria-hidden="true">⋯</span>
      </button>
      {open && (
        <div className="cx-pop cx-menu" role="menu">
          <div className="cx-menu-who">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <div className="cx-menu-label">Theme</div>
          <div className="cx-theme-pick" role="radiogroup" aria-label="Theme">
            {THEMES.map(([v, l, icon]) => (
              <button key={v} type="button" role="radio" aria-checked={theme === v} className={theme === v ? 'is-on' : undefined} onClick={() => setTheme(v)}>
                <Icon name={icon} size={15} />
                {l}
              </button>
            ))}
          </div>
          <button type="button" role="menuitem" className="cx-menu-item" onClick={() => { setOpen(false); onShortcuts(); }}>
            <Icon name="keyboard" size={16} /> Keyboard shortcuts <Kbd>?</Kbd>
          </button>
          <Link role="menuitem" className="cx-menu-item" to="/dashboard">
            <Icon name="back" size={16} /> Back to the app
          </Link>
          <button type="button" role="menuitem" className="cx-menu-item is-danger" onClick={onLogout}>
            <Icon name="logout" size={16} /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

function Shell({ user, logout }) {
  const notify = useToast();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const section = pathname.split('/')[2] || 'overview';
  const current = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];
  const [openRef, setOpenRef] = useState(null); // an assessment to open
  const [openUser, setOpenUser] = useState(null); // a user to open
  const [menuOpen, setMenuOpen] = useState(false); // phone drawer
  const [collapsed, setCollapsed] = useStoredState('cardio-admin:sidebar-collapsed', false);
  const [themeChoice, setThemeChoice] = useStoredState('cardio-admin:theme', 'system');
  const theme = useResolvedTheme(themeChoice);
  const [palette, setPalette] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const notes = useNotifications();
  const securityAlerts = notes.items.filter((n) => n.section === 'security' && !notes.read.has(n.id)).length;

  const go = useCallback(
    (id) => {
      setMenuOpen(false);
      navigate(`/console/${id}`);
    },
    [navigate],
  );
  const clearOpenRef = useCallback(() => setOpenRef(null), []);
  const clearOpenUser = useCallback(() => setOpenUser(null), []);
  const openAssessment = useCallback((ref) => { setOpenRef(ref); go('assessments'); }, [go]);
  const openUserById = useCallback((id) => { setOpenUser(id); go('users'); }, [go]);
  const toggleTheme = useCallback(() => setThemeChoice(theme === 'dark' ? 'light' : 'dark'), [theme, setThemeChoice]);

  const actions = useMemo(
    () => [
      { id: 'theme', label: `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`, icon: theme === 'dark' ? 'sun' : 'moon', words: 'dark light mode appearance', keys: ['Shift', 'D'], run: toggleTheme },
      { id: 'sidebar', label: collapsed ? 'Expand the sidebar' : 'Collapse the sidebar', icon: collapsed ? 'expand' : 'collapse', keys: ['['], run: () => setCollapsed((v) => !v) },
      { id: 'check', label: 'Run the model health check', icon: 'model', words: 'test samples', run: () => admin.checkModel().then((r) => notify(r.ok ? 'Model check passed: every sample is in its band.' : 'Model check found samples out of band.', r.ok ? 'ok' : 'error')).catch((e) => notify(e.message, 'error')) },
      { id: 'users-csv', label: 'Export all users as CSV', icon: 'download', words: 'download', run: () => download('/admin/users/export/', {}, 'users.csv').catch((e) => notify(e.message, 'error')) },
      { id: 'assess-csv', label: 'Export all assessments as CSV', icon: 'download', words: 'download', run: () => download('/admin/assessments/export/', {}, 'assessments.csv').catch((e) => notify(e.message, 'error')) },
      { id: 'backup', label: 'Download a full backup', icon: 'download', words: 'json export', run: () => download('/admin/backup/', {}, 'cardio-sense-backup.json').then(() => notify('Backup downloaded.')).catch((e) => notify(e.message, 'error')) },
      { id: 'keys', label: 'Keyboard shortcuts', icon: 'keyboard', words: 'help hotkeys', keys: ['?'], run: () => setShortcuts(true) },
      { id: 'app', label: 'Back to the app', icon: 'back', run: () => navigate('/dashboard') },
    ],
    [theme, collapsed, toggleTheme, setCollapsed, notify, navigate],
  );

  // Global shortcuts: Ctrl/⌘K, /, ?, [, Shift+D, and "g then letter".
  useEffect(() => {
    let leader = 0;
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((v) => !v);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || document.querySelector('[aria-modal="true"]')) return;
      if (e.key === '/') {
        e.preventDefault();
        setPalette(true);
      } else if (e.key === '?') {
        setShortcuts(true);
      } else if (e.key === '[') {
        setCollapsed((v) => !v);
      } else if (e.key === 'D' && e.shiftKey) {
        toggleTheme();
      } else if (e.key.toLowerCase() === 'g') {
        leader = Date.now();
      } else if (Date.now() - leader < 1200) {
        const target = SECTIONS.find((s) => s.keys[1].toLowerCase() === e.key.toLowerCase());
        if (target) go(target.id);
        leader = 0;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, setCollapsed, toggleTheme]);

  useEffect(() => {
    document.title = `${current.label} · Cardio Sense Admin`;
    return () => {
      document.title = 'Cardio Sense';
    };
  }, [current.label]);

  let body;
  switch (current.id) {
    case 'users':
      body = <Users openAssessment={openAssessment} initialUser={openUser} onOpened={clearOpenUser} />;
      break;
    case 'assessments':
      body = <Assessments initialRef={openRef} onOpened={clearOpenRef} openUser={openUserById} />;
      break;
    case 'doctors':
      body = <Doctors />;
      break;
    case 'reviews':
      body = <Reviews />;
      break;
    case 'model':
      body = <Model />;
      break;
    case 'activity':
      body = <Activity openUser={openUserById} />;
      break;
    case 'security':
      body = <Security openUser={openUserById} />;
      break;
    case 'system':
      body = <System />;
      break;
    case 'maintenance':
      body = <Maintenance />;
      break;
    case 'site':
      body = <SiteControls onSaved={notes.reload} />;
      break;
    default:
      body = <Overview go={go} openUser={openUserById} />;
  }

  const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
  return (
    <div className={`cx-shell${collapsed ? ' is-collapsed' : ''}`} data-theme={theme}>
      <a href="#cx-main" className="cx-skip">Skip to content</a>
      {menuOpen && <button type="button" className="cx-side-scrim" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}
      <aside className={`cx-side${menuOpen ? ' is-open' : ''}`}>
        <div className="cx-brand">
          <span className="cx-brand-logo">
            <HeartMark className="cx-brand-mark" />
          </span>
          <div className="cx-brand-text">
            <strong>Cardio Sense</strong>
            <span>
              Admin <span className={`cx-env is-${ENV.toLowerCase()}`}>{ENV}</span>
            </span>
          </div>
        </div>

        <button type="button" className="cx-side-search" onClick={() => setPalette(true)} title={collapsed ? `Search (${mod} K)` : undefined}>
          <Icon name="search" size={16} />
          <span>Search…</span>
          <span className="cx-side-search-keys">
            <Kbd>{mod}</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>

        <nav aria-label="Admin sections" className="cx-side-nav">
          {GROUPS.map((g) => (
            <div key={g} className="cx-nav-group">
              <p className="cx-nav-title">{g}</p>
              <ul>
                {SECTIONS.filter((s) => s.group === g).map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={`cx-nav-item${s.id === current.id ? ' is-active' : ''}`}
                      aria-current={s.id === current.id ? 'page' : undefined}
                      onClick={() => go(s.id)}
                      title={collapsed ? s.label : undefined}
                    >
                      <Icon name={s.icon} size={17} />
                      <span className="cx-nav-label">{s.label}</span>
                      {s.id === 'security' && securityAlerts > 0 && <span className="cx-nav-badge is-danger">{securityAlerts}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="cx-side-foot">
          <button type="button" className="cx-nav-item cx-collapse-btn" onClick={() => setCollapsed((v) => !v)} title={collapsed ? 'Expand sidebar ([)' : 'Collapse sidebar ([)'}>
            <Icon name={collapsed ? 'expand' : 'collapse'} size={17} />
            <span className="cx-nav-label">Collapse</span>
          </button>
          <UserMenu user={user} theme={themeChoice} setTheme={setThemeChoice} collapsed={collapsed} onShortcuts={() => setShortcuts(true)} onLogout={() => logout().then(() => navigate('/'))} />
        </div>
      </aside>

      <div className="cx-main">
        <header className="cx-top">
          <button type="button" className="cx-icon-btn cx-menu-btn" aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
            <Icon name="menu" size={18} />
          </button>
          <nav className="cx-crumb" aria-label="Breadcrumb">
            <span>{current.group}</span>
            <span aria-hidden="true" className="cx-crumb-sep">/</span>
            <strong>{current.label}</strong>
          </nav>
          <div className="cx-top-actions">
            <button type="button" className="cx-top-search" onClick={() => setPalette(true)}>
              <Icon name="search" size={15} />
              <span>Search or jump to…</span>
              <Kbd>{mod} K</Kbd>
            </button>
            <ThemeSwitch dark={theme === 'dark'} onToggle={toggleTheme} />
            <Inbox notes={notes} onGo={go} />
            <button type="button" className="cx-icon-btn" aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)" onClick={() => setShortcuts(true)}>
              <Icon name="keyboard" size={18} />
            </button>
          </div>
        </header>
        {USE_MOCK && <div className="cx-callout is-warn cx-mock-note">The console needs the Cardio Sense server: it doesn’t work in demo mode.</div>}
        <main className="cx-content" id="cx-main" key={current.id} tabIndex={-1}>
          {body}
        </main>
      </div>

      <CommandPalette open={palette} onClose={() => setPalette(false)} sections={SECTIONS} actions={actions} onSection={go} onUser={openUserById} onAssessment={openAssessment} />
      <ShortcutsDialog open={shortcuts} onClose={() => setShortcuts(false)} sections={SECTIONS} />
    </div>
  );
}

/**
 * Cardio Sense admin console (/console/<section>). Staff only: the backend
 * checks every call (predictor/admin_api.py); this only decides what to show.
 */
export default function Console() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  if (user === undefined) return null;
  if (!user) return <Navigate to="/" replace state={{ from: { pathname } }} />;
  if (!user.is_staff) {
    return (
      <div className="cx-denied">
        <h1>Staff only</h1>
        <p>The admin console is for Cardio Sense staff. Ask an administrator for access.</p>
        <Link to="/dashboard" className="cx-btn is-primary">
          Back to the app
        </Link>
      </div>
    );
  }
  return (
    <ToastProvider>
      <Shell user={user} logout={logout} />
    </ToastProvider>
  );
}
