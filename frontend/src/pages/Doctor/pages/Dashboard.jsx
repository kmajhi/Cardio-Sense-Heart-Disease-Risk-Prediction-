import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { doctorApi } from '../../../api/doctorApi';
import { Empty, Icon, LoadError, MetricsSkeleton, RequestList, RiskTag, Skeleton, useLoad } from '../ui';
import { drName, fmtDate, fmtDateTime, greeting } from '../format';
import { AvailabilityToggle } from './Profile';
import ClaimDialog from './ClaimDialog';

function Metric({ label, value, hint, icon, tone, onClick }) {
  return (
    <button type="button" className="dr-card dr-metric" onClick={onClick}>
      <span className="dr-metric-label">
        <span className={`dr-metric-icon is-${tone}`}>
          <Icon name={icon} size={15} />
        </span>
        {label}
      </span>
      <span className="dr-metric-value">{value}</span>
      {hint && <span className="dr-metric-hint">{hint}</span>}
    </button>
  );
}

/**
 * The doctor's landing page. It answers one question: what needs reviewing?
 * Workload counts, then the priority queue, then their own active and recent work.
 */
export default function Dashboard({ me, reloadMe, refreshCounts, blocked }) {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useLoad(() => (blocked ? Promise.resolve(null) : doctorApi.overview()), [blocked]);
  const [claiming, setClaiming] = useState(null);

  return (
    <>
      <div className="dr-page-head">
        <div>
          <h1 className="dr-h1">
            {greeting()}, {drName(me.name)}
          </h1>
          <p className="dr-sub">Here is your clinical review workload.</p>
        </div>
        <AvailabilityToggle me={me} reloadMe={reloadMe} />
      </div>

      {blocked ? null : loading && !data ? (
        <>
          <MetricsSkeleton />
          <div className="dr-card dr-section">
            <Skeleton rows={4} />
          </div>
        </>
      ) : error ? (
        <div className="dr-card dr-section">
          <LoadError error={error} onRetry={reload} />
        </div>
      ) : (
        <>
          <div className="dr-metrics" role="group" aria-label="Workload">
            <Metric label="Awaiting review" value={data.counts.awaiting} icon="inbox" tone="warn" hint="Open requests you can accept" onClick={() => navigate('/doctor/requests')} />
            <Metric label="Active reviews" value={data.counts.active} icon="clipboard" tone="info" hint="Assigned to you" onClick={() => navigate('/doctor/active')} />
            <Metric
              label="Needs attention"
              value={data.counts.attention}
              icon="alert"
              tone="warn"
              hint="Higher model estimate or flagged values"
              onClick={() => navigate('/doctor/requests?attention=1')}
            />
            <Metric label="Completed" value={data.counts.completed} icon="checkCircle" tone="ok" hint={`${data.counts.completed_week} this week`} onClick={() => navigate('/doctor/completed')} />
          </div>

          <section className="dr-card dr-section" aria-labelledby="dr-queue">
            <div className="dr-section-head">
              <div>
                <h2 className="dr-h2" id="dr-queue">
                  Priority Review Requests
                </h2>
                <p>Patient assessments waiting for clinical review: higher model-estimated risk first, then the longest waiting.</p>
              </div>
              <Link to="/doctor/requests" className="dr-btn is-ghost is-sm">
                View all <Icon name="arrow" size={15} />
              </Link>
            </div>
            {data.priority.length === 0 ? (
              <Empty title="No review requests">You’re all caught up. New assessments will appear here when they are available.</Empty>
            ) : (
              <RequestList
                rows={data.priority}
                action={(row) => (me.is_available ? { label: 'Review Request', tone: 'primary', onClick: () => setClaiming(row) } : null)}
              />
            )}
            {!me.is_available && data.priority.length > 0 && (
              <div className="dr-section-body">
                <div className="dr-callout is-info">
                  <Icon name="info" />
                  <p>You’re marked unavailable, so you can’t accept new requests. Set yourself available to start a review.</p>
                </div>
              </div>
            )}
          </section>

          <div className="dr-dash-grid">
            <section className="dr-card dr-section" aria-labelledby="dr-active">
              <div className="dr-section-head">
                <h2 className="dr-h2" id="dr-active">
                  My Active Reviews
                </h2>
                <Link to="/doctor/active" className="dr-btn is-ghost is-sm">
                  View all
                </Link>
              </div>
              {data.active.length === 0 ? (
                <Empty icon="clipboard" title="No active reviews">
                  You don’t currently have any assessments under review.
                </Empty>
              ) : (
                <ul className="dr-mini-list">
                  {data.active.map((r) => (
                    <li key={r.id} className="dr-mini">
                      <div>
                        <span className="dr-ref">{r.assessment}</span> · <span className="dr-cell-main">{r.patient.name}</span>
                        <span className="dr-cell-sub">
                          <RiskTag risk={r.risk} /> Started {fmtDateTime(r.claimed_at)}
                        </span>
                      </div>
                      <Link to={`/doctor/review/${r.id}`} className="dr-btn is-primary is-sm">
                        Continue
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="dr-card dr-section" aria-labelledby="dr-done">
              <div className="dr-section-head">
                <h2 className="dr-h2" id="dr-done">
                  Recent Completed Reviews
                </h2>
                <Link to="/doctor/completed" className="dr-btn is-ghost is-sm">
                  View all
                </Link>
              </div>
              {data.completed.length === 0 ? (
                <Empty icon="checkCircle" title="No completed reviews yet" />
              ) : (
                <ul className="dr-mini-list">
                  {data.completed.map((r) => (
                    <li key={r.id} className="dr-mini">
                      <div>
                        <span className="dr-ref">{r.assessment}</span> · <span className="dr-cell-main">{r.patient.name}</span>
                        <span className="dr-cell-sub">
                          {r.decision_label} · {fmtDate(r.completed_at)}
                        </span>
                      </div>
                      <Link to={`/doctor/review/${r.id}`} className="dr-btn is-secondary is-sm" aria-label={`Open completed review ${r.assessment}`}>
                        Open
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}

      <ClaimDialog
        row={claiming}
        onClose={() => setClaiming(null)}
        onTaken={() => {
          setClaiming(null);
          reload();
          refreshCounts();
        }}
      />
    </>
  );
}

