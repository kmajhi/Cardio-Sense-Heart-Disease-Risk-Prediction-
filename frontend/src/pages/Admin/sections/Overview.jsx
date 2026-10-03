import { admin } from '../../../api/adminApi';
import { AssessmentsChart, Funnel, RiskMix, SignupsChart } from '../charts';
import { Badge, ErrorNote, Icon, KpiCard, PageHeader, Panel, Segmented, Skeleton, fmtAgo, fmtNumber, useLoad, useStoredState } from '../ui';

const KIND_TONE = { login_failed: 'danger', admin: 'violet', maintenance: 'violet', signup: 'ok', account_deleted: 'warn' };

export function ActivityList({ events, empty = 'No activity yet.' }) {
  if (!events?.length) return <p className="cx-muted">{empty}</p>;
  return (
    <ul className="cx-feed">
      {events.map((e) => (
        <li key={e.id}>
          <span className={`cx-feed-dot is-${KIND_TONE[e.kind] ?? 'neutral'}`} aria-hidden="true" />
          <span className="cx-feed-text">
            {e.summary}
            <Badge tone={KIND_TONE[e.kind] ?? 'neutral'}>{e.kind_label}</Badge>
          </span>
          <time className="cx-muted" dateTime={e.created_at} title={new Date(e.created_at).toLocaleString()}>
            {fmtAgo(e.created_at)}
          </time>
        </li>
      ))}
    </ul>
  );
}

