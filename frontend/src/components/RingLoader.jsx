import './RingLoader.css';

const BARS = 36;

/**
 * The Cardio Sense loading ring: 36 pill-shaped bars around a circle, each
 * flipping on its own axis (wide and dark face-on, a faint line edge-on), so
 * two waves travel around the ring. Pure CSS: sharp at any size.
 *
 * size: diameter in px. Decorative; the caller says what is loading
 * (role="status" text next to it).
 */
export default function RingLoader({ size = 120, className = '' }) {
  return (
    <span className={`rl-ring ${className}`} style={{ '--rl-size': `${size}px` }} aria-hidden="true">
      {Array.from({ length: BARS }, (_, i) => (
        <span key={i} className="rl-bar" style={{ '--i': i }}>
          <i />
        </span>
      ))}
    </span>
  );
}
