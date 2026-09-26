import { describe, expect, it } from 'vitest';
import { refreshDelay, timeAgo } from './time';

const at = '2026-09-26T12:00:00Z';
const after = (ms) => new Date(at).getTime() + ms;

describe('timeAgo', () => {
  it.each([
    [0, 'just now'],
    [1_000, '1 sec ago'],
    [30_000, '30 sec ago'],
    [59_999, '59 sec ago'],
    [60_000, '1 min ago'],
    [5 * 60_000, '5 min ago'],
    [3 * 3_600_000, '3 h ago'],
    [86_400_000, '1 day ago'],
    [2 * 86_400_000, '2 days ago'],
  ])('%i ms → %s', (ms, label) => {
    expect(timeAgo(at, after(ms))).toBe(label);
  });

  it('shows a date after a week, never a future time, and nothing for bad input', () => {
    expect(timeAgo(at, after(10 * 86_400_000))).toMatch(/^on /);
    expect(timeAgo(at, after(-2_000))).toBe('just now');
    expect(timeAgo('not a date')).toBe('');
  });

  it('refreshes every second for the first minute, then every 30 s', () => {
    expect(refreshDelay(at, after(5_000))).toBe(1000);
    expect(refreshDelay(at, after(90_000))).toBe(30_000);
  });
});
