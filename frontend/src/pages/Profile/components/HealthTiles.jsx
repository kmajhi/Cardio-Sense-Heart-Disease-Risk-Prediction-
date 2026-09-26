import { HISTORY, activityLabel, bmiBand, bmiFrom, smokerLabel } from '../profileFields';

// BMI scale shown on the gauge, and the WHO band edges inside it.
const LO = 15;
const HI = 40;
const BANDS = [
  { to: 18.5, tone: 'low', label: 'Under' },
  { to: 25, tone: 'ok', label: 'Healthy' },
  { to: 30, tone: 'low', label: 'Over' },
  { to: HI, tone: 'high', label: 'Obese' },
];
const at = (v) => ((Math.min(Math.max(v, LO), HI) - LO) / (HI - LO)) * 100;

function Tile({ id, title, icon, d, children, className = '' }) {
  return (
    <article className={`pc-p-tile pc-enter ${className}`} style={{ '--d': d }} aria-labelledby={id}>
      <header className="pc-p-tile-head">
        <span className="pc-p-tile-icon" aria-hidden="true">
          {icon}
        </span>
        <h2 id={id} className="pc-p-tile-title">
          {title}
        </h2>
      </header>
      {children}
    </article>
  );
}

const icon = (d) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

function BodyTile({ profile }) {
  const bmi = bmiFrom(profile.height_cm, profile.weight_kg);
  const band = bmiBand(bmi);
  return (
    <Tile id="p-body" title="Body" d="260ms" icon={icon('M12 4a2 2 0 1 0 0 .01M8 21l1-7-3-1 2-5h8l2 5-3 1 1 7')}>
      <div className="pc-p-body-stats">
        <div>
          <span>Height</span>
          <strong>
            {profile.height_cm === '' ? '—' : profile.height_cm}
            <small> cm</small>
          </strong>
        </div>
        <div>
          <span>Weight</span>
          <strong>
            {profile.weight_kg === '' ? '—' : profile.weight_kg}
            <small> kg</small>
          </strong>
        </div>
        <div>
          <span>BMI</span>
          <strong>{bmi === null ? '—' : bmi.toFixed(1)}</strong>
        </div>
      </div>

      <div className="pc-p-gauge" role="img" aria-label={bmi === null ? 'BMI not available' : `BMI ${bmi.toFixed(1)}, ${band.label}`}>
        <div className="pc-p-gauge-bar">
          {BANDS.map((b, i) => (
            <span
              key={b.label}
              className={`is-${b.tone}`}
              style={{ flexGrow: b.to - (i ? BANDS[i - 1].to : LO), '--i': i }}
            />
          ))}
        </div>
        {bmi !== null && <span className="pc-p-gauge-marker" style={{ '--at': `${at(bmi)}%` }} />}
        <div className="pc-p-gauge-labels" aria-hidden="true">
          {BANDS.map((b, i) => (
            <span key={b.label} style={{ flexGrow: b.to - (i ? BANDS[i - 1].to : LO) }}>
              {b.label}
            </span>
          ))}
        </div>
      </div>
      {band && <span className={`pc-p-chip is-${band.tone}`}>{band.label}</span>}
    </Tile>
  );
}

function HistoryTile({ profile }) {
  return (
    <Tile id="p-history" title="Medical history" d="320ms" icon={icon('M9 3h6v4H9zM6 5H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-1M9 13h6M12 10v6')}>
      <ul className="pc-p-flags">
        {HISTORY.map((h, i) => {
          const v = profile[h.key];
          const state = v === 1 ? 'yes' : v === 0 ? 'no' : 'unknown';
          return (
            <li key={h.key} className={`is-${state}`} style={{ '--i': i }}>
              <span>{h.label}</span>
              <b>{state === 'yes' ? 'Yes' : state === 'no' ? 'No' : 'Not set'}</b>
            </li>
          );
        })}
      </ul>
    </Tile>
  );
}

function Tags({ items, empty }) {
  if (!items.length) return <p className="pc-p-muted">{empty}</p>;
  return (
    <ul className="pc-p-tags">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

function LifestyleTile({ profile }) {
  return (
    <Tile id="p-life" title="Lifestyle & medications" d="380ms" icon={icon('M10.5 20.5 3.5 13.5a4.95 4.95 0 0 1 7-7l7 7a4.95 4.95 0 0 1-7 7ZM7 10l7 7')}>
      <dl className="pc-p-pairs">
        <div>
          <dt>Smoking</dt>
          <dd>{smokerLabel(profile.smoker) || '—'}</dd>
        </div>
        <div>
          <dt>Activity</dt>
          <dd>{activityLabel(profile.activity) || '—'}</dd>
        </div>
      </dl>
      <h3 className="pc-p-eyebrow">Medications</h3>
      <Tags items={profile.medications} empty="None listed" />
      <h3 className="pc-p-eyebrow">Allergies</h3>
      <Tags items={profile.allergies} empty="None listed" />
    </Tile>
  );
}

function EmergencyTile({ profile }) {
  const has = profile.emergency_name || profile.emergency_phone;
  return (
    <Tile id="p-sos" title="Emergency contact" d="440ms" className="pc-p-tile--sos" icon={icon('M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2')}>
      {has ? (
        <div className="pc-p-sos">
          <span className="pc-p-sos-avatar" aria-hidden="true">
            {(profile.emergency_name || '?').trim()[0]?.toUpperCase()}
          </span>
          <div>
            <strong>{profile.emergency_name || 'Unnamed contact'}</strong>
            <span>{profile.emergency_phone || 'No phone'}</span>
          </div>
          {profile.emergency_phone && (
            <a className="pc-p-call" href={`tel:${profile.emergency_phone.replace(/[^\d+]/g, '')}`} aria-label={`Call ${profile.emergency_name || 'emergency contact'}`}>
              {icon('M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2')}
            </a>
          )}
        </div>
      ) : (
        <p className="pc-p-muted">No emergency contact yet. Add one so it's on your report.</p>
      )}
    </Tile>
  );
}

/** Read-only view of the profile as four tiles. */
export default function HealthTiles({ profile }) {
  return (
    <div className="pc-p-tiles">
      <BodyTile profile={profile} />
      <HistoryTile profile={profile} />
      <LifestyleTile profile={profile} />
      <EmergencyTile profile={profile} />
    </div>
  );
}
