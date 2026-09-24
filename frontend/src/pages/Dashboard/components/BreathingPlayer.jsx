import { useEffect, useRef, useState } from 'react';

// 4-7-8 breathing: breathe in for 4 s, hold for 7 s, breathe out for 8 s.
const PHASES = [
  { label: 'Breathe in', seconds: 4, scale: 1 },
  { label: 'Hold', seconds: 7, scale: 1 },
  { label: 'Breathe out', seconds: 8, scale: 0.55 },
];
const CYCLE = PHASES.reduce((sum, p) => sum + p.seconds, 0);

function phaseAt(elapsed) {
  let t = elapsed % CYCLE;
  for (const phase of PHASES) {
    if (t < phase.seconds) return phase;
    t -= phase.seconds;
  }
  return PHASES[0];
}

const clock = (secs) => {
  const s = Math.max(0, Math.ceil(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export default function BreathingPlayer({ cycles = 8 }) {
  const total = cycles * CYCLE;
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);

  useEffect(() => {
    if (!playing) return;
    const startedAt = Date.now() - elapsedRef.current * 1000;
    const id = setInterval(() => {
      const e = (Date.now() - startedAt) / 1000;
      if (e >= total) {
        elapsedRef.current = 0;
        setElapsed(0);
        setPlaying(false);
        return;
      }
      elapsedRef.current = e;
      setElapsed(e);
    }, 200);
    return () => clearInterval(id);
  }, [playing, total]);

  const phase = phaseAt(elapsed);
  const started = playing || elapsed > 0;

  return (
    <div className="pc-player pc-enter" style={{ '--d': '600ms', '--pc-rise': '60px' }}>
      <span
        className="pc-player-thumb"
        aria-hidden="true"
        style={
          started
            ? { transform: `scale(${phase.scale})`, transitionDuration: `${phase.seconds}s` }
            : undefined
        }
      />
      <div className="pc-player-text">
        <p className="pc-player-title">Guided breathing</p>
        <p className="pc-player-sub" aria-live="polite">
          {playing ? phase.label : '4-7-8 technique'}
        </p>
      </div>
      <span className="pc-player-time" aria-label={`${clock(total - elapsed)} remaining`}>
        -{clock(total - elapsed)}
      </span>
      <button
        type="button"
        className="pc-player-btn"
        onClick={() => setPlaying((p) => !p)}
        aria-label={playing ? 'Pause guided breathing' : 'Start guided breathing'}
      >
        {playing ? (
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <rect x="1.5" y="1" width="3" height="10" rx="1" />
            <rect x="7.5" y="1" width="3" height="10" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 1.3v9.4a.6.6 0 0 0 .9.5l7.4-4.7a.6.6 0 0 0 0-1L3.9.8a.6.6 0 0 0-.9.5Z" />
          </svg>
        )}
      </button>
    </div>
  );
}
