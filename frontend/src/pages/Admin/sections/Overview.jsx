import { admin } from '../../../api/adminApi';
import { AssessmentsChart, RiskMix, SignupsChart } from '../charts';
import { Badge, ErrorNote, Loading, PageHeader, Panel, Stat, fmtAgo, fmtNumber, useLoad } from '../ui';

const KIND_TONE = { login_failed: 'danger', admin: 'violet', maintenance: 'violet', signup: 'ok', account_deleted: 'warn' };

export function ActivityList({ events, empty = 'No activity yet.' }) {
  if (!events?.length) return <p className="ad-muted">{empty}</p>;
  return (
    <ul className="ad-feed">
      {events.map((e) => (
        <li key={e.id}>
          <Badge tone={KIND_TONE[e.kind] ?? 'neutral'}>{e.kind_label}</Badge>
          <span className="ad-feed-text">{e.summary}</span>
          <time className="ad-muted" dateTime={e.created_at} title={new Date(e.created_at).toLocaleString()}>
            {fmtAgo(e.created_at)}
          </time>
        </li>
      ))}
    </ul>
  );
}

export default function Overview({ go }) {
  const { data, error, loading, reload } = useLoad(() => admin.overview());

  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorNote error={error} onRetry={reload} />;
  const { users, assessments, security, series, site, model } = data;
  const lowConfShare = assessments.total ? assessments.low_confidence / assessments.total : 0;

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle={`Live figures for Cardio Sense · updated ${fmtAgo(data.generated_at)}`}
        actions={
          <button type="button" className="ad-btn" onClick={reload} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        }
      />

      {(site.maintenance_mode || !site.registration_open || !site.predictions_open || site.announcement) && (
        <div className="ad-callout">
          <strong>Site controls are active:</strong>{' '}
          {[
            site.maintenance_mode && 'maintenance mode is on',
            !site.registration_open && 'registration is paused',
            !site.predictions_open && 'predictions are paused',
            site.announcement && 'an announcement is showing',
          ]
            .filter(Boolean)
            .join(' · ')}
          .{' '}
          <button type="button" className="ad-link-btn" onClick={() => go('site')}>
            Manage
          </button>
        </div>
      )}

      <div className="ad-stats">
        <Stat label="Users" value={fmtNumber(users.total)} hint={`${users.new_7d} new this week · ${users.active_7d} active`} />
        <Stat label="Assessments" value={fmtNumber(assessments.total)} hint={`${assessments.today} today · ${assessments.last_7d} this week`} />
        <Stat
          label="Low-confidence estimates"
          value={`${Math.round(lowConfShare * 100)}%`}
          hint={`${assessments.low_confidence} with labs missing or out of range`}
          tone={lowConfShare > 0.3 ? 'warn' : undefined}
        />
        <Stat
          label="Failed logins (24 h)"
          value={fmtNumber(security.failed_logins_24h)}
          hint={`${security.sessions_active} active sessions`}
          tone={security.failed_logins_24h >= 10 ? 'danger' : undefined}
        />
      </div>

      <div className="ad-grid-2">
        <Panel title="Assessments" subtitle="Last 30 days">
          <AssessmentsChart series={series} />
        </Panel>
        <Panel title="Risk mix" subtitle="All assessments">
          <RiskMix risk={assessments.risk} />
          <h3 className="ad-h3">What most often raised estimates</h3>
          {data.top_raising_factors.length ? (
            <ol className="ad-rank">
              {data.top_raising_factors.map((f) => (
                <li key={f.name}>
                  <span>{f.name}</span>
                  <span className="ad-muted">{f.count}×</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="ad-muted">No assessments in the last 30 days.</p>
          )}
        </Panel>
      </div>

      <div className="ad-grid-2">
        <Panel title="Recent activity" actions={<button type="button" className="ad-link-btn" onClick={() => go('activity')}>Open log →</button>}>
          <ActivityList events={data.recent_activity} />
        </Panel>
        <div className="ad-stack">
          <Panel title="Sign-ups" subtitle="Last 30 days">
            <SignupsChart series={series} />
          </Panel>
          <Panel title="Model" actions={<button type="button" className="ad-link-btn" onClick={() => go('model')}>Model card →</button>}>
            <p className="ad-model-line">
              <Badge tone={model.loaded ? 'ok' : 'neutral'}>{model.loaded ? 'Loaded' : 'Loads on first use'}</Badge>
              <span>
                {model.name || 'No model'} · trained {model.trained_at ? new Date(model.trained_at).toLocaleDateString() : '—'}
              </span>
            </p>
            <p className="ad-muted">
              {users.with_profile} users have a profile · {users.google_or_x} sign in with Google or X · {users.staff} staff
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
