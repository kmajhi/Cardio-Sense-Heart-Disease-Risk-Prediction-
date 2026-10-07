// Building blocks shared by the Doctor Panel's pages.
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RISK } from '../../clinical/risk';
import { isPhoto } from '../Profile/photo';
import ThemeSwitch from '../../components/ThemeSwitch';
import { RISK_TONE, STATUS_TONE, compactTimeline, fmtDateTime, patientLine, riskLine } from './format';

const PATHS = {
  dashboard: 'M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 4v4h6V4z',
  inbox: 'M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6H3v-6z',
  clipboard: 'M9 4h6v3H9zM7 5.5H5.5V21h13V5.5H17M8.5 12h7M8.5 16h5',
  check: 'M5 12l5 5 9-10',
  checkCircle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8 12l3 3 5-6',
  bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  lock: 'M6 11h12v10H6zM8.5 11V7.5a3.5 3.5 0 0 1 7 0V11',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3',
  menu: 'M4 6h16M4 12h16M4 18h16',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-3.5-3.5',
  filter: 'M4 5h16M7 12h10M10 19h4',
  clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
  alert: 'M12 3 3 19h18L12 3ZM12 10v4M12 17h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  back: 'M15 18l-6-6 6-6',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  shield: 'M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6zM9 12l2 2 4-4',
  activity: 'M3 12h4l2-6 4 12 2-6h6',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z',
  monitor: 'M3 5h18v11H3zM8 20h8M12 16v4',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  pill: 'M10.5 20.5a5 5 0 0 1-7-7l6-6a5 5 0 0 1 7 7zM7 10l7 7',
};

export function Icon({ name, size = 18, className }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className={className}>
      <path d={PATHS[name]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The doctor's photo when they have one, otherwise their initials. */
export function Avatar({ name = '', size = 32, photo = '' }) {
  if (isPhoto(photo)) {
    return <img className="dr-avatar dr-avatar-img" src={photo} alt="" width={size} height={size} style={{ width: size, height: size }} />;
  }
  const initials = name
    .replace(/^dr\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  return (
    <span className="dr-avatar" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {initials || '·'}
    </span>
  );
}

/** A request's lifecycle status, always in words (colour only adds emphasis). */
export function StatusBadge({ status, label }) {
  return <span className={`dr-badge is-${STATUS_TONE[status] ?? 'muted'}`}>{label}</span>;
}

/** "52% · Moderate", toned by band; the band is written out too. */
export function RiskTag({ risk }) {
  if (!risk) return <span className="dr-muted">—</span>;
  return (
    <span className={`dr-badge is-plain is-${RISK_TONE[risk.level] ?? 'muted'}`} title={`Model-estimated risk: ${RISK[risk.level]?.label ?? ''}`}>
      <span className="dr-num">{riskLine(risk)}</span>
    </span>
  );
}

export function Findings({ items = [] }) {
  if (!items.length) return <span className="dr-muted">No values outside range</span>;
  return (
    <span className="dr-findings">
      {items.map((f) => (
        <span key={f.label} className="dr-chip">
          {f.label}
          {f.dir === 'high' ? ' ↑' : f.dir === 'low' ? ' ↓' : ''}
        </span>
      ))}
    </span>
  );
}

/** Shown when the model estimate is high or the app flagged a value for prompt attention. */
export function Attention({ row }) {
  if (!row || (row.risk?.level !== 'high' && !row.urgent)) return null;
  return (
    <span className="dr-attn">
      <Icon name="alert" size={13} />
      {row.urgent ? 'Value flagged for prompt attention' : 'Higher model-estimated risk'}
    </span>
  );
}

export function Empty({ icon = 'checkCircle', title, children, action }) {
  return (
    <div className="dr-empty">
      <span className="dr-empty-icon">
        <Icon name={icon} size={22} />
      </span>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ rows = 4 }) {
  return (
    <div className="dr-skel-rows" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ display: 'grid', gap: 8 }}>
          <span className="dr-skel" style={{ width: `${40 + ((i * 17) % 35)}%` }} />
          <span className="dr-skel" style={{ width: `${70 - ((i * 11) % 25)}%`, height: 10 }} />
        </div>
      ))}
    </div>
  );
}

export function MetricsSkeleton() {
  return (
    <div className="dr-metrics" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="dr-card dr-metric">
          <span className="dr-skel" style={{ width: '60%' }} />
          <span className="dr-skel" style={{ width: '30%', height: 26 }} />
        </div>
      ))}
    </div>
  );
}

