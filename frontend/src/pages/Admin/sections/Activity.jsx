import { useState } from 'react';
import { admin, download } from '../../../api/adminApi';
import { Badge, DataTable, ErrorNote, Loading, PageHeader, Pagination, SearchBox, Select, Toolbar, fmtAgo, fmtDateTime, useDebounced, useLoad, useToast } from '../ui';

const TONE = { login_failed: 'danger', admin: 'violet', maintenance: 'violet', signup: 'ok', account_deleted: 'warn' };

export default function Activity() {
  const notify = useToast();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounced(q);
  const filters = { q: search, kind, date_from: dateFrom, date_to: dateTo };
  const { data, error, loading, reload } = useLoad(() => admin.activity({ ...filters, page }), [search, kind, dateFrom, dateTo, page]);
  const filter = (setter) => (v) => {
    setter(v);
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Activity log"
        subtitle="Sign-ups, logins, predictions and every admin action. Kept 180 days."
        actions={
          <>
            <button type="button" className="ad-btn" onClick={reload}>
              Refresh
            </button>
            <button type="button" className="ad-btn" onClick={() => download('/admin/activity/export/', filters, 'activity.csv').catch((e) => notify(e.message, 'error'))}>
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
        <Loading />
      ) : (
        <>
          <DataTable
            rows={data?.results}
            empty="No activity matches these filters."
            columns={[
              { key: 'time', label: 'When', render: (r) => <span title={fmtDateTime(r.created_at)}>{fmtAgo(r.created_at)}</span>, width: '120px' },
              { key: 'kind', label: 'Type', render: (r) => <Badge tone={TONE[r.kind] ?? 'neutral'}>{r.kind_label}</Badge>, width: '150px' },
              { key: 'summary', label: 'What happened' },
              { key: 'email', label: 'Account', render: (r) => r.email || <span className="ad-muted">—</span> },
              { key: 'ip', label: 'IP', render: (r) => <span className="ad-mono">{r.ip || '—'}</span> },
            ]}
          />
          {data && <Pagination page={data.page} pages={data.pages} count={data.count} onPage={setPage} />}
        </>
      )}
    </>
  );
}
