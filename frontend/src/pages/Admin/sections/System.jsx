import { admin } from '../../../api/adminApi';
import { ErrorNote, Facts, Icon, Loading, PageHeader, Panel, Stat, StatusPill, fmtDateTime, fmtDuration, fmtNumber, useLoad } from '../ui';

const VERDICT = { ok: 'All systems normal', warn: 'Running, with items to review', fail: 'Something is failing' };

export default function System() {
  const { data, error, loading, reload } = useLoad(() => admin.system());
  if (loading && !data) return <Loading />;
  if (error && !data) return <ErrorNote error={error} onRetry={reload} />;
  const c = data.counts;

  return (
    <>
      <PageHeader
        title="System health"
        subtitle={`Server time ${fmtDateTime(data.server_time)} (${data.timezone}) · up ${fmtDuration(data.uptime_seconds)}`}
        actions={
          <>
            <a className="cx-btn" href={data.django_admin_url} target="_blank" rel="noreferrer">
              Open Django admin ↗
            </a>
            <button type="button" className="cx-btn is-primary" onClick={reload} disabled={loading}>
              <Icon name="refresh" size={15} />
              {loading ? 'Checking…' : 'Run checks again'}
            </button>
          </>
        }
      />
      <div className={`cx-verdict is-${data.status}`}>
        <span className={`cx-verdict-icon is-${data.status === 'fail' ? 'danger' : data.status}`}>
          <Icon name={data.status === 'ok' ? 'check' : 'system'} size={20} />
        </span>
        <div>
          <strong>{VERDICT[data.status]}</strong>
          <span className="cx-muted">
            {data.checks.filter((c) => c.status === 'ok').length} of {data.checks.length} checks passing · up {fmtDuration(data.uptime_seconds)}
          </span>
        </div>
      </div>

      <Panel title="Checks">
        <ul className="cx-checks">
          {data.checks.map((ch) => (
            <li key={ch.name}>
              <StatusPill status={ch.status} />
              <span className="cx-check-name">{ch.name}</span>
              <span className="cx-muted">{ch.detail}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="cx-stats">
        <Stat label="Users" value={fmtNumber(c.users)} />
        <Stat label="Assessments" value={fmtNumber(c.assessments)} />
        <Stat label="Activity events" value={fmtNumber(c.activity_events)} />
        <Stat label="Sessions" value={fmtNumber(c.sessions)} hint={`${fmtNumber(c.profiles)} profiles · ${fmtNumber(c.link_events)} link events`} />
      </div>

      <div className="cx-grid-2">
        <Panel title="Versions">
          <Facts
            items={[
              ...Object.entries(data.versions).map(([k, v]) => [k, v]),
              ['Branch', data.build.branch || '—'],
              ['Commit', data.build.commit ? <span className="cx-mono">{data.build.commit}</span> : '—'],
            ]}
          />
        </Panel>
        <Panel title="Configuration" subtitle="Read-only; set through environment variables">
          <Facts
            items={[
              ['Allowed hosts', data.config.allowed_hosts.join(', ')],
              ['Frontend URL', data.config.frontend_url],
              ['HTTPS redirect', data.config.https_redirect ? 'on' : 'off'],
              ['Session length', `${data.config.session_hours} hours`],
              ['Rate limits', Object.entries(data.config.throttle_rates).map(([k, v]) => `${k} ${v}`).join(' · ')],
              ['Maintenance mode', data.config.maintenance_mode ? 'ON' : 'off'],
            ]}
          />
        </Panel>
      </div>
    </>
  );
}