/** A friendly message for a failed load, never a raw server error dump. */
export function LoadError({ error, onRetry }) {
  return (
    <div className="dr-section-body">
      <div className="dr-callout is-alert" role="alert">
        <Icon name="alert" />
        <div>
          <p>
            <strong>We couldn’t load this.</strong> {error?.message && error.message.length < 200 ? error.message : 'Please try again.'}
          </p>
          {onRetry && (
            <button type="button" className="dr-btn is-secondary is-sm" style={{ marginTop: 8 }} onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Loads with `fn` whenever `deps` change → { data, error, loading, reload }. */
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn()
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((error) => alive && setState({ data: null, error, loading: false }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

/** A modal confirmation. Focus starts on Cancel; Escape cancels. */
export function ConfirmDialog({ open, title, children, confirmLabel, busy, onConfirm, onCancel, tone = 'primary' }) {
  const titleId = useId();
  const cancelRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && !busy && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);
  if (!open) return null;
  return (
    <div className="dr-dialog-scrim" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div className="dr-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{title}</h2>
        {children}
        <div className="dr-dialog-actions">
          <button ref={cancelRef} type="button" className="dr-btn is-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={`dr-btn is-${tone}`} onClick={onConfirm} disabled={busy}>
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- toasts ----------

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const show = useCallback((message, tone = 'ok') => setToast({ message, tone, id: Date.now() }), []);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" role="status">
        {toast && (
          <div key={toast.id} className={`dr-toast${toast.tone === 'error' ? ' is-error' : ''}`}>
            <Icon name={toast.tone === 'error' ? 'alert' : 'check'} size={16} />
            {toast.message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

// ---------- request lists ----------

/**
 * Review requests as a compact table on wide screens and cards on phones.
 * action(row) → { label, to?, onClick?, tone? }.
 */
export function RequestList({ rows, action, columns = ['assessment', 'patient', 'risk', 'findings', 'requested', 'status'], dateKey = 'requested_at', dateLabel = 'Requested' }) {
  const head = {
    assessment: 'Assessment',
    patient: 'Patient',
    risk: 'Risk estimate',
    findings: 'Key findings',
    requested: dateLabel,
    status: 'Status',
    decision: 'Decision',
  };
  const cell = (row, col) => {
    switch (col) {
      case 'assessment':
        return (
          <>
            <span className="dr-ref">{row.assessment}</span>
            <span className="dr-cell-sub">{row.id}</span>
          </>
        );
      case 'patient':
        return (
          <>
            <span className="dr-cell-main">{row.patient.name}</span>
            <span className="dr-cell-sub">{patientLine(row.patient)}</span>
          </>
        );
      case 'risk':
        return (
          <>
            <RiskTag risk={row.risk} />
            <Attention row={row} />
          </>
        );
      case 'findings':
        return <Findings items={row.findings} />;
      case 'requested':
        return <span className="dr-num">{fmtDateTime(row[dateKey])}</span>;
      case 'status':
        return <StatusBadge status={row.status} label={row.status_label} />;
      case 'decision':
        return row.decision_label || <span className="dr-muted">—</span>;
      default:
        return null;
    }
  };
  const button = (row) => {
    const a = action(row);
    if (!a) return null;
    return a.to ? (
      <Link to={a.to} className={`dr-btn is-${a.tone ?? 'secondary'} is-sm`} aria-label={`${a.label}: ${row.assessment}`}>
        {a.label}
      </Link>
    ) : (
      <button type="button" className={`dr-btn is-${a.tone ?? 'secondary'} is-sm`} onClick={a.onClick} aria-label={`${a.label}: ${row.assessment}`}>
        {a.label}
      </button>
    );
  };
  return (
    <>
      <div className="dr-table-wrap is-responsive">
        <table className="dr-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c} scope="col">
                  {head[c]}
                </th>
              ))}
              <th scope="col" className="is-right">
                <span className="dr-sr">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                {columns.map((c) => (
                  <td key={c}>{cell(row, c)}</td>
                ))}
                <td className="is-right">{button(row)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="dr-cards" role="list">
        {rows.map((row) => (
          <li key={row.id} className="dr-card dr-req-card">
            <div className="dr-req-card-top">
              <span className="dr-ref">Assessment {row.assessment}</span>
              <StatusBadge status={row.status} label={row.status_label} />
            </div>
            <div>
              <span className="dr-cell-main">{row.patient.name}</span>
              <span className="dr-cell-sub">{patientLine(row.patient)}</span>
            </div>
            <dl className="dr-kv">
              <dt>Risk estimate</dt>
              <dd>
                <RiskTag risk={row.risk} />
                <Attention row={row} />
              </dd>
              <dt>Key findings</dt>
              <dd>
                <Findings items={row.findings} />
              </dd>
              <dt>{dateLabel}</dt>
              <dd className="dr-num">{fmtDateTime(row[dateKey])}</dd>
              {row.decision_label && (
                <>
                  <dt>Decision</dt>
                  <dd>{row.decision_label}</dd>
                </>
              )}
            </dl>
            {button(row)}
          </li>
        ))}
      </ul>
    </>
  );
}

export function Pager({ data, page, onPage }) {
  if (!data || data.pages <= 1) return null;
  return (
    <div className="dr-pager">
      <span>
        Page {data.page} of {data.pages} · {data.count} total
      </span>
      <span style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="dr-btn is-secondary is-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <button type="button" className="dr-btn is-secondary is-sm" disabled={page >= data.pages} onClick={() => onPage(page + 1)}>
          Next
        </button>
      </span>
    </div>
  );
}

/** The review's audit timeline, oldest first. */
export function Timeline({ events = [], future = [] }) {
  return (
    <ol className="dr-timeline">
      {compactTimeline(events).map((e, i) => (
        <li key={`${e.kind}-${i}`}>
          <time dateTime={e.at}>{fmtDateTime(e.at)}</time>
          <div>
            <strong>{e.label}</strong>
            {e.by && <span>{e.by}</span>}
          </div>
        </li>
      ))}
      {future.map((label) => (
        <li key={label} className="is-future">
          <time>Next</time>
          <div>
            <strong className="dr-muted">{label}</strong>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** A password field with Show / Hide. */
export function PasswordInput({ id, value, onChange, autoComplete, invalid, describedBy }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="dr-pass">
      <input
        id={id}
        className="dr-input"
        type={shown ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        required
      />
      <button type="button" onClick={() => setShown((v) => !v)} aria-pressed={shown} aria-label={shown ? 'Hide password' : 'Show password'}>
        {shown ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}

// ---------- day / night mode ----------

const THEME_KEY = 'cardio-doctor:theme';
const THEMES = [
  ['light', 'Light', 'sun'],
  ['dark', 'Dark', 'moon'],
  ['system', 'System', 'monitor'],
];
const ThemeContext = createContext(null);

function storedTheme() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return THEMES.some(([id]) => id === v) ? v : 'system';
  } catch {
    return 'system'; // storage blocked: follow the device
  }
}

/**
 * The Doctor Panel's theme: the doctor's choice (remembered in this browser) or
 * the device's setting. Applied as <html data-dr-theme> while the panel is open,
 * so dialogs and toasts follow it too; removed when leaving the panel.
 */
export function ThemeProvider({ children }) {
  const [choice, setChoice] = useState(storedTheme);
  const query = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const [osDark, setOsDark] = useState(Boolean(query?.matches));
  useEffect(() => {
    if (!query) return undefined;
    const on = (e) => setOsDark(e.matches);
    query.addEventListener?.('change', on);
    return () => query.removeEventListener?.('change', on);
  }, [query]);
  const theme = choice === 'system' ? (osDark ? 'dark' : 'light') : choice;
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.drTheme = theme;
    return () => {
      delete root.dataset.drTheme;
    };
  }, [theme]);
  const choose = useCallback((next) => {
    setChoice(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* this visit only */
    }
  }, []);
  return <ThemeContext.Provider value={{ choice, theme, choose }}>{children}</ThemeContext.Provider>;
}

/** The glass light / dark switch (top bar, sign-in page). Choosing here sets an explicit mode. */
export function ThemeToggle({ className = '' }) {
  const ctx = useContext(ThemeContext);
  if (!ctx) return null;
  const dark = ctx.theme === 'dark';
  return <ThemeSwitch dark={dark} onToggle={() => ctx.choose(dark ? 'light' : 'dark')} className={className} />;
}

/** Light / Dark / System (Profile → Appearance). `compact` shows icons only (labels stay for screen readers). */
export function ThemePicker({ compact = false, className = '' }) {
  const ctx = useContext(ThemeContext);
  if (!ctx) return null;
  return (
    <div role="radiogroup" aria-label="Appearance" className={`dr-theme-pick ${className}`}>
      {THEMES.map(([id, label, icon]) => (
        <button key={id} type="button" role="radio" aria-checked={ctx.choice === id} onClick={() => ctx.choose(id)} title={`${label} mode`}>
          <Icon name={icon} size={15} />
          {compact ? <span className="dr-sr">{label}</span> : label}
        </button>
      ))}
    </div>
  );
}
