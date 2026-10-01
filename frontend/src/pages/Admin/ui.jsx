// Building blocks shared by the admin console's sections.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

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

const RISK_LABEL = { low: 'Low', moderate: 'Moderate', high: 'High' };
export const RiskBadge = ({ level }) => <span className={`ad-badge is-risk-${level}`}>{RISK_LABEL[level] ?? level}</span>;

export function Badge({ tone = 'neutral', children, title }) {
  return (
    <span className={`ad-badge is-${tone}`} title={title}>
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

export function Empty({ children }) {
  return <div className="ad-empty">{children}</div>;
}

// ---------- tables ----------

/**
 * columns: [{ key, label, render?(row), align?, width? }]. onRowClick makes rows
 * act like buttons (Enter/Space too).
 */
export function DataTable({ columns, rows, onRowClick, rowKey = (r) => r.id, empty = 'Nothing to show.' }) {
  if (!rows?.length) return <Empty>{empty}</Empty>;
  return (
    <div className="ad-table-wrap">
      <table className="ad-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ width: c.width, textAlign: c.align }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={rowKey(r)}
              className={onRowClick ? 'is-clickable' : undefined}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              onKeyDown={
                onRowClick
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onRowClick(r);
                      }
                    }
                  : undefined
              }
              tabIndex={onRowClick ? 0 : undefined}
            >
              {columns.map((c) => (
                <td key={c.key} style={{ textAlign: c.align }}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
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
