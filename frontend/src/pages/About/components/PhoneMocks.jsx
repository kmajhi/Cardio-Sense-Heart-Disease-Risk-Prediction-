/**
 * Two phone mockups (the reference's "Modern App" pair), drawn in HTML:
 * the Prediction form, and the result it produces. Decorative only.
 */
function Slider({ label, value, unit, fill }) {
  return (
    <div className="pc-a-m-slider">
      <div>
        <span>{label}</span>
        <b>
          {value} <i>{unit}</i>
        </b>
      </div>
      <span className="pc-a-m-track">
        <span style={{ width: `${fill}%` }} />
      </span>
    </div>
  );
}

export default function PhoneMocks({ inView }) {
  const c = 2 * Math.PI * 30;
  return (
    <div className={`pc-a-phones${inView ? ' is-in' : ''}`} aria-hidden="true">
      <div className="pc-a-phone pc-a-phone--form">
        <span className="pc-a-notch" />
        <p className="pc-a-m-eyebrow">Patient profile</p>
        <div className="pc-a-m-seg">
          <span className="is-on">Male</span>
          <span>Female</span>
        </div>
        <Slider label="Age" value="52" unit="yrs" fill={43} />
        <Slider label="Blood pressure" value="122" unit="mmHg" fill={35} />
        <Slider label="LDL" value="104" unit="mg/dL" fill={32} />
        <div className="pc-a-m-trop">
          <span>Troponin-I</span>
          <b>
            5 <i>ng/L</i>
          </b>
          <em>High-sensitivity</em>
        </div>
        <span className="pc-a-m-btn">
          Run prediction <span>→</span>
        </span>
      </div>

      <div className="pc-a-phone pc-a-phone--result">
        <span className="pc-a-notch" />
        <p className="pc-a-m-eyebrow">Model estimate</p>
        <div className="pc-a-m-gauge">
          <svg viewBox="0 0 72 72">
            <circle cx="36" cy="36" r="30" className="pc-a-m-gauge-track" />
            <circle cx="36" cy="36" r="30" className="pc-a-m-gauge-arc" strokeDasharray={c} strokeDashoffset={c * 0.82} />
          </svg>
          <b>
            18<i>%</i>
          </b>
        </div>
        <span className="pc-a-m-badge">Low risk</span>
        <p className="pc-a-m-eyebrow">What moved it</p>
        {[
          ['LDL', 88],
          ['Total cholesterol', 56],
          ['Blood pressure', 40],
        ].map(([name, w]) => (
          <div key={name} className="pc-a-m-factor">
            <span>{name}</span>
            <span className="pc-a-m-bar">
              <span style={{ width: `${w}%` }} />
            </span>
          </div>
        ))}
        <p className="pc-a-m-note">Research prototype, not a diagnosis.</p>
      </div>
    </div>
  );
}
