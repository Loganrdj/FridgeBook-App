import { formatDate, daysUntil } from './dates';

describe('formatDate', () => {
  it('shows the date the user picked, with a 1-based month', () => {
    expect(formatDate('2026-10-02')).toBe('10/2/2026');
    expect(formatDate('2026-10-15')).toBe('10/15/2026');
  });

  it('handles older ISO timestamps', () => {
    expect(formatDate('2026-10-02T00:00:00.000Z')).toBe('10/2/2026');
  });

  it('says so when there is no date', () => {
    expect(formatDate('')).toBe('No date');
    expect(formatDate(undefined)).toBe('No date');
  });
});

describe('daysUntil', () => {
  const now = new Date(2026, 9, 1, 15, 30); // Oct 1 2026, 3:30pm local

  it('counts calendar days regardless of the time of day', () => {
    expect(daysUntil('2026-10-01', now)).toBe(0);
    expect(daysUntil('2026-10-02', now)).toBe(1);
    expect(daysUntil('2026-09-30', now)).toBe(-1);
    expect(daysUntil('2026-11-01', now)).toBe(31);
  });

  it('returns null when there is no date', () => {
    expect(daysUntil('', now)).toBeNull();
  });
});
