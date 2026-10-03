// Plain helpers for console labels, kept out of the component files so Fast Refresh keeps working.

/**
 * [{level, below}] → "low under 35% · moderate 35–64% · high 65% and above", as
 * users see the bands. The last band's upper bound is only a sentinel (1.01).
 */
export function describeBands(bands) {
  return bands
    .map((b, i) => {
      const from = i === 0 ? null : Math.round(bands[i - 1].below * 100);
      const to = Math.round(b.below * 100);
      if (from === null) return `${b.level} under ${to}%`;
      if (i === bands.length - 1) return `${b.level} ${from}% and above`;
      return `${b.level} ${from}–${to - 1}%`;
    })
    .join(' · ');
}

// Room one date label ("Sep 28" at 11px) needs, gap included.
const LABEL_W = 46;

/**
 * Label every nth day so dates never run together on a narrow chart: as many
 * as fit in the plot's width, at most 7, counted back from the latest day so
 * "today" is always labelled.
 */
export function labelStep(days, plotWidth) {
  const fit = Math.max(2, Math.min(7, Math.floor(plotWidth / LABEL_W)));
  return Math.max(1, Math.ceil(days / fit));
}
