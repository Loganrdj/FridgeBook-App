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

// Spoonacular's terms only allow keeping a recipe's id, title, image and link,
// so their recipes are saved as references and their details fetched again
export function forStorage(recipe) {
  if (recipe.provider !== 'spoonacular') return recipe;
  const { provider, id, title, image, source_name, source_url } = recipe;
  return { provider, id, title, image, source_name, source_url };
}

export function saveHistory(userId, batches) {
  if (!userId) return;
  try {
    const stored = batches.slice(0, MAX_BATCHES).map((batch) => ({ ...batch, recipes: batch.recipes.map(forStorage) }));
    localStorage.setItem(keyFor(userId), JSON.stringify(stored));
  } catch (e) {
    // storage full or blocked: history just won't survive a reload
  }
}

// Newest search first
export function addBatch(batches, batch) {
  return [batch, ...batches].slice(0, MAX_BATCHES);
}
