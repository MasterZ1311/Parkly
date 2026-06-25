// ============================================================
// Tests — Pricing Service (Pure Function)
// Property-based + unit tests for getDemandMultiplier
// ============================================================

import { getDemandMultiplier } from '../index';


describe('getDemandMultiplier', () => {
  // Unit tests
  it('returns 1.0 for standard hours (Tuesday 14:00)', () => {
    const time = new Date('2024-01-02T14:00:00'); // Tuesday
    expect(getDemandMultiplier(time)).toBe(1.0);
  });

  it('returns 1.5 for weekday peak hours (Monday 08:30)', () => {
    const time = new Date('2024-01-01T08:30:00'); // Monday
    expect(getDemandMultiplier(time)).toBe(1.5);
  });

  it('returns 1.3 for weekend daytime (Saturday 13:00)', () => {
    const time = new Date('2024-01-06T13:00:00'); // Saturday
    expect(getDemandMultiplier(time)).toBe(1.3);
  });

  it('returns 0.8 for night hours (Wednesday 03:00)', () => {
    const time = new Date('2024-01-03T03:00:00'); // Wednesday
    expect(getDemandMultiplier(time)).toBe(0.8);
  });

  it('multiplier is always positive', () => {
    const times = [0, 6, 8, 12, 17, 20, 23].map(h => {
      const d = new Date('2024-01-01T00:00:00');
      d.setHours(h);
      return d;
    });
    times.forEach(t => {
      expect(getDemandMultiplier(t)).toBeGreaterThan(0);
    });
  });

  it('multiplier is never more than 2.0', () => {
    const times = [0, 6, 8, 12, 17, 20, 23].map(h => {
      const d = new Date('2024-01-01T00:00:00');
      d.setHours(h);
      return d;
    });
    times.forEach(t => {
      expect(getDemandMultiplier(t)).toBeLessThanOrEqual(2.0);
    });
  });
});
