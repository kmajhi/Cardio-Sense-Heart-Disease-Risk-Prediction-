// Building blocks shared by the admin console's sections.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// ---------- icons (24px stroke paths) ----------

export const ICONS = {
  overview: 'M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 4v4h6V4z',
  users: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM21 19v-1a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8',
  assessments: 'M3 12h4l2-6 4 12 2-6h6',
  model: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12 4 7.5',
  activity: 'M4 6h16M4 12h16M4 18h10',
  security: 'M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6zM9 12l2 2 4-4',
  system: 'M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10Z',
  maintenance: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z',
  site: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-3.5-3.5',
  bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z',
  monitor: 'M3 5h18v11H3zM8 20h8M12 16v4',
  back: 'M15 18l-6-6 6-6',
  collapse: 'M4 4h16v16H4zM9 4v16M15 10l-2 2 2 2',
  expand: 'M4 4h16v16H4zM9 4v16M13 10l2 2-2 2',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3',
  keyboard: 'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10',
  refresh: 'M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6 6 18',
  bolt: 'M13 3 5 13h6l-1 8 8-10h-6z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3Z',
  pause: 'M8 5v14M16 5v14',
  play: 'M7 4v16l13-8z',
  inbox: 'M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6H3v-6z',
};

export function Icon({ name, d, size = 18, className }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className={className}>
      <path d={d ?? ICONS[name]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------- browser-remembered preferences ----------

/** useState that survives reloads (localStorage). Falls back to memory when storage is blocked. */
export function useStoredState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : JSON.parse(raw);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage blocked: keep it in memory */
    }
  }, [key, value]);
  return [value, setValue];
}

// ---------- formatting ----------

const dateTimeFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const dateFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export const fmtDateTime = (iso) => (iso ? dateTimeFmt.format(new Date(iso)) : '—');
export const fmtDate = (iso) => (iso ? dateFmt.format(new Date(iso)) : '—');
export const fmtNumber = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString());
export const fmtPct = (p, digits = 0) => {
  if (p === null || p === undefined) return '—';
  const v = p * 100;
  if (v > 0 && v < 1) return '<1%';
  if (v > 99 && v < 100) return '>99%';
  return `${v.toFixed(digits)}%`;
};
export const fmtBytes = (n) => {
  if (n === null || n === undefined) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i ? 1 : 0)} ${units[i]}`;
};

export function fmtAgo(iso) {
  if (!iso) return 'never';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d} d ago` : fmtDate(iso);
}

export const fmtDuration = (sec) => {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};

// ---------- data loading ----------

/** Loads `fn()` and reloads when `deps` change. → { data, error, loading, reload } */
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    fn()
      .then((data) => alive && setState({ data, error: '', loading: false }))
      .catch((err) => alive && setState((s) => ({ ...s, error: err.message || 'Something went wrong.', loading: false })));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

/** A value that settles `ms` after the last change (search boxes). */
export function useDebounced(value, ms = 300) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return settled;
}

// ---------- toasts ----------

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const notify = useCallback((text, tone = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="ad-toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`ad-toast is-${t.tone}`}>
            <span className="ad-toast-dot" aria-hidden="true" />
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ---------- layout pieces ----------

export function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="ad-page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="ad-page-actions">{actions}</div>}
    </header>
  );
}

