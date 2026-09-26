import { useEffect, useId, useRef, useState } from 'react';
import { useNotifications } from './NotificationsContext';
import { AlertGroups, GuidanceLink, RiskNotice } from './Alerts';
import { linkProps } from '../pages/Dashboard/link';

const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z" strokeLinejoin="round" />
    <path d="M10 20.5a2 2 0 0 0 4 0" strokeLinecap="round" />
  </svg>
);

/**
 * The nav bell. One notification per assessment (model risk plus grouped
 * alerts), so repeat visits don't pile up duplicates; opening it marks it read.
 */
export default function NotificationsMenu({ LinkComponent = 'a', fallbackDot = false }) {
  const ctx = useNotifications();
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const button = useRef(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onDown = (e) => !wrap.current?.contains(e.target) && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  // Outside the provider (a page rendered on its own): the old static bell.
  if (!ctx) {
    return (
      <button type="button" className="pc-icon-btn" aria-label="Notifications">
        <BellIcon />
        {fallbackDot && <span className="pc-dot" />}
      </button>
    );
  }

  const { notification: n, unread, markRead } = ctx;
  const L = LinkComponent;
  const toggle = () => {
    setOpen((o) => !o);
    if (!open) markRead();
  };
  const close = () => setOpen(false);

  return (
    <div className="pc-n-bell" ref={wrap}>
      <button
        ref={button}
        type="button"
        className="pc-icon-btn"
        aria-label={unread ? 'Notifications (new)' : 'Notifications'}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
      >
        <BellIcon />
        {unread && <span className={`pc-dot${n?.urgent.length ? ' is-urgent' : ''}`} />}
      </button>

      {open && (
        <div id={panelId} className="pc-n-panel" role="dialog" aria-label="Notifications">
          <header className="pc-n-panel-head">
            <strong>Notifications</strong>
            {n && (
              <span>
                {n.groups.length
                  ? `${n.groups.length} ${n.groups.length === 1 ? 'area needs' : 'areas need'} attention`
                  : 'All values in range'}
              </span>
            )}
          </header>

          {!n ? (
            <div className="pc-n-empty">
              <p>No assessment yet. Run a prediction to see your risk and any values that need attention.</p>
              <L {...linkProps(L, '/prediction')} className="pc-n-cta" onClick={close}>
                Run a prediction <span aria-hidden="true">→</span>
              </L>
            </div>
          ) : (
            <div className="pc-n-panel-body">
              <RiskNotice risk={n.risk} time={n.createdAt} />
              {n.groups.length ? (
                <AlertGroups groups={n.groups} limit={3} time={n.createdAt} />
              ) : (
                <p className="pc-n-allclear">All entered values are within healthy reference ranges.</p>
              )}
              <GuidanceLink LinkComponent={LinkComponent} onClick={close} />
              <p className="pc-n-disclaimer">General guidance, not a diagnosis or a substitute for medical advice.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
