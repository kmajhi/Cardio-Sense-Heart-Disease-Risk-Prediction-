// Numbers behind the History overview board, worked out once from the records.
import { TESTS, reading, status } from './tests';

export const LEVELS = {
  low: { label: 'Low risk', className: 'is-low' },
  moderate: { label: 'Moderate risk', className: 'is-moderate' },
  high: { label: 'High risk', className: 'is-high' },
};

// Same bands as the backend's RISK_BANDS (prediction_service.py).
export const BANDS = [
  { at: 35, label: 'Moderate' },
  { at: 65, label: 'High' },
];

export const STATUS = {
  ok: 'In range',
  high: 'Above range',
  low: 'Below range',
  missing: 'Not measured',
};

export const pct = (record) => Math.round(record.result.probability * 100);

/** Every test in one record with its reading and status. */
export const panel = (record) =>
  TESTS.map((test) => {
    const r = reading(test, record.inputs);
    return { test, r, st: status(r) };
  });

/** How many tests of the panel fall in each status, in a fixed order. */
export function statusCounts(rows) {
  return Object.keys(STATUS)
    .map((key) => ({ key, label: STATUS[key], count: rows.filter((row) => row.st === key).length }))
    .filter((s) => s.count > 0);
}

/** Per test group: how many results sit outside the typical range. */
export function groupSummary(rows) {
  const groups = [...new Set(rows.map((row) => row.test.group))];
  return groups.map((group) => {
    const inGroup = rows.filter((row) => row.test.group === group);
    const flagged = inGroup.filter((row) => row.st === 'high' || row.st === 'low').length;
    return { group, total: inGroup.length, flagged };
  });
}
