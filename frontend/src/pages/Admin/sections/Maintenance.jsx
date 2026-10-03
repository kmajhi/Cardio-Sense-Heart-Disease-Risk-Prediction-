import { useState } from 'react';
import { admin, download } from '../../../api/adminApi';
import { ConfirmDialog, ErrorNote, Loading, PageHeader, Panel, fmtNumber, useLoad, useToast } from '../ui';

const DESTRUCTIVE = new Set(['purge_orphans', 'purge_old_activity']);

export default function Maintenance() {
  const notify = useToast();
  const { data, error, loading, reload } = useLoad(() => admin.maintenance());
  const [running, setRunning] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [backingUp, setBackingUp] = useState(false);

  const run = async (task) => {
    setConfirm(null);
    setRunning(task);
    try {
      const res = await admin.runTask(task);
      notify(`${res.detail} (${res.seconds}s)`);
      reload();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setRunning('');
    }
  };

  const backup = async () => {
    setBackingUp(true);
    try {
      await download('/admin/backup/', {}, 'cardio-sense-backup.json');
      notify('Backup downloaded.');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBackingUp(false);
    }
  };

  return (
    <>
      <PageHeader title="Maintenance" subtitle="Housekeeping jobs. Each run is recorded in the activity log." />
      <ErrorNote error={error} onRetry={reload} />
      {loading && !data ? (
        <Loading />
      ) : (
        <Panel title="Tasks">
          <ul className="cx-tasks">
            {data?.map((t) => (
              <li key={t.task}>
                <div>
                  <strong>{t.label}</strong>
                  <span className="cx-muted">
                    {t.pending === null ? 'Runs instantly' : t.pending === 0 ? 'Nothing to clean up' : `${fmtNumber(t.pending)} to clean up`}
                  </span>
                </div>
                <button
                  type="button"
                  className={`cx-btn${DESTRUCTIVE.has(t.task) ? ' is-danger-soft' : ''}`}
                  disabled={Boolean(running) || t.pending === 0}
                  onClick={() => (DESTRUCTIVE.has(t.task) ? setConfirm(t) : run(t.task))}
                >
                  {running === t.task ? 'Running…' : 'Run'}
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="Backup" subtitle="Every account, profile and assessment as one JSON file. Password hashes are never included.">
        <div className="cx-actions-row">
          <button type="button" className="cx-btn is-primary" onClick={backup} disabled={backingUp}>
            {backingUp ? 'Preparing…' : 'Download full backup'}
          </button>
          <span className="cx-muted">It contains health data: store it encrypted and delete it when no longer needed.</span>
        </div>
      </Panel>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={`${confirm?.label}?`}
        body={<p>{fmtNumber(confirm?.pending)} record(s) will be deleted permanently.</p>}
        confirmLabel="Delete"
        onCancel={() => setConfirm(null)}
        onConfirm={() => run(confirm.task)}
      />
    </>
  );
}
