import { useEffect, useState } from 'react';
import usePrefersReducedMotion from '../../Dashboard/hooks/usePrefersReducedMotion';

const easeOut = (t) => 1 - (1 - t) ** 3;

/** Counts from 0 to `value` once `start` is true. The real number is always in the accessible text. */
export default function CountUp({ value, start, digits = 0, suffix = '', duration = 1400, separator = true }) {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);

  useEffect(() => {
    if (!start || reduced) {
      if (reduced) setShown(value);
      return undefined;
    }
    let frame;
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min((now - t0) / duration, 1);
      setShown(value * easeOut(t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [start, value, duration, reduced]);

  const format = (n) =>
    separator ? n.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits }) : n.toFixed(digits);

  return (
    <>
      <span aria-hidden="true">
        {format(shown)}
        {suffix}
      </span>
      <span className="pc-visually-hidden">
        {format(value)}
        {suffix}
      </span>
    </>
  );
}