const PERIODS = [
  [7, '7 days'],
  [30, '30 days'],
  [90, '90 days'],
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Overview({ go }) {
  const [days, setDays] = useStoredState('cardio-admin:overview-days', 30);
  const { data, error, loading, reload } = useLoad(() => admin.overview(days), [days]);

  const header = (
    <PageHeader
      title={greeting()}
      subtitle={data ? `Here’s how Cardio Sense is doing · updated ${fmtAgo(data.generated_at)}` : 'Loading the latest figures…'}
      actions={
        <>
          <Segmented label="Period" value={days} onChange={setDays} options={PERIODS} />
          <button type="button" className="cx-btn" onClick={reload} disabled={loading}>
            <Icon name="refresh" size={15} />
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </>
      }
    />
  );

  if (loading && !data) return (<>{header}<Skeleton kpis={4} rows={2} /></>);
  if (error && !data) return (<>{header}<ErrorNote error={error} onRetry={reload} /></>);
  const { users, assessments, security, series, site, model, period } = data;
  const k = period.kpis;
  const sum = (key) => series.map((d) => d[key]);
  const assessSpark = series.map((d) => d.low + d.moderate + d.high);
  const highShare = k.assessments.current ? k.high_risk.current / k.assessments.current : 0;
  const lowConfShare = assessments.total ? assessments.low_confidence / assessments.total : 0;
  const label = `last ${period.days} days`;

  return (
    <>
      {header}

      {(site.maintenance_mode || !site.registration_open || !site.predictions_open || site.announcement) && (
        <div className="cx-callout is-warn">
          <Icon name="bolt" size={16} />
          <span>
            <strong>Site controls are active:</strong>{' '}
            {[
              site.maintenance_mode && 'maintenance mode is on',
              !site.registration_open && 'registration is paused',
              !site.predictions_open && 'predictions are paused',
              site.announcement && 'an announcement is showing',
            ]
              .filter(Boolean)
              .join(' · ')}
            .
          </span>
          <button type="button" className="cx-link-btn" onClick={() => go('site')}>
            Manage →
          </button>
        </div>
      )}

      <div className="cx-kpis">
        <KpiCard
          label="New accounts"
          icon="users"
          value={fmtNumber(k.signups.current)}
          current={k.signups.current}
          previous={k.signups.previous}
          spark={sum('signups')}
          hint={`${fmtNumber(users.total)} in total · ${label}`}
          onClick={() => go('users')}
        />
        <KpiCard
          label="Active users"
          icon="bolt"
          tone="teal"
          value={fmtNumber(k.active_users.current)}
          current={k.active_users.current}
          previous={k.active_users.previous}
          spark={sum('active')}
          hint={`signed in or predicted · ${label}`}
          onClick={() => go('activity')}
        />
        <KpiCard
          label="Assessments"
          icon="assessments"
          tone="blue"
          value={fmtNumber(k.assessments.current)}
          current={k.assessments.current}
          previous={k.assessments.previous}
          spark={assessSpark}
          hint={`${assessments.today} today · ${Math.round(highShare * 100)}% high risk`}
          onClick={() => go('assessments')}
        />
        <KpiCard
          label="Failed logins"
          icon="security"
          tone={k.failed_logins.current >= 10 ? 'rose' : 'slate'}
          value={fmtNumber(k.failed_logins.current)}
          current={k.failed_logins.current}
          previous={k.failed_logins.previous}
          goodWhen="down"
          spark={sum('failed')}
          hint={`${security.failed_logins_24h} in 24 h · ${security.sessions_active} sessions open`}
          onClick={() => go('security')}
        />
      </div>

      <div className="cx-grid-main">
        <Panel title="Assessments" subtitle={`By risk band · ${label}`}>
          <AssessmentsChart series={series} />
        </Panel>
        <Panel title="Activation" subtitle="How many accounts reach each step (staff left out)">
          <Funnel steps={data.funnel} />
        </Panel>
      </div>

      <div className="cx-grid-3">
        <Panel title="Risk mix" subtitle="All assessments">
          <RiskMix risk={assessments.risk} />
          <div className="cx-mini-stats">
            <div>
              <span>Low-confidence</span>
              <strong className={lowConfShare > 0.3 ? 'cx-down' : undefined}>{Math.round(lowConfShare * 100)}%</strong>
            </div>
            <div>
              <span>All-time</span>
              <strong>{fmtNumber(assessments.total)}</strong>
            </div>
          </div>
        </Panel>
        <Panel title="Top drivers" subtitle={`What most often raised estimates · ${label}`}>
          {data.top_raising_factors.length ? (
            <ol className="cx-rank">
              {data.top_raising_factors.map((f) => {
                const max = data.top_raising_factors[0].count;
                return (
                  <li key={f.name}>
                    <span>{f.name}</span>
                    <span className="cx-rank-bar" aria-hidden="true">
                      <span style={{ width: `${(f.count / max) * 100}%` }} />
                    </span>
                    <span className="cx-muted">{f.count}×</span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="cx-muted">No assessments in this period.</p>
          )}
        </Panel>
        <Panel title="Sign-ups" subtitle={label}>
          <SignupsChart series={series} />
        </Panel>
      </div>

      <div className="cx-grid-2">
        <Panel title="Recent activity" actions={<button type="button" className="cx-link-btn" onClick={() => go('activity')}>View all →</button>}>
          <ActivityList events={data.recent_activity} />
        </Panel>
        <Panel title="Platform" actions={<button type="button" className="cx-link-btn" onClick={() => go('system')}>System health →</button>}>
          <ul className="cx-platform">
            <li>
              <span className={`cx-status-dot is-${model.loaded ? 'ok' : 'warn'}`} aria-hidden="true" />
              <span>
                <strong>Prediction model</strong>
                <span className="cx-muted">
                  {model.name || 'No model'} · trained {model.trained_at ? new Date(model.trained_at).toLocaleDateString() : '—'}
                </span>
              </span>
              <Badge tone={model.loaded ? 'ok' : 'neutral'}>{model.loaded ? 'Loaded' : 'Idle'}</Badge>
            </li>
            <li>
              <span className={`cx-status-dot is-${site.maintenance_mode ? 'warn' : 'ok'}`} aria-hidden="true" />
              <span>
                <strong>Availability</strong>
                <span className="cx-muted">{site.maintenance_mode ? 'Maintenance mode: staff only' : 'Open to everyone'}</span>
              </span>
              <button type="button" className="cx-link-btn" onClick={() => go('site')}>Manage</button>
            </li>
            <li>
              <span className="cx-status-dot is-ok" aria-hidden="true" />
              <span>
                <strong>Accounts</strong>
                <span className="cx-muted">
                  {users.with_profile} with a profile · {users.google_or_x} use Google or X · {users.staff} staff
                </span>
              </span>
            </li>
          </ul>
        </Panel>
      </div>
    </>
  );
}
