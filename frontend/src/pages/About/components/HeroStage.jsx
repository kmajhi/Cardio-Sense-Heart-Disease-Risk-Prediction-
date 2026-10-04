import doctor from '../../../assets/about-doctor.webp';
import './HeroStage.css';

function Icon({ d, fill = false }) {
  return (
    <svg viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const DOC = 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5ZM14 3v5h5M9 13h6M9 17h4';
const STETH = 'M6 3v6a5 5 0 0 0 10 0V3M11 14v2a5 5 0 0 0 10 0v-2M21 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z';
const DROP = 'M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11Z';
const HEART = 'M12 20s-8-4.8-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6.2-8 11-8 11Z';
const PULSE = 'M3 12h4l2-6 4 12 2-6h6';

/**
 * The About hero's showcase, in the Dashboard's language: a deep violet orb
 * with rings, the doctor standing in front of it, and glass cards around her.
 * Each card is a real part of Cardio Sense (estimate, lab check, PDF report)
 * plus the doctor review that comes next, shown as pending. The doctor stands
 * for that coming review, not for anyone who has reviewed anything. Values are
 * an illustration (the caption says so); decorative for screen readers.
 */
export default function HeroStage() {
  return (
    <figure className="pc-a-stage" aria-hidden="true">
      <div className="pc-a-stage-scene">
        <span className="pc-a-stage-ring pc-a-stage-ring--outer" />
        <span className="pc-a-stage-orb" />
        <span className="pc-a-stage-ring pc-a-stage-ring--inner" />

        {/* A live ECG trace drawn across the orb */}
        <svg className="pc-a-stage-ecg" viewBox="0 0 400 80" preserveAspectRatio="none">
          <path d="M0 40h120l12-22 14 46 12-52 12 40 10-12h220" />
        </svg>

        <img className="pc-a-stage-doctor" src={doctor} alt="" />

        <div className="pc-a-card pc-a-card--risk" style={{ '--f': 0 }}>
          <p className="pc-a-card-eyebrow">
            <Icon d={PULSE} /> Model estimate
          </p>
          <p className="pc-a-card-big">
            42<small>%</small>
            <span className="pc-a-card-tag">Moderate</span>
          </p>
          <span className="pc-a-card-scale">
            <i style={{ left: '42%' }} />
          </span>
          <p className="pc-a-card-note">An estimate, not a diagnosis</p>
        </div>

        <div className="pc-a-card pc-a-card--doctor" style={{ '--f': 1 }}>
          <span className="pc-a-card-icon is-violet">
            <Icon d={STETH} />
          </span>
          <div>
            <p className="pc-a-card-title">Doctor’s review</p>
            <span className="pc-a-card-pending">
              <span className="pc-a-card-dot" /> Pending · coming next
            </span>
          </div>
        </div>

        <div className="pc-a-card pc-a-card--labs" style={{ '--f': 2 }}>
          <p className="pc-a-card-eyebrow">
            <Icon d={DROP} /> Lipid check
          </p>
          {[
            ['LDL', '135', 'is-warn', 64],
            ['HDL', '48', 'is-ok', 42],
            ['TG', '150', 'is-warn', 56],
          ].map(([name, value, tone, width]) => (
            <div key={name} className="pc-a-card-row">
              <span>{name}</span>
              <span className={`pc-a-card-bar ${tone}`}>
                <i style={{ width: `${width}%` }} />
              </span>
              <b>{value}</b>
            </div>
          ))}
        </div>

        <div className="pc-a-card pc-a-card--report" style={{ '--f': 3 }}>
          <span className="pc-a-card-icon">
            <Icon d={DOC} />
          </span>
          <div>
            <p className="pc-a-card-title">Health report</p>
            <p className="pc-a-card-note">PDF · ready to share</p>
          </div>
        </div>

        <span className="pc-a-stage-heart">
          <Icon d={HEART} fill />
        </span>
      </div>
      <figcaption className="pc-a-stage-caption">Illustrative values</figcaption>
    </figure>
  );
}
