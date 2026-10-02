// Decides whether a recipe ingredient is something the user already has.
// Names are compared as sets of simplified words, so "boneless chicken thighs"
// matches a kitchen item called "Chicken thighs", and "Milk (2%)" matches "milk".

// Assumed to be in every kitchen, so recipes never send you shopping for them
const STAPLES = new Set(["salt", "pepper", "black pepper", "water", "ice", "cooking oil", "vegetable oil", "oil"]);
// Words that don't change what a staple is ("freshly ground black pepper", "kosher salt")
const STAPLE_MODIFIERS = new Set(["ground", "fresh", "freshly", "cracked", "kosher", "sea", "table", "fine", "coarse", "cold", "warm", "hot", "neutral", "to", "taste", "for", "frying", "and"]);

function singular(word) {
  if (word.length > 4 && word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.length > 4 && /(ches|shes|sses|xes|oes)$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function words(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(singular);
}

const isSubset = (a, b) => a.length > 0 && a.every((w) => b.includes(w));

function matches(a, b) {
  const wa = words(a);
  const wb = words(b);
  return isSubset(wa, wb) || isSubset(wb, wa);
}

function isStaple(name) {
  const core = words(name).filter((word) => !STAPLE_MODIFIERS.has(word));
  // "salt and pepper" counts too
  return core.length > 0 && (STAPLES.has(core.join(" ")) || core.every((word) => STAPLES.has(word)));
}

// Returns a function: ingredient name -> true if the kitchen (or the staples) covers it
function haveChecker(kitchenNames) {
  return (ingredient) => isStaple(ingredient) || kitchenNames.some((name) => matches(name, ingredient));
}

module.exports = { words, matches, isStaple, haveChecker };
