// The console's notification centre: alerts the server works out from live data
// (failed-login spikes, paused features, housekeeping). Which ones were read is
// remembered in this browser.
import { useCallback, useEffect, useRef, useState } from 'react';
import { admin } from '../../api/adminApi';
import { Icon, fmtAgo, useStoredState } from './ui';

const POLL_MS = 60_000;
const LEVEL_ICON = { danger: 'security', warn: 'bolt', info: 'inbox', ok: 'users' };

/** → { items, unread, readIds, markRead(id), markAllRead(), reload } */
export function useNotifications() {
  const [items, setItems] = useState([]);
  const [readIds, setReadIds] = useStoredState('cardio-admin:read-alerts', []);
  const load = useCallback(() => {
    admin
      .notifications()
      .then((r) => setItems(r.items))
      .catch(() => {});
  }, []);
  useEffect(() => {
    load();
    const id = setInterval(() => document.visibilityState === 'visible' && load(), POLL_MS);
    return () => clearInterval(id);
  }, [load]);
  const read = new Set(readIds);
  const markRead = (id) => setReadIds((ids) => (ids.includes(id) ? ids : [...ids, id].slice(-300)));
  const markAllRead = () => setReadIds((ids) => [...new Set([...ids, ...items.map((i) => i.id)])].slice(-300));
  return { items, unread: items.filter((i) => !read.has(i.id)).length, read, markRead, markAllRead, reload: load };
}

export default function Inbox({ notes, onGo }) {
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
    <div className="ad-pop-wrap" ref={ref}>
      <button
        type="button"
        className="ad-icon-btn"
        aria-label={`Notifications${notes.unread ? `, ${notes.unread} unread` : ''}`}
        aria-expanded={open}
        onClick={() => {
          if (!open) notes.reload();
          setOpen((v) => !v);
        }}
      >
        <Icon name="bell" size={18} />
        {notes.unread > 0 && <span className="ad-dot-count">{notes.unread > 9 ? '9+' : notes.unread}</span>}
      </button>
      {open && (
        <div className="ad-pop ad-inbox" role="dialog" aria-label="Notifications">
          <header>
            <strong>Notifications</strong>
            <button type="button" className="ad-link-btn" disabled={!notes.unread} onClick={notes.markAllRead}>
              Mark all as read
            </button>
          </header>
          {notes.items.length === 0 ? (
            <div className="ad-inbox-empty">
              <Icon name="check" size={22} />
              <p>All clear. Nothing needs your attention.</p>
            </div>
          ) : (
            <ul>
              {notes.items.map((n) => {
                const unread = !notes.read.has(n.id);
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={`ad-inbox-item${unread ? ' is-unread' : ''}`}
                      onClick={() => {
                        notes.markRead(n.id);
                        setOpen(false);
                        onGo(n.section);
                      }}
                    >
                      <span className={`ad-inbox-icon is-${n.level}`}>
                        <Icon name={LEVEL_ICON[n.level]} size={15} />
                      </span>
                      <span className="ad-inbox-text">
                        <strong>{n.title}</strong>
                        <span>{n.body}</span>
                        <time dateTime={n.at}>{fmtAgo(n.at)}</time>
                      </span>
                      {unread && <span className="ad-unread-dot" aria-label="Unread" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
