const { test, before, after, beforeEach, describe } = require("node:test");
const assert = require("node:assert/strict");
const { startApp } = require("./helpers");

let t, gemini, spoon, web, recipeRoutes;
const real = {};
let geminiCalls, webCalls;
const day = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const spoonRecipe = {
  provider: "spoonacular", id: "715415", title: "Classic Ratatouille", description: "", minutes: 75, servings: 4,
  image: "https://img.spoonacular.com/recipes/715415-556x370.jpg", source_name: "Serious Eats",
  source_url: "https://www.seriouseats.com/ratatouille", gluten_free: true,
  ingredients: [{ name: "eggplant", amount: "1" }, { name: "zucchini", amount: "2" }, { name: "canned tomatoes", amount: "1 can" }, { name: "salt", amount: "1 tsp" }],
  steps: ["Salt and drain the eggplant.", "Layer the vegetables and bake."]
};

before(async () => {
  t = await startApp();
  gemini = require("../../lib/gemini");
  spoon = require("../../lib/providers/spoonacular");
  web = require("../../lib/providers/openaiSearch");
  recipeRoutes = require("../../routes/recipeRoutes");
  Object.assign(real, { generateJson: gemini.generateJson, searchRecipes: spoon.searchRecipes, getRecipe: spoon.getRecipe, webSearch: web.webSearch });
});
after(async () => {
  Object.assign(gemini, { generateJson: real.generateJson });
  Object.assign(spoon, { searchRecipes: real.searchRecipes, getRecipe: real.getRecipe });
  web.webSearch = real.webSearch;
  delete process.env.SPOONACULAR_API_KEY;
  delete process.env.OPENAI_API_KEY;
  await t.stop();
});
beforeEach(() => {
  geminiCalls = []; webCalls = [];
  process.env.SPOONACULAR_API_KEY = "spoon-test";
  process.env.OPENAI_API_KEY = "openai-test";
  spoon.searchRecipes = async () => [spoonRecipe];
  spoon.getRecipe = async () => spoonRecipe;
  web.webSearch = async (prompt) => { webCalls.push(prompt); return { text: "notes", citations: [{ url: "https://www.bbcgoodfood.com/recipes/ratatouille", title: "BBC Good Food" }] }; };
  gemini.generateJson = async (args) => { geminiCalls.push(args); return { data: { recipes: [] } }; };
  recipeRoutes.clearCache();
});

async function aliceWith(items) {
  const login = await t.login("Alice");
  for (const [name, days] of items) {
    await t.request("POST", "/api/ingredient", { cookie: login.cookie, body: { name, quantity: 1, date_expire: day(days), fridge_bool: true } });
  }
  return login;
}
const suggest = (cookie, body) => t.request("POST", "/api/recipes/suggest", { cookie, body: { local_date: day(0), ...body } });

describe("Spoonacular first", () => {
  test("returns real recipes with their source, marked against the kitchen, without calling AI", async () => {
    const { cookie } = await aliceWith([["Canned tomatoes", 300]]);
    const res = await suggest(cookie, { dish: "Ratatouille" });
    assert.equal(res.status, 200);
    assert.equal(res.body.provider, "spoonacular");
    const [r] = res.body.recipes;
    assert.deepEqual([r.id, r.source_name, r.source_url, r.image], ["715415", "Serious Eats", "https://www.seriouseats.com/ratatouille", spoonRecipe.image]);
    assert.deepEqual(r.ingredients.map((i) => [i.name, i.have]), [["eggplant", false], ["zucchini", false], ["canned tomatoes", true], ["salt", true]]);
    assert.equal(geminiCalls.length + webCalls.length, 0);
  });

  test("passes the dish, or the kitchen's soonest-expiring items", async () => {
    let args;
    spoon.searchRecipes = async (a) => { args = a; return [spoonRecipe]; };
    const { cookie } = await aliceWith([["Spinach", 1], ["Milk", 0]]);
    await suggest(cookie, {});
    assert.deepEqual(args, { dish: "", ingredients: ["milk", "spinach"] });
    recipeRoutes.clearCache();
    await suggest(cookie, { dish: "pad thai" });
    assert.equal(args.dish, "pad thai");
  });
});

