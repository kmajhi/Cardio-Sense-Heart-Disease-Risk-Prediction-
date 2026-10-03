// Admin console labels found wrong in the QA run of 3 Oct 2026.
import { describe, expect, it } from 'vitest';
import { describeBands, labelStep } from './labels';

describe('Model card risk bands (QA BUG-04)', () => {
  it('reads like the bands users see, never the 1.01 sentinel', () => {
    const bands = [
      { level: 'low', below: 0.35 },
      { level: 'moderate', below: 0.65 },
      { level: 'high', below: 1.01 },
    ];
    expect(describeBands(bands)).toBe('low under 35% · moderate 35–64% · high 65% and above');
  });
});

describe('Daily chart date labels (QA BUG-05)', () => {
  it('labels every day when there is room', () => {
    expect(labelStep(7, 560)).toBe(1);
  });

  it('labels fewer days on a phone-width chart, so they never run together', () => {
    const step = labelStep(7, 248); // a 360 px screen
    expect(step).toBeGreaterThan(1);
    expect(Math.ceil(7 / step) * 46).toBeLessThanOrEqual(248);
  });

  it('keeps at most 7 labels on long ranges', () => {
    expect(Math.ceil(90 / labelStep(90, 900))).toBeLessThanOrEqual(7);
  });
});