export function Panel({ title, subtitle, actions, children, className = '' }) {
  return (
    <section className={`ad-panel ${className}`}>
      {(title || actions) && (
        <header className="ad-panel-head">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div className="ad-panel-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone }) {
  return (
    <div className={`ad-stat${tone ? ` is-${tone}` : ''}`}>
      <span className="ad-stat-label">{label}</span>
      <span className="ad-stat-value">{value}</span>
      {hint && <span className="ad-stat-hint">{hint}</span>}
    </div>
  );
}

/** Change against the previous period. `goodWhen` ('up' | 'down' | 'neutral') says which direction is good news. */
export function Delta({ current, previous, goodWhen = 'up' }) {
  if (previous === undefined || previous === null) return null;
  if (!previous) {
    return current ? <span className="ad-delta is-flat">new</span> : <span className="ad-delta is-flat">—</span>;
  }
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.5) return <span className="ad-delta is-flat">0%</span>;
  const up = pct > 0;
  const good = goodWhen === 'neutral' ? null : up === (goodWhen === 'up');
  return (
    <span className={`ad-delta ${good === null ? 'is-flat' : good ? 'is-good' : 'is-bad'}`} title={`Previous period: ${previous.toLocaleString()}`}>
      {up ? '↑' : '↓'} {Math.round(Math.abs(pct)).toLocaleString()}%
    </span>
  );
}

/** A tiny trend line with a soft fill; CSS sets its size. */
export function Sparkline({ values = [], tone = 'violet' }) {
  if (values.length < 2) return <span className="ad-spark is-empty" aria-hidden="true" />;
  const w = 120;
  const h = 32;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 2 - (v / max) * (h - 4)]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg className={`ad-spark is-${tone}`} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path className="ad-spark-fill" d={`${line} L${w},${h} L0,${h} Z`} />
      <path className="ad-spark-line" d={line} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Headline number with its change and a sparkline. Clickable when `onClick` is given. */
export function KpiCard({ label, icon, value, current, previous, goodWhen, spark, tone = 'violet', hint, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} className={`ad-kpi${onClick ? ' is-clickable' : ''}`} onClick={onClick}>
      <span className="ad-kpi-head">
        {icon && (
          <span className={`ad-kpi-icon is-${tone}`}>
            <Icon name={icon} size={15} />
          </span>
        )}
        <span className="ad-kpi-label">{label}</span>
      </span>
      <span className="ad-kpi-row">
        <span className="ad-kpi-value">{value}</span>
        <Delta current={current} previous={previous} goodWhen={goodWhen} />
      </span>
      <Sparkline values={spark} tone={tone} />
      {hint && <span className="ad-kpi-hint">{hint}</span>}
    </Tag>
  );
}

const AVATAR_TONES = ['violet', 'blue', 'teal', 'amber', 'rose', 'slate'];

/** Initials on a colour picked from the email, so a person keeps the same colour everywhere. */
export function Avatar({ name, email, size = 32 }) {
  const label = (name || email || '?').trim();
  const initials = label.includes('@')
    ? label[0].toUpperCase()
    : label
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join('');
  let hash = 0;
  for (const ch of email || label) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span className={`ad-avatar is-${AVATAR_TONES[hash % AVATAR_TONES.length]}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }} aria-hidden="true">
      {initials}
    </span>
  );
}

export const Kbd = ({ children }) => <kbd className="ad-kbd">{children}</kbd>;

/** Mutually exclusive choices in one pill (period pickers, view switches). */
export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="ad-seg" role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? 'is-on' : undefined} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

/** Placeholder blocks while a page loads, shaped roughly like what's coming. */
export function Skeleton({ rows = 2, kpis = 0 }) {
  return (
    <div className="ad-skeleton" role="status" aria-label="Loading">
      {kpis > 0 && (
        <div className="ad-kpis">
          {Array.from({ length: kpis }, (_, i) => (
            <span key={i} className="ad-skel ad-skel-kpi" />
          ))}
        </div>
      )}
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="ad-skel ad-skel-block" />
      ))}
    </div>
  );
}

const RISK_LABEL = { low: 'Low', moderate: 'Moderate', high: 'High' };
export const RiskBadge = ({ level }) => <span className={`ad-badge is-risk-${level}`}>{RISK_LABEL[level] ?? level}</span>;

export function Badge({ tone = 'neutral', children, title, dot }) {
  return (
    <span className={`ad-badge is-${tone}`} title={title}>
      {dot && <span className="ad-badge-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

const STATUS_TEXT = { ok: 'OK', warn: 'Attention', fail: 'Failing' };
export function StatusPill({ status }) {
  return (
    <span className={`ad-status is-${status}`}>
      <span className="ad-status-dot" aria-hidden="true" />
      {STATUS_TEXT[status] ?? status}
    </span>
  );
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="ad-loading" role="status">
      <span className="ad-spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="ad-error" role="alert">
      <span>{error}</span>
      {onRetry && (
        <button type="button" className="ad-btn is-small" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Empty({ children, icon = 'search' }) {
  return (
    <div className="ad-empty">
      <span className="ad-empty-icon">
        <Icon name={icon} size={20} />
      </span>
      <span>{children}</span>
    </div>
  );
}

// ---------- tables ----------

/**
 * columns: [{ key, label, render?(row), align?, width?, sortKey? }]. onRowClick makes rows
 * act like buttons (Enter/Space too).
 * Selection (optional): `selected` (a Set of row keys) + `onSelect(nextSet)` adds checkboxes;
 * `isSelectable(row)` can rule rows out.
 * Sorting (optional): `sort` ('field' or '-field') + `onSort(next)` makes sortKey headers clickable.
 */
export function DataTable({ columns, rows, onRowClick, rowKey = (r) => r.id, empty = 'Nothing to show.', selected, onSelect, isSelectable = () => true, sort, onSort }) {
  const headRef = useRef(null);
  const selectable = Boolean(onSelect);
  const keys = selectable ? (rows ?? []).filter(isSelectable).map(rowKey) : [];
  const nOn = keys.filter((k) => selected.has(k)).length;
  useEffect(() => {
    if (headRef.current) headRef.current.indeterminate = nOn > 0 && nOn < keys.length;
  }, [nOn, keys.length]);
  if (!rows?.length) return <Empty>{empty}</Empty>;

  const toggleAll = () => {
    const next = new Set(selected);
    if (nOn === keys.length) keys.forEach((k) => next.delete(k));
    else keys.forEach((k) => next.add(k));
    onSelect(next);
  };
  const toggle = (k) => {
    const next = new Set(selected);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onSelect(next);
  };

  return (
    <div className="ad-table-wrap">
      <table className="ad-table">
        <thead>
          <tr>
            {selectable && (
              <th className="ad-check-col">
                <input ref={headRef} type="checkbox" className="ad-checkbox" aria-label="Select all on this page" checked={keys.length > 0 && nOn === keys.length} onChange={toggleAll} />
              </th>
            )}
            {columns.map((c) => {
              const active = Boolean(sort && c.sortKey && sort.replace(/^-/, '') === c.sortKey);
              const desc = active && sort.startsWith('-');
              return (
                <th key={c.key} style={{ width: c.width, textAlign: c.align }} aria-sort={active ? (desc ? 'descending' : 'ascending') : undefined}>
                  {c.sortKey && onSort ? (
                    <button type="button" className={`ad-th-sort${active ? ' is-on' : ''}`} onClick={() => onSort(active && desc ? c.sortKey : `-${c.sortKey}`)}>
                      {c.label}
                      <span aria-hidden="true">{active ? (desc ? '↓' : '↑') : '↕'}</span>
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const k = rowKey(r);
            const on = selectable && selected.has(k);
            return (
              <tr
                key={k}
                className={[onRowClick && 'is-clickable', on && 'is-selected'].filter(Boolean).join(' ') || undefined}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onRowClick(r);
                        }
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
              >
                {selectable && (
                  <td className="ad-check-col" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="ad-checkbox" aria-label="Select row" disabled={!isSelectable(r)} checked={on} onChange={() => toggle(k)} />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.key} style={{ textAlign: c.align }}>
                    {c.render ? c.render(r) : r[c.key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, pages, count, onPage }) {
  if (!count) return null;
  return (
    <nav className="ad-pager" aria-label="Pages">
      <span>
        {fmtNumber(count)} {count === 1 ? 'item' : 'items'} · page {page} of {pages}
      </span>
      <div>
        <button type="button" className="ad-btn is-small" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          ← Previous
        </button>
        <button type="button" className="ad-btn is-small" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Next →
        </button>
      </div>
    </nav>
  );
}

export function Toolbar({ children }) {
  return <div className="ad-toolbar">{children}</div>;
}

export function SearchBox({ value, onChange, placeholder }) {
  return (
    <label className="ad-search">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="ad-sr">Search</span>
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

export function Select({ label, value, onChange, options }) {
  return (
    <label className="ad-select">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

// ---------- overlays ----------

/** A panel that slides in from the right, for one record's details. */
export function Drawer({ open, title, subtitle, onClose, children, footer }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    ref.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="ad-drawer-layer">
      <button type="button" className="ad-drawer-scrim" aria-label="Close" tabIndex={-1} onClick={onClose} />
      <aside className="ad-drawer" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <header className="ad-drawer-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="ad-icon-btn" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </header>
        <div className="ad-drawer-body">{children}</div>
        {footer && <footer className="ad-drawer-foot">{footer}</footer>}
      </aside>
    </div>
  );
}

/** Asks before a destructive action. `confirmText` makes the user type a word first. */
export function ConfirmDialog({ open, title, body, confirmLabel = 'Confirm', tone = 'danger', confirmText, busy, onConfirm, onCancel }) {
  const [typed, setTyped] = useState('');
  useEffect(() => setTyped(''), [open]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);
  if (!open) return null;
  const ready = !confirmText || typed === confirmText;
  return (
    <div className="ad-modal-layer">
      <button type="button" className="ad-drawer-scrim" aria-label="Cancel" tabIndex={-1} onClick={onCancel} />
      <div className="ad-modal" role="alertdialog" aria-modal="true" aria-labelledby="ad-confirm-title">
        <h2 id="ad-confirm-title">{title}</h2>
        <div className="ad-modal-body">{body}</div>
        {confirmText && (
          <label className="ad-field">
            <span>
              Type <strong>{confirmText}</strong> to confirm
            </span>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
          </label>
        )}
        <div className="ad-modal-actions">
          <button type="button" className="ad-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={`ad-btn is-${tone}`} disabled={!ready || busy} onClick={onConfirm}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint, disabled }) {
  return (
    <label className={`ad-toggle${disabled ? ' is-disabled' : ''}`}>
      <span className="ad-toggle-text">
        <span className="ad-toggle-label">{label}</span>
        {hint && <span className="ad-toggle-hint">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="ad-toggle-track" aria-hidden="true">
        <span className="ad-toggle-thumb" />
      </span>
    </label>
  );
}

/** Key/value list for detail views. */
export function Facts({ items }) {
  return (
    <dl className="ad-facts">
      {items
        .filter(Boolean)
        .map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v ?? '—'}</dd>
          </div>
        ))}
    </dl>
  );
}
