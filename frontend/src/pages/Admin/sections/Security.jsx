import { useState } from 'react';
import { admin } from '../../../api/adminApi';
import { DailyChart, RISK_COLORS } from '../charts';
import {
  Avatar, Badge, ConfirmDialog, DataTable, ErrorNote, Icon, KpiCard, PageHeader, Panel, Skeleton, fmtAgo, fmtDateTime,
  fmtNumber, useLoad, useToast,
} from '../ui';
import { ActivityList } from './Overview';

const IP_ALERT = 5; // same threshold as the server's alert

export default function Security({ openUser }) {
  const notify = useToast();
  const { data, error, loading, reload } = useLoad(() => admin.security());
  const [signOut, setSignOut] = useState(null);
  const [busy, setBusy] = useState(false);

  const endSessions = async () => {
    setBusy(true);
    try {
      const res = await admin.signOutUser(signOut.user_id);
      notify(res.detail);
      reload();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
      setSignOut(null);
    }
  };

  const header = (
    <PageHeader
      title="Security"
      subtitle="Sign-in attempts, suspicious addresses and who is signed in right now"
      actions={
        <button type="button" className="cx-btn" onClick={reload} disabled={loading}>
          <Icon name="refresh" size={15} />
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      }
    />
  );
  if (loading && !data) return (<>{header}<Skeleton kpis={4} rows={2} /></>);
  if (error && !data) return (<>{header}<ErrorNote error={error} onRetry={reload} /></>);
  const s = data.summary;
  const posture = s.suspicious_ips > 0 || s.failed_24h >= 10 ? 'danger' : s.failed_24h > 0 ? 'warn' : 'ok';

  return (
    <>
      {header}
      <div className={`cx-verdict is-${posture === 'danger' ? 'fail' : posture}`}>
        <span className={`cx-verdict-icon is-${posture}`}>
          <Icon name="security" size={20} />
        </span>
        <div>
          <strong>
            {posture === 'danger' ? 'Unusual sign-in activity' : posture === 'warn' ? 'Some failed sign-ins today' : 'No sign-in problems'}
          </strong>
          <span className="cx-muted">
            {posture === 'danger'
              ? 'One or more addresses keep failing to sign in. Review them below and consider deactivating targeted accounts.'
              : 'Failed logins are counted per address and account; 5 or more from one address in a week is flagged.'}
          </span>
        </div>
      </div>

      <div className="cx-kpis">
        <KpiCard label="Failed logins · 24 h" icon="security" tone={s.failed_24h >= 10 ? 'rose' : 'slate'} value={fmtNumber(s.failed_24h)} spark={data.trend.map((d) => d.failed)} hint={`${fmtNumber(s.failed_7d)} in the last 7 days`} />
        <KpiCard label="Suspicious addresses" icon="globe" tone={s.suspicious_ips ? 'rose' : 'teal'} value={fmtNumber(s.suspicious_ips)} hint={`${IP_ALERT}+ failures in 7 days`} />
        <KpiCard label="Open sessions" icon="users" tone="blue" value={fmtNumber(s.sessions)} spark={data.trend.map((d) => d.logins)} hint={`${s.signed_in_users} people signed in`} />
        <KpiCard label="Staff without a password" icon="bolt" tone={s.staff_without_password ? 'amber' : 'teal'} value={fmtNumber(s.staff_without_password)} hint="sign in with Google or X only" />
      </div>

      <Panel title="Sign-ins" subtitle="Last 14 days">
        <DailyChart
          title="Successful and failed sign-ins per day"
          series={data.trend}
          keys={[
            { key: 'logins', label: 'Signed in', color: '#6833e4' },
            { key: 'failed', label: 'Failed', color: RISK_COLORS.high },
          ]}
          height={170}
        />
      </Panel>

      <div className="cx-grid-2">
        <Panel title="Failed logins by address" subtitle="Last 7 days">
          <DataTable
            rows={data.by_ip}
            rowKey={(r) => r.ip}
            empty="No failed logins this week."
            columns={[
              { key: 'ip', label: 'Address', render: (r) => <span className="cx-mono">{r.ip}</span> },
              { key: 'count', label: 'Failures', align: 'right', render: (r) => (r.count >= IP_ALERT ? <Badge tone="danger">{r.count}</Badge> : r.count) },
              { key: 'accounts', label: 'Accounts tried', align: 'right' },
              { key: 'last', label: 'Last attempt', render: (r) => <span title={fmtDateTime(r.last)}>{fmtAgo(r.last)}</span> },
            ]}
          />
        </Panel>
        <Panel title="Most targeted accounts" subtitle="Last 7 days">
          <DataTable
            rows={data.by_email}
            rowKey={(r) => r.email}
            empty="No failed logins this week."
            columns={[
              { key: 'email', label: 'Email tried' },
              { key: 'count', label: 'Failures', align: 'right' },
              { key: 'last', label: 'Last attempt', render: (r) => <span title={fmtDateTime(r.last)}>{fmtAgo(r.last)}</span> },
            ]}
          />
        </Panel>
      </div>

      <div className="cx-grid-2">
        <Panel title="Signed in now" subtitle="Accounts with an open session">
          <DataTable
            rows={data.sessions}
            rowKey={(r) => r.user_id}
            onRowClick={(r) => openUser(r.user_id)}
            empty="Nobody is signed in."
            columns={[
              {
                key: 'user',
                label: 'User',
                render: (r) => (
                  <div className="cx-user-cell">
                    <Avatar name={r.name} email={r.email} size={28} />
                    <div className="cx-cell-main">
                      <strong>
                        {r.name} {r.is_staff && <Badge tone="violet">Staff</Badge>}
                      </strong>
                      <span className="cx-muted">{r.email}</span>
                    </div>
                  </div>
                ),
              },
              { key: 'sessions', label: 'Sessions', align: 'right' },
              { key: 'ip', label: 'Last address', render: (r) => <span className="cx-mono">{r.ip || '—'}</span> },
              { key: 'last', label: 'Signed in', render: (r) => fmtAgo(r.last_login) },
              {
                key: 'end',
                label: '',
                align: 'right',
                render: (r) => (
                  <button
                    type="button"
                    className="cx-btn is-small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSignOut(r);
                    }}
                  >
                    Sign out
                  </button>
                ),
              },
            ]}
          />
        </Panel>
        <Panel title="Recent sign-in events">
          <ActivityList events={data.recent} empty="No sign-ins yet." />
        </Panel>
      </div>

      <ConfirmDialog
        open={Boolean(signOut)}
        title={`Sign ${signOut?.name} out everywhere?`}
        body={<p>All {signOut?.sessions} open session(s) of {signOut?.email} end now. If that’s your own account, you’ll be signed out too.</p>}
        confirmLabel="Sign out"
        busy={busy}
        onCancel={() => setSignOut(null)}
        onConfirm={endSessions}
      />
    </>
  );
}
