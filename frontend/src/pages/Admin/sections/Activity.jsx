import { useEffect, useState } from 'react';
import { admin, download } from '../../../api/adminApi';
import {
  Badge, DataTable, Drawer, ErrorNote, Facts, Icon, PageHeader, Pagination, SearchBox, Select, Skeleton, Toolbar,
  fmtAgo, fmtDateTime, fmtNumber, useDebounced, useLoad, useToast,
} from '../ui';

const TONE = { login_failed: 'danger', admin: 'violet', maintenance: 'violet', signup: 'ok', account_deleted: 'warn' };
const LIVE_MS = 5000;

function EventDetail({ event, onClose, openUser }) {
  const detail = Object.entries(event.detail ?? {});
  return (
    <Drawer open onClose={onClose} title={event.kind_label} subtitle={fmtDateTime(event.created_at)}>
      <p className="ad-event-summary">{event.summary}</p>
      <Facts
        items={[
          ['When', `${fmtDateTime(event.created_at)} (${fmtAgo(event.created_at)})`],
          ['Type', <Badge key="t" tone={TONE[event.kind] ?? 'neutral'}>{event.kind_label}</Badge>],
          [
            'Account',
            event.user_id ? (
              <button type="button" className="ad-link-btn" onClick={() => { onClose(); openUser(event.user_id); }}>
                {event.email}
              </button>
            ) : (
              event.email || '—'
            ),
          ],
          ['IP address', event.ip ? <span className="ad-mono">{event.ip}</span> : '—'],
          ['Event id', <span key="i" className="ad-mono">#{event.id}</span>],
        ]}
      />
      <h3 className="ad-h3">Details</h3>
      {detail.length ? (
        <pre className="ad-code">{JSON.stringify(event.detail, null, 2)}</pre>
      ) : (
        <p className="ad-muted">No extra details were recorded.</p>
      )}
    </Drawer>
  );
}

export default function Activity({ openUser }) {
  const notify = useToast();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [live, setLive] = useState(false);
  const [open, setOpen] = useState(null);
  const search = useDebounced(q);
  const filters = { q: search, kind, date_from: dateFrom, date_to: dateTo };
  const { data, error, loading, reload } = useLoad(() => admin.activity({ ...filters, page }), [search, kind, dateFrom, dateTo, page]);
  const filter = (setter) => (v) => {
    setter(v);
    setPage(1);
  };

  // Live tail: newest page, refreshed every few seconds while the tab is visible.
  useEffect(() => {
    if (!live) return undefined;
    setPage(1);
    const id = setInterval(() => document.visibilityState === 'visible' && reload(), LIVE_MS);
    return () => clearInterval(id);
  }, [live, reload]);

  return (
    <>
      <PageHeader
        title="Activity log"
        subtitle="Audit trail of sign-ups, logins, predictions and every admin action. Kept 180 days."
        actions={
          <>
            <button type="button" className={`ad-btn${live ? ' is-live' : ''}`} aria-pressed={live} onClick={() => setLive((v) => !v)}>
              {live ? <span className="ad-live-dot" aria-hidden="true" /> : <Icon name="play" size={14} />}
              {live ? 'Live' : 'Go live'}
            </button>
            <button type="button" className="ad-btn" onClick={() => download('/admin/activity/export/', filters, 'activity.csv').catch((e) => notify(e.message, 'error'))}>
              <Icon name="download" size={15} />
              Export CSV
            </button>
          </>
        }
      />
      <Toolbar>
        <SearchBox value={q} onChange={filter(setQ)} placeholder="Search email, text or IP" />
        <Select label="Type" value={kind} onChange={filter(setKind)} options={[['', 'All'], ...(data?.kinds ?? []).map((k) => [k.value, k.label])]} />
        <label className="ad-select">
          <span>From</span>
          <input type="date" value={dateFrom} onChange={(e) => filter(setDateFrom)(e.target.value)} />
        </label>
        <label className="ad-select">
          <span>To</span>
          <input type="date" value={dateTo} onChange={(e) => filter(setDateTo)(e.target.value)} />
        </label>
      </Toolbar>
      <ErrorNote error={error} onRetry={reload} />
      {loading && !data ? (
        <Skeleton rows={1} />
      ) : (
        <div className="ad-card-table">
          {live && <div className="ad-live-bar">Streaming new events every {LIVE_MS / 1000} seconds · {fmtNumber(data?.count)} in total</div>}
          <DataTable
            rows={data?.results}
            onRowClick={setOpen}
            empty="No activity matches these filters."
            columns={[
              { key: 'time', label: 'When', render: (r) => <span title={fmtDateTime(r.created_at)}>{fmtAgo(r.created_at)}</span>, width: '120px' },
              { key: 'kind', label: 'Type', render: (r) => <Badge tone={TONE[r.kind] ?? 'neutral'} dot>{r.kind_label}</Badge>, width: '170px' },
              { key: 'summary', label: 'What happened' },
              { key: 'email', label: 'Account', render: (r) => r.email || <span className="ad-muted">—</span> },
              { key: 'ip', label: 'IP', render: (r) => <span className="ad-mono">{r.ip || '—'}</span> },
            ]}
          />
          {data && <Pagination page={data.page} pages={data.pages} count={data.count} onPage={setPage} />}
        </div>
      )}
      {open && <EventDetail event={open} onClose={() => setOpen(null)} openUser={openUser} />}
    </>
  );
}
