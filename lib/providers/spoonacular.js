// Spoonacular recipe search (free plan: about 50 points a day).
// Their terms only allow keeping recipe details for an hour, so callers may
// store just { provider, id, title, image, source_* } and fetch the rest again.
const BASE = "https://api.spoonacular.com";
const CACHE_MS = 60 * 60 * 1000; // the most their terms allow
const cache = new Map();

function cached(key) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  cache.delete(key);
  return undefined;
}
function remember(key, value) {
  if (cache.size > 300) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), value });
  return value;
}

// "0.5 cup", "2", "1 tbsp"
function amountText(ingredient) {
  const us = ingredient.measures && ingredient.measures.us;
  const amount = us ? us.amount : ingredient.amount;
  const unit = us ? us.unitShort : ingredient.unit;
  if (!amount) return "";
  const rounded = Math.round(amount * 100) / 100;
  return `${rounded}${unit ? ` ${unit}` : ""}`.trim();
}

function normalize(recipe) {
  const steps = ((recipe.analyzedInstructions || [])[0] || {}).steps || [];
  return {
    provider: "spoonacular",
    id: String(recipe.id),
    title: recipe.title,
    description: "",
    minutes: recipe.readyInMinutes || null,
    servings: recipe.servings || null,
    image: recipe.image || null,
    source_name: recipe.sourceName || "Spoonacular",
    source_url: recipe.sourceUrl || recipe.spoonacularSourceUrl || null,
    gluten_free: recipe.glutenFree === true,
    ingredients: (recipe.extendedIngredients || []).map((ing) => ({ name: ing.nameClean || ing.name, amount: amountText(ing) })),
    steps: steps.map((s) => s.step)
  };
}

class OutOfPoints extends Error {}

async function call(path, params) {
  const key = process.env.SPOONACULAR_API_KEY;
  if (!key) throw Object.assign(new Error("Spoonacular is not configured"), { status: 503 });
  const url = new URL(BASE + path);
  Object.entries({ ...params, apiKey: key }).forEach(([k, v]) => { if (v !== undefined && v !== "") url.searchParams.set(k, v); });
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  // 402: the day's points are used up
  if (res.status === 402) throw new OutOfPoints("Spoonacular daily points used up");
  if (!res.ok) throw Object.assign(new Error(`Spoonacular ${res.status}`), { status: res.status });
  return res.json();
}

/**
 * Real recipes for a dish name and/or ingredients. With no dish, prefers recipes
 * that use the most of the given ingredients.
 */
async function searchRecipes({ dish, ingredients = [], glutenFree = false, number = 3 }) {
  const key = JSON.stringify(["search", dish, [...ingredients].sort(), glutenFree, number]);
  const hit = cached(key);
  if (hit) return hit;
  const data = await call("/recipes/complexSearch", {
    query: dish || undefined,
    includeIngredients: dish ? undefined : ingredients.slice(0, 5).join(","),
    sort: dish ? undefined : "max-used-ingredients",
    intolerances: glutenFree ? "gluten" : undefined,
    addRecipeInformation: true,
    addRecipeInstructions: true,
    fillIngredients: true,
    instructionsRequired: true,
    number
  });
  return remember(key, (data.results || []).map(normalize));
}

async function getRecipe(id) {
  const key = `recipe:${id}`;
  const hit = cached(key);
  if (hit) return hit;
  return remember(key, normalize(await call(`/recipes/${encodeURIComponent(id)}/information`, { includeNutrition: false })));
}

module.exports = { searchRecipes, getRecipe, OutOfPoints, clearCache: () => cache.clear() };
