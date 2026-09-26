import { useEffect, useState } from 'react';
import LocationFields, { LOCATION_KEYS } from '../../../location/LocationFields';
import { countryByCode } from '../../../location/countries';
import { utcOffset } from '../../../api/geocodeApi';
import { validate } from '../profileFields';

const pick = (obj) => Object.fromEntries(LOCATION_KEYS.map((k) => [k, obj[k] ?? '']));

function useLocalTime(timeZone) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!timeZone) return '';
  try {
    return new Intl.DateTimeFormat(undefined, { weekday: 'long', hour: 'numeric', minute: '2-digit', timeZone }).format(now);
  } catch {
    return '';
  }
}

/**
 * Settings → Location & time zone. A quick way to set country, state and city
 * without opening the whole profile form; saves just those fields.
 */
export default function LocationSettings({ profile, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => pick(profile));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const localTime = useLocalTime(profile.timezone);
  const country = countryByCode(profile.country_code);
  const place = [profile.city, profile.state, profile.country].filter(Boolean).join(', ');

  const start = () => {
    setDraft(pick(profile));
    setErrors({});
    setEditing(true);
  };

  const save = async (e) => {
    e.preventDefault();
    const next = { ...profile, ...draft, city: draft.city.trim(), state: draft.state.trim() };
    const found = validate(next);
    const locationErrors = { country: found.country, city: found.city };
    if (found.country || found.city) {
      setErrors(locationErrors);
      return;
    }
    setSaving(true);
    try {
      await onSave(pick(next));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="pc-p-card pc-p-settings pc-enter" style={{ '--d': '420ms' }} aria-labelledby="p-settings-title">
      <header className="pc-p-card-head">
        <span className="pc-p-tile-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" strokeLinejoin="round" />
            <circle cx="12" cy="9.5" r="2.5" />
          </svg>
        </span>
        <div>
          <p className="pc-p-settings-eyebrow">Settings</p>
          <h2 id="p-settings-title" className="pc-p-tile-title">
            Location &amp; time zone
          </h2>
        </div>
        {!editing && (
          <button type="button" className="pc-p-btn pc-p-btn--soft pc-p-btn--sm pc-p-settings-edit" onClick={start}>
            {place ? 'Change' : 'Set location'}
          </button>
        )}
      </header>

      {editing ? (
        <form className="pc-p-settings-form" onSubmit={save} noValidate>
          <LocationFields
            value={draft}
            update={(patch) => setDraft((d) => ({ ...d, ...(typeof patch === 'function' ? patch(d) : patch) }))}
            errors={errors}
            idPrefix="ls"
          />
          <div className="pc-p-modal-foot">
            <button type="button" className="pc-p-btn pc-p-btn--soft" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className={`pc-p-btn pc-p-btn--dark${saving ? ' is-busy' : ''}`} disabled={saving}>
              {saving ? 'Saving…' : 'Save location'}
            </button>
          </div>
        </form>
      ) : place ? (
        <dl className="pc-p-settings-list">
          <div>
            <dt>Location</dt>
            <dd>
              {country && (
                <span className="pc-p-settings-flag" aria-hidden="true">
                  {country.flag}
                </span>
              )}
              {place}
            </dd>
          </div>
          <div>
            <dt>Time zone</dt>
            <dd>
              {profile.timezone ? `${profile.timezone} · ${utcOffset(profile.timezone)}` : '—'}
            </dd>
          </div>
          <div>
            <dt>Local time</dt>
            <dd>{localTime || '—'}</dd>
          </div>
        </dl>
      ) : (
        <p className="pc-p-hint">
          Not set. Add your country (and city) so the date and weather in the top bar match where you are. Until then,
          Dhaka is used.
        </p>
      )}
    </section>
  );
}
