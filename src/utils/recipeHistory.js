// Recipe searches saved on this device, per account, for the current day only:
// tomorrow's expiring food is different, so the history starts fresh at midnight.
const MAX_BATCHES = 10;
const keyFor = (userId) => `recipeHistory:${userId}`;

export function loadHistory(userId, today) {
  if (!userId) return [];
  try {
    const saved = JSON.parse(localStorage.getItem(keyFor(userId)));
    return Array.isArray(saved) ? saved.filter((batch) => batch.day === today) : [];
  } catch (e) {
    return [];
  }
}

export function saveHistory(userId, batches) {
  if (!userId) return;
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(batches.slice(0, MAX_BATCHES)));
  } catch (e) {
    // storage full or blocked: history just won't survive a reload
  }
}

// Newest search first
export function addBatch(batches, batch) {
  return [batch, ...batches].slice(0, MAX_BATCHES);
}
