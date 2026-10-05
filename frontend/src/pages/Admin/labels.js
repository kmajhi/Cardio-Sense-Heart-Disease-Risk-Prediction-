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

// No look-alikes (0/O, 1/l/I), so a password read out or copied by hand survives.
const PW_SETS = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '-_!@#%+?'];

/**
 * A strong random password for an administrator to hand to a doctor: `length`
 * characters with at least one of each kind, from the browser's crypto RNG.
 */
export function generatePassword(length = 14, random = (n) => crypto.getRandomValues(new Uint32Array(n))) {
  const all = PW_SETS.join('');
  const nums = random(length + PW_SETS.length);
  const chars = PW_SETS.map((set, i) => set[nums[i] % set.length]);
  for (let i = PW_SETS.length; i < length; i += 1) chars.push(all[nums[i] % all.length]);
  // Shuffle so the guaranteed kinds aren't always first (Fisher–Yates).
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = nums[length + (i % PW_SETS.length)] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

/** What's wrong with a new password before it is sent, or '' (the server checks too). */
export function passwordProblem(password, confirm) {
  if (password.length < 8) return 'Use at least 8 characters.';
  if (/^\d+$/.test(password)) return 'Use letters as well as numbers.';
  if (password !== confirm) return 'The two passwords don’t match.';
  return '';
}
