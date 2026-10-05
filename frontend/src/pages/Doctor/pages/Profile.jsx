import { useId, useState } from 'react';
import { doctorApi } from '../../../api/doctorApi';
import { PHOTO_ACCEPT, isPhoto } from '../../Profile/photo';
import { Avatar, ConfirmDialog, ThemePicker, useToast } from '../ui';
import PhotoDialog from './PhotoDialog';
import { drName, fmtDate, fmtDateTime } from '../format';

/** Availability: whether new review requests can be accepted. */
export function AvailabilityToggle({ me, reloadMe }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const flip = async () => {
    setBusy(true);
    try {
      await doctorApi.setAvailable(!me.is_available);
      await reloadMe();
      toast(me.is_available ? 'You’re now unavailable for new reviews.' : 'You’re available for reviews.');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="dr-avail">
      <span className={`dr-badge ${me.is_available ? 'is-ok' : ''}`}>{me.is_available ? 'Available for reviews' : 'Unavailable'}</span>
      <button type="button" className="dr-btn is-secondary is-sm" onClick={flip} disabled={busy || !me.is_active}>
        {me.is_available ? 'Set unavailable' : 'Set available'}
      </button>
    </span>
  );
}

/** The doctor's own photo: add, change or remove. Shown in the panel and to patients they review. */
function PhotoSection({ me, reloadMe }) {
  const toast = useToast();
  const inputId = useId();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const has = isPhoto(me.photo);

  const save = async (photo, done) => {
    setBusy(true);
    try {
      await doctorApi.setPhoto(photo);
      await reloadMe();
      toast(done);
      setFile(null);
      setConfirmRemove(false);
    } catch (err) {
      toast(err.status === 400 ? err.message : 'We couldn’t save your photo. Please try again.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="dr-card dr-section" aria-labelledby="dr-photo-title">
      <div className="dr-section-head">
        <div>
          <h2 className="dr-h2" id="dr-photo-title">
            Profile photo
          </h2>
          <p>Shown in your Doctor Panel and to patients whose assessments you review.</p>
        </div>
      </div>
      <div className="dr-section-body dr-photo-row">
        <Avatar name={me.name} photo={me.photo} size={88} />
        <div className="dr-photo-actions">
          <input
            id={inputId}
            type="file"
            accept={PHOTO_ACCEPT}
            className="dr-sr dr-file"
            disabled={busy || !me.is_active}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              e.target.value = ''; // picking the same file again still opens the dialog
            }}
          />
          <label htmlFor={inputId} className={`dr-btn is-primary${busy || !me.is_active ? ' is-disabled' : ''}`}>
            {has ? 'Change photo' : 'Add photo'}
          </label>
          {has && (
            <button type="button" className="dr-btn is-secondary" disabled={busy || !me.is_active} onClick={() => setConfirmRemove(true)}>
              Remove photo
            </button>
          )}
          <p className="dr-help">JPG, PNG, WebP or GIF, up to 10 MB. It’s cropped to a square and stored small.</p>
        </div>
      </div>
      <PhotoDialog file={file} busy={busy} onSave={(photo) => save(photo, has ? 'Photo updated.' : 'Photo added.')} onCancel={() => setFile(null)} />
      <ConfirmDialog
        open={confirmRemove}
        title="Remove your photo?"
        confirmLabel="Remove photo"
        tone="primary"
        busy={busy}
        onConfirm={() => save('', 'Photo removed.')}
        onCancel={() => setConfirmRemove(false)}
      >
        <p>Your initials will be shown instead.</p>
      </ConfirmDialog>
    </section>
  );
}

export default function Profile({ me, reloadMe }) {
  const facts = [
    ['Name', drName(me.name)],
    ['Doctor ID', me.doctor_id],
    ['Specialty', me.specialty || 'Not provided'],
    ['Email', me.email],
    ['Phone', me.phone || 'Not provided'],
    ['Hospital / organization', me.organization || 'Not provided'],
    ['Professional registration', me.registration_number || 'Not provided'],
    [
      'Verification',
      me.verified ? `✓ Verified${me.verified_at ? ` on ${fmtDate(me.verified_at)}` : ''}` : 'Not yet verified by an administrator',
    ],
    ['Account status', me.is_active ? 'Active' : 'Inactive'],
    ['Last sign-in', fmtDateTime(me.last_login)],
    ['Active reviews', String(me.active_reviews)],
    ['Completed reviews', String(me.completed_reviews)],
  ];
  return (
    <>
      <div className="dr-page-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar name={me.name} photo={me.photo} size={56} />
          <div>
            <h1 className="dr-h1">Doctor Profile</h1>
            <p className="dr-sub">
              {drName(me.name)} · {me.doctor_id}
            </p>
          </div>
        </div>
        <AvailabilityToggle me={me} reloadMe={reloadMe} />
      </div>
      <PhotoSection me={me} reloadMe={reloadMe} />
      <section className="dr-card dr-section" aria-labelledby="dr-appearance">
        <div className="dr-section-head">
          <div>
            <h2 className="dr-h2" id="dr-appearance">
              Appearance
            </h2>
            <p>Day or night mode for the Doctor Panel, or follow your device. Remembered on this browser.</p>
          </div>
          <ThemePicker />
        </div>
      </section>
      <section className="dr-card dr-section">
        <div className="dr-section-head">
          <div>
            <h2 className="dr-h2">Professional details</h2>
            <p>Kept by Cardio Sense administrators. Ask an administrator to correct anything here.</p>
          </div>
        </div>
        <div className="dr-section-body">
          <dl className="dr-facts">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd className={k === 'Verification' && me.verified ? 'dr-status-text is-ok' : undefined}>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
