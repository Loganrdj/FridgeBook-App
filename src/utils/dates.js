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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "Oct 2", or "Oct 2, 2027" when it isn't this year
export function formatShortDate(value, now = new Date()) {
  const date = parseLocalDate(value);
  if (!date) return 'No date';
  const label = `${MONTHS[date.getMonth()]} ${date.getDate()}`;
  return date.getFullYear() === now.getFullYear() ? label : `${label}, ${date.getFullYear()}`;
}

// "YYYY-MM-DD" for the date `days` after today
export function addDays(days, now = new Date()) {
  return todayString(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days));
}

// How soon something expires, for badges: tone is expired | today | soon | ok | none
export function expiryStatus(value, now = new Date()) {
  const days = daysUntil(value, now);
  if (days === null) return { days, tone: 'none', label: 'No date' };
  if (days < -1) return { days, tone: 'expired', label: `Expired ${-days} days ago` };
  if (days === -1) return { days, tone: 'expired', label: 'Expired yesterday' };
  if (days === 0) return { days, tone: 'today', label: 'Expires today' };
  if (days === 1) return { days, tone: 'soon', label: 'Tomorrow' };
  if (days <= 3) return { days, tone: 'soon', label: `In ${days} days` };
  if (days <= 13) return { days, tone: 'ok', label: `In ${days} days` };
  if (days <= 59) return { days, tone: 'ok', label: `In ${Math.floor(days / 7)} weeks` };
  if (days < 365) return { days, tone: 'ok', label: `In ${Math.round(days / 30)} months` };
  return { days, tone: 'ok', label: 'In over a year' };
}
