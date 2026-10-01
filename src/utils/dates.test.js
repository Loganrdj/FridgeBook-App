import { formatDate, daysUntil, todayString, formatShortDate, addDays, expiryStatus } from './dates';

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

describe('todayString', () => {
  it('uses the local date with zero padding', () => {
    expect(todayString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('formatShortDate', () => {
  const now = new Date(2026, 9, 1);
  it('drops the year for this year', () => {
    expect(formatShortDate('2026-10-02', now)).toBe('Oct 2');
    expect(formatShortDate('2027-01-15', now)).toBe('Jan 15, 2027');
    expect(formatShortDate('', now)).toBe('No date');
  });
});

describe('addDays', () => {
  it('counts calendar days across months', () => {
    expect(addDays(7, new Date(2026, 9, 28, 22, 0))).toBe('2026-11-04');
  });
});

describe('expiryStatus', () => {
  const now = new Date(2026, 9, 1, 9, 0);
  it.each([
    ['2026-09-28', 'expired', 'Expired 3 days ago'],
    ['2026-09-30', 'expired', 'Expired yesterday'],
    ['2026-10-01', 'today', 'Expires today'],
    ['2026-10-02', 'soon', 'Tomorrow'],
    ['2026-10-04', 'soon', 'In 3 days'],
    ['2026-10-06', 'ok', 'In 5 days'],
    ['2026-10-14', 'ok', 'In 13 days'],
    ['2026-10-20', 'ok', 'In 2 weeks'],
    ['2027-05-29', 'ok', 'In 8 months'],
    ['2027-11-05', 'ok', 'In over a year'],
    ['', 'none', 'No date']
  ])('%s -> %s "%s"', (value, tone, label) => {
    expect(expiryStatus(value, now)).toMatchObject({ tone, label });
  });
});
