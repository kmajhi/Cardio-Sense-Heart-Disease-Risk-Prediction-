import { notificationsApi } from '../../../api/doctorApi';
import { Empty, LoadError, Skeleton, useLoad, useToast } from '../ui';
import { fmtDateTime } from '../format';

export default function Notifications({ onChange }) {
  const toast = useToast();
  const { data, error, loading, reload } = useLoad(() => notificationsApi.list(), []);
  const markAll = () =>
    notificationsApi
      .markRead()
      .then(() => {
        reload();
        onChange?.();
      })
      .catch(() => toast('We couldn’t update your notifications. Please try again.', 'error'));

  return (
    <>
      <div className="dr-page-head">
        <div>
          <h1 className="dr-h1">Notifications</h1>
          <p className="dr-sub">New review requests and updates about your reviews. Shown here only: no emails are sent.</p>
        </div>
        {data?.unread > 0 && (
          <button type="button" className="dr-btn is-secondary" onClick={markAll}>
            Mark all as read
          </button>
        )}
      </div>
      <section className="dr-card dr-section">
        {loading && !data ? (
          <Skeleton rows={4} />
        ) : error ? (
          <LoadError error={error} onRetry={reload} />
        ) : data.results.length === 0 ? (
          <Empty icon="bell" title="No notifications">
            You’ll be told here when a new assessment is available for review.
          </Empty>
        ) : (
          <ul className="dr-note-list">
            {data.results.map((n) => (
              <li key={n.id} className={`dr-note${n.read ? '' : ' is-unread'}`}>
                <span className="dr-note-dot" aria-hidden="true" />
                <div>
                  <strong>
                    {n.title}
                    {!n.read && <span className="dr-sr"> (unread)</span>}
                  </strong>
                  {n.body && <p>{n.body}</p>}
                  <time dateTime={n.created_at}>{fmtDateTime(n.created_at)}</time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
