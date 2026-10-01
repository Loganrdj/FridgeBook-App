const MS_PER_DAY = 86400000;

// Parses "YYYY-MM-DD" (also accepts older ISO strings like "2026-10-02T00:00:00.000Z")
// as a local calendar date, so it doesn't shift a day in US time zones.
export function parseLocalDate(value) {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(value || '');
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

// "10/2/2026", or "No date" when the value is missing or invalid
export function formatDate(value) {
  const date = parseLocalDate(value);
  if (!date) return 'No date';
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

// Days until the date: 0 = today, 1 = tomorrow, negative = past, null = no date
export function daysUntil(value, now = new Date()) {
  const date = parseLocalDate(value);
  if (!date) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((date - today) / MS_PER_DAY);
}

// Today's local date as "YYYY-MM-DD"
export function todayString(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
