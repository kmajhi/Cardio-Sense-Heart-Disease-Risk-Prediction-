import { useState } from 'react';
import { doctorApi } from '../../../api/doctorApi';
import { Avatar, useToast } from '../ui';
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
          <Avatar name={me.name} size={56} />
          <div>
            <h1 className="dr-h1">Doctor Profile</h1>
            <p className="dr-sub">
              {drName(me.name)} · {me.doctor_id}
            </p>
          </div>
        </div>
        <AvailabilityToggle me={me} reloadMe={reloadMe} />
      </div>
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