describe("falling back to web search", () => {
  test("keeps only recipes whose link the search actually cited", async () => {
    spoon.searchRecipes = async () => { throw new spoon.OutOfPoints("out"); };
    gemini.generateJson = async (args) => {
      geminiCalls.push(args);
      return { data: { recipes: [
        { title: "Ratatouille", description: "Classic.", minutes: 60, servings: 4, ingredients: [{ name: "eggplant", amount: "1" }], steps: ["Roast."], source_name: "BBC Good Food", source_url: "https://bbcgoodfood.com/recipes/ratatouille/?utm=x" },
        { title: "Made-up", description: "", minutes: 10, servings: 1, ingredients: [{ name: "x", amount: "1" }], steps: ["y"], source_name: "Nowhere", source_url: "https://invented.example.com/recipe" }
      ] } };
    };
    const { cookie, user } = await aliceWith([["Rice", 100]]);
    const res = await suggest(cookie, { dish: "ratatouille" });
    assert.equal(res.status, 200);
    assert.equal(res.body.provider, "web");
    assert.deepEqual(res.body.recipes.map((r) => r.title), ["Ratatouille"]);
    assert.match(webCalls[0], /real, published recipes for ratatouille/);
    assert.match(geminiCalls[0].prompt, /https:\/\/www\.bbcgoodfood\.com\/recipes\/ratatouille/);
    const usage = await t.db.AiUsages.findOne({ where: { UserId: user.id, kind: "web" } });
    assert.equal(usage.count, 1);
  });

  test("respects the per-user daily cap on paid searches, then lets Gemini write recipes", async () => {
    spoon.searchRecipes = async () => [];
    gemini.generateJson = async (args) => { geminiCalls.push(args); return { data: { recipes: [{ title: "AI ratatouille", description: "", minutes: 50, servings: 2, ingredients: [{ name: "eggplant", amount: "1" }], steps: ["Cook."] }] } }; };
    const { cookie, user } = await aliceWith([["Rice", 100]]);
    await t.db.AiUsages.create({ UserId: user.id, kind: "web", day: day(0), count: 5 });
    const res = await suggest(cookie, { dish: "ratatouille" });
    assert.equal(res.body.provider, "ai");
    assert.equal(webCalls.length, 0);
    assert.equal(res.body.recipes[0].source_url, null);
    assert.match(geminiCalls[0].system, /authentic versions of that dish with its real, traditional ingredients/);
  });

  test("respects the monthly total across all users", async () => {
    spoon.searchRecipes = async () => [];
    const bob = await t.login("Bob");
    await t.db.AiUsages.create({ UserId: bob.user.id, kind: "web", day: day(0), count: 300 });
    const { cookie } = await aliceWith([["Rice", 100]]);
    await suggest(cookie, { dish: "paella" });
    assert.equal(webCalls.length, 0);
  });

  test("with no keys configured, goes straight to Gemini", async () => {
    delete process.env.SPOONACULAR_API_KEY;
    delete process.env.OPENAI_API_KEY;
    let spoonCalled = false;
    spoon.searchRecipes = async () => { spoonCalled = true; return []; };
    const { cookie } = await aliceWith([["Rice", 100]]);
    await suggest(cookie, { dish: "risotto" });
    assert.equal(spoonCalled, false);
    assert.equal(webCalls.length, 0);
    assert.equal(geminiCalls.length, 1);
  });
});

describe("loading a Spoonacular recipe again", () => {
  test("fetches fresh details with have/missing", async () => {
    const { cookie } = await aliceWith([["Zucchini", 4]]);
    const res = await t.request("GET", `/api/recipes/details/spoonacular/715415?local_date=${day(0)}`, { cookie });
    assert.equal(res.status, 200);
    assert.equal(res.body.ingredients.find((i) => i.name === "zucchini").have, true);
  });

  test("rejects odd ids and explains when out of points", async () => {
    const { cookie } = await t.login("Alice");
    assert.equal((await t.request("GET", "/api/recipes/details/spoonacular/abc", { cookie })).status, 404);
    spoon.getRecipe = async () => { throw new spoon.OutOfPoints("out"); };
    assert.equal((await t.request("GET", "/api/recipes/details/spoonacular/1", { cookie })).status, 429);
    assert.equal((await t.request("GET", "/api/recipes/details/spoonacular/1")).status, 401);
  });
});

describe("the Spoonacular adapter", () => {
  test("asks for the right things and normalizes the answer", async () => {
    const savedFetch = global.fetch;
    let requested;
    global.fetch = async (url) => {
      requested = new URL(url);
      if (requested.pathname.endsWith("complexSearch")) {
        return { ok: true, status: 200, json: async () => ({ results: [{
          id: 7, title: "GF Ratatouille", readyInMinutes: 45, servings: 4, image: "https://img/7.jpg", sourceName: "Site", sourceUrl: "https://site.example/r",
          glutenFree: true, extendedIngredients: [{ nameClean: "eggplant", name: "eggplants", measures: { us: { amount: 1.333333, unitShort: "" } } }, { name: "olive oil", measures: { us: { amount: 2, unitShort: "Tbsps" } } }],
          analyzedInstructions: [{ steps: [{ number: 1, step: "Chop." }, { number: 2, step: "Bake." }] }]
        }] }) };
      }
      return { ok: false, status: 402, json: async () => ({}) };
    };
    try {
      process.env.SPOONACULAR_API_KEY = "k";
      spoon.clearCache();
      const [r] = await real.searchRecipes({ dish: "ratatouille", ingredients: ["x"], glutenFree: true });
      assert.equal(requested.searchParams.get("query"), "ratatouille");
      assert.equal(requested.searchParams.get("intolerances"), "gluten");
      assert.equal(requested.searchParams.get("includeIngredients"), null);
      assert.equal(requested.searchParams.get("apiKey"), "k");
      assert.deepEqual(r.ingredients, [{ name: "eggplant", amount: "1.33" }, { name: "olive oil", amount: "2 Tbsps" }]);
      assert.deepEqual(r.steps, ["Chop.", "Bake."]);
      assert.equal(r.source_url, "https://site.example/r");
      await assert.rejects(() => real.getRecipe("99"), spoon.OutOfPoints);
    } finally {
      global.fetch = savedFetch;
    }
  });
});
