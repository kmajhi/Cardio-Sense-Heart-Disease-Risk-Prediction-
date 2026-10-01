import { useEffect, useState } from 'react';
import { admin } from '../../../api/adminApi';
import { ConfirmDialog, ErrorNote, Loading, PageHeader, Panel, Toggle, fmtDateTime, useLoad, useToast } from '../ui';

export default function SiteControls({ onSaved }) {
  const notify = useToast();
  const { data, error, loading, reload } = useLoad(() => admin.settings());
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmMaintenance, setConfirmMaintenance] = useState(false);
  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const save = async (patch) => {
    setSaving(true);
    try {
      const saved = await admin.saveSettings(patch);
      setDraft(saved);
      notify('Site settings saved.');
      onSaved?.();
      reload();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !draft) return <Loading />;
  if (error && !draft) return <ErrorNote error={error} onRetry={reload} />;
  if (!draft) return null;
  const set = (k) => (v) => setDraft((d) => ({ ...d, [k]: v }));
  const textChanged = draft.announcement !== data.announcement || draft.announcement_level !== data.announcement_level || draft.maintenance_message !== data.maintenance_message;

  return (
    <>
      <PageHeader title="Site controls" subtitle={data.updated_by ? `Last changed by ${data.updated_by}, ${fmtDateTime(data.updated_at)}` : 'Switches that apply to every visitor'} />

      <Panel title="Availability" subtitle="Changes apply immediately (within about 10 seconds).">
        <div className="ad-toggles">
          <Toggle
            label="Maintenance mode"
            hint="Only staff can use the app. Everyone else sees the maintenance message."
            checked={draft.maintenance_mode}
            disabled={saving}
            onChange={(on) => (on ? setConfirmMaintenance(true) : save({ maintenance_mode: false }))}
          />
          <Toggle
            label="New accounts"
            hint="When off, the register form explains that sign-up is paused."
            checked={draft.registration_open}
            disabled={saving}
            onChange={(on) => save({ registration_open: on })}
          />
          <Toggle
            label="Predictions"
            hint="When off, users can browse and see their history but can’t run new estimates."
            checked={draft.predictions_open}
            disabled={saving}
            onChange={(on) => save({ predictions_open: on })}
          />
        </div>
      </Panel>

      <Panel title="Messages">
        <label className="ad-field">
          <span>Announcement banner (empty = no banner)</span>
          <input value={draft.announcement} maxLength={300} onChange={(e) => set('announcement')(e.target.value)} placeholder="e.g. A new model version is live from 1 October." />
        </label>
        <div className="ad-segment" role="radiogroup" aria-label="Banner style">
          {[
            ['info', 'Information'],
            ['warning', 'Warning'],
            ['critical', 'Critical'],
          ].map(([v, l]) => (
            <label key={v} className={`ad-segment-item is-${v}${draft.announcement_level === v ? ' is-on' : ''}`}>
              <input type="radio" name="level" value={v} checked={draft.announcement_level === v} onChange={() => set('announcement_level')(v)} />
              {l}
            </label>
          ))}
        </div>
        {draft.announcement && <div className={`ad-banner-preview is-${draft.announcement_level}`}>{draft.announcement}</div>}
        <label className="ad-field">
          <span>Maintenance message</span>
          <input value={draft.maintenance_message} maxLength={300} onChange={(e) => set('maintenance_message')(e.target.value)} />
        </label>
        <div className="ad-actions-row">
          <button
            type="button"
            className="ad-btn is-primary"
            disabled={saving || !textChanged}
            onClick={() => save({ announcement: draft.announcement, announcement_level: draft.announcement_level, maintenance_message: draft.maintenance_message })}
          >
            {saving ? 'Saving…' : 'Save messages'}
          </button>
          {textChanged && (
            <button type="button" className="ad-btn" onClick={() => setDraft(data)}>
              Discard changes
            </button>
          )}
        </div>
      </Panel>

      <ConfirmDialog
        open={confirmMaintenance}
        title="Turn on maintenance mode?"
        body={<p>Everyone except staff will be blocked from the app and see: “{draft.maintenance_message}”</p>}
        confirmLabel="Turn on"
        tone="danger"
        busy={saving}
        onCancel={() => setConfirmMaintenance(false)}
        onConfirm={() => {
          setConfirmMaintenance(false);
          save({ maintenance_mode: true });
        }}
      />
    </>
  );
}
