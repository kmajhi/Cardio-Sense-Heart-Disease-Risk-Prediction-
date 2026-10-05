import { useState } from 'react';
import { admin } from '../../../api/adminApi';
import { Badge, DataTable, ErrorNote, PageHeader, Pagination, RiskBadge, SearchBox, Segmented, Skeleton, Toolbar, fmtDateTime, fmtPct, useDebounced, useLoad } from '../ui';

const STATUS_TONE = { pending: 'warn', under_review: 'violet', completed: 'ok', cancelled: 'neutral' };
const FILTERS = [
  ['', 'All'],
  ['pending', 'Pending'],
  ['under_review', 'Under review'],
  ['completed', 'Completed'],
  ['needs_more_information', 'Needs information'],
  ['cancelled', 'Withdrawn'],
];

/** Admin console → Review requests: every doctor-review request and where it stands. Read-only. */
export default function Reviews() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [high, setHigh] = useState(false);
  const [page, setPage] = useState(1);
  const search = useDebounced(q);
  const { data, error, loading, reload } = useLoad(() => admin.reviews({ q: search, status, risk: high ? 'high' : '', page }), [search, status, high, page]);
  const counts = data?.counts ?? {};

  return (
    <>
      <PageHeader
        title="Review requests"
        subtitle={`Doctor reviews across all patients. ${counts.pending ?? 0} pending · ${counts.under_review ?? 0} under review · ${counts.completed ?? 0} completed.`}
      />
      <Toolbar>
        <SearchBox
          value={q}
          onChange={(v) => {
            setPage(1);
            setQ(v);
          }}
          placeholder="Patient, doctor, A-0012 or R-0003"
        />
        <Segmented
          label="Status"
          value={status}
          onChange={(v) => {
            setPage(1);
            setStatus(v);
          }}
          options={FILTERS}
        />
        <label className="cx-check-label" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <input
            type="checkbox"
            className="cx-checkbox"
            checked={high}
            onChange={(e) => {
              setPage(1);
              setHigh(e.target.checked);
            }}
          />
          High model-estimated risk
        </label>
      </Toolbar>
      <ErrorNote error={error} onRetry={reload} />
      {loading && !data ? (
        <Skeleton rows={1} />
      ) : (
        <div className="cx-card-table">
          <DataTable
            rows={data?.results}
            empty="No review requests match."
            columns={[
              {
                key: 'assessment',
                label: 'Assessment',
                render: (r) => (
                  <div className="cx-cell-main">
                    <strong>{r.assessment}</strong>
                    <span className="cx-muted">{r.id}</span>
                  </div>
                ),
              },
              {
                key: 'patient',
                label: 'Patient',
                render: (r) => (
                  <div className="cx-cell-main">
                    <strong>{r.patient.name}</strong>
                    <span className="cx-muted">
                      <RiskBadge level={r.risk.level} /> {fmtPct(r.risk.probability)}
                    </span>
                  </div>
                ),
              },
              { key: 'requested', label: 'Requested', render: (r) => fmtDateTime(r.requested_at) },
              { key: 'status', label: 'Status', render: (r) => <Badge tone={STATUS_TONE[r.status]} dot>{r.status_label}</Badge> },
              { key: 'doctor', label: 'Assigned doctor', render: (r) => (r.doctor ? `${r.doctor.name} (${r.doctor.doctor_id})` : <span className="cx-muted">—</span>) },
              { key: 'started', label: 'Started', render: (r) => fmtDateTime(r.claimed_at) },
              { key: 'completed', label: 'Completed', render: (r) => fmtDateTime(r.completed_at) },
              { key: 'decision', label: 'Decision', render: (r) => r.decision_label || <span className="cx-muted">—</span> },
            ]}
          />
          {data && <Pagination page={data.page} pages={data.pages} count={data.count} onPage={setPage} />}
        </div>
      )}
    </>
  );
}
