import CountUp from '../../About/components/CountUp';
import { HeartMark } from '../../Dashboard/components/NavBar';
import { PHOTO_ACCEPT, isPhoto } from '../photo';
import { ageFrom, bmiFrom, completeness, initials, sexLabel } from '../profileFields';

const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' });

/**
 * The dark "ID card" on the left: avatar, name, how complete the profile
 * is, and three quick stats. In edit mode it previews the draft live.
 */
export default function IdentityCard({ profile, ready, editing, onEdit, onDelete, onPhoto, photoBusy }) {
  const age = ageFrom(profile.date_of_birth);
  const bmi = bmiFrom(profile.height_cm, profile.weight_kg);
  const done = Math.round(completeness(profile) * 100);
  const meta = [age !== null && `${age} yrs`, sexLabel(profile.sex), profile.blood_group].filter(Boolean);

  return (
    <aside className="pc-p-id pc-enter" style={{ '--d': '200ms' }} aria-labelledby="p-id-name">
      <HeartMark className="pc-p-id-watermark" />

      <div className="pc-p-id-top">
        <div className="pc-p-avatar">
          <svg viewBox="0 0 120 120" className="pc-p-ring" aria-hidden="true">
            <circle cx="60" cy="60" r="54" className="pc-p-ring-track" />
            {done > 0 && <circle cx="60" cy="60" r="54" pathLength="100" className="pc-p-ring-arc" style={{ '--v': done }} />}
          </svg>
          <span className="pc-p-avatar-face" aria-hidden="true">
            {isPhoto(profile.photo) ? <img src={profile.photo} alt="" /> : initials(profile.full_name) || '?'}
          </span>
          {/* Quick photo change without opening the whole form. */}
          {!editing && onPhoto && (
            <label className={`pc-p-avatar-edit${photoBusy ? ' is-busy' : ''}`} title={isPhoto(profile.photo) ? 'Change photo' : 'Add photo'}>
              <input
                type="file"
                accept={PHOTO_ACCEPT}
                className="pc-visually-hidden"
                disabled={photoBusy}
                onChange={(e) => {
                  onPhoto(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <span className="pc-visually-hidden">{isPhoto(profile.photo) ? 'Change profile photo' : 'Add profile photo'}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M4 8h3l2-3h6l2 3h3v11H4V8Z" strokeLinejoin="round" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
            </label>
          )}
        </div>
        <span className="pc-p-complete">
          <CountUp value={done} start={ready} suffix="%" /> complete
        </span>
      </div>

      <h2 id="p-id-name" className="pc-p-id-name">
        {profile.full_name || 'Your name'}
      </h2>
      <p className="pc-p-id-meta">{meta.length ? meta.join(' · ') : 'Add your details to fill this card'}</p>
      {profile.email && <p className="pc-p-id-mail">{profile.email}</p>}

      <dl className="pc-p-id-stats">
        <div>
          <dt>Age</dt>
          <dd>{age ?? '—'}</dd>
        </div>
        <div>
          <dt>BMI</dt>
          <dd>{bmi === null ? '—' : bmi.toFixed(1)}</dd>
        </div>
        <div>
          <dt>Blood</dt>
          <dd>{profile.blood_group || '—'}</dd>
        </div>
      </dl>

      {!editing && (
        <div className="pc-p-id-actions">
          <button type="button" className="pc-p-btn pc-p-btn--light" onClick={onEdit}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M4 20h4L19 9l-4-4L4 16v4Z" strokeLinejoin="round" />
              <path d="m13.5 6.5 4 4" />
            </svg>
            Edit profile
          </button>
          <button type="button" className="pc-p-btn pc-p-btn--ghost-light" onClick={onDelete}>
            Delete
          </button>
        </div>
      )}

      {profile.created_at && (
        <p className="pc-p-id-since">Member since {monthFmt.format(new Date(profile.created_at))}</p>
      )}
    </aside>
  );
}
