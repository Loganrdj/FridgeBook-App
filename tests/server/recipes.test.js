const { test, before, after, beforeEach, describe } = require("node:test");
const assert = require("node:assert/strict");
const { startApp } = require("./helpers");

let t;
let gemini;
let recipeRoutes;
let realGenerateJson;
let calls;
let reply;

const day = (n) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const sampleRecipe = (overrides = {}) => ({
  title: "Lemony chicken and spinach",
  description: "A quick skillet dinner.",
  minutes: 25,
  servings: 2,
  ingredients: [
    { name: "boneless chicken thighs", amount: "1 lb" },
    { name: "baby spinach", amount: "2 cups" },
    { name: "parmesan", amount: "1/4 cup" },
    { name: "kosher salt", amount: "1 tsp" }
  ],
  steps: ["Sear the chicken.", "Wilt the spinach.", "Finish with parmesan."],
  ...overrides
});

before(async () => {
  t = await startApp();
  gemini = require("../../lib/gemini");
  recipeRoutes = require("../../routes/recipeRoutes");
  realGenerateJson = gemini.generateJson;
});
after(async () => {
  gemini.generateJson = realGenerateJson;
  await t.stop();
});
beforeEach(() => {
  calls = [];
  reply = async () => ({ data: { recipes: [sampleRecipe()] }, model: "test-model" });
  gemini.generateJson = async (args) => {
    calls.push(args);
    return reply(args);
  };
  recipeRoutes.clearCache();
});

async function userWithKitchen(name, items) {
  const login = await t.login(name);
  for (const [food, days, fridge = true] of items) {
    await t.request("POST", "/api/ingredient", {
      cookie: login.cookie,
      body: { name: food, quantity: 1, date_expire: day(days), date_start: day(Math.min(days, 0) - 1), fridge_bool: fridge }
    });
  }
  return login;
}

const suggest = (cookie, body = {}) => t.request("POST", "/api/recipes/suggest", { cookie, body });

test("requires login", async () => {
  assert.equal((await suggest(undefined, {})).status, 401);
});

describe("validation", () => {
  test("rejects a non-array or too many ingredients", async () => {
    const { cookie } = await t.login("Alice");
    assert.equal((await suggest(cookie, { ingredients: "chicken" })).status, 422);
    assert.equal((await suggest(cookie, { ingredients: Array.from({ length: 16 }, (_, i) => `item ${i}`) })).status, 422);
    assert.equal(calls.length, 0);
  });

  test("needs ingredients or a kitchen to work from", async () => {
    const { cookie } = await t.login("Alice");
    const res = await suggest(cookie, {});
    assert.equal(res.status, 422);
    assert.match(res.body.errors[0], /kitchen/);
  });
});

describe("suggesting recipes", () => {
  test("marks what you have, using only unexpired kitchen items", async () => {
    const { cookie } = await userWithKitchen("Alice", [["Chicken thighs", 2], ["Spinach", -1], ["Lemons", 10]]);
    const res = await suggest(cookie, { ingredients: [" Chicken ", "chicken"] });
    assert.equal(res.status, 200);
    const [recipe] = res.body.recipes;
    const have = Object.fromEntries(recipe.ingredients.map((i) => [i.name, i.have]));
    assert.deepEqual(have, { "boneless chicken thighs": true, "baby spinach": false, parmesan: false, "kosher salt": true });
    assert.equal(recipe.missing_count, 2);
    assert.equal(res.body.remaining, 19);
    assert.equal(res.body.cached, false);
  });

  test("sends the searched ingredients and the unexpired kitchen, soonest first", async () => {
    const { cookie } = await userWithKitchen("Alice", [["Lemons", 10], ["Spinach", -1], ["Milk", 0], ["Yogurt", 1]]);
    await suggest(cookie, { ingredients: ["Rice"] });
    const { prompt, models, schema } = calls[0];
    assert.match(prompt, /wants to use: rice\./);
    assert.match(prompt, /- Milk \(expires today\)\n- Yogurt \(expires in 1 day\)\n- Lemons \(expires in 10 days\)/);
    assert.doesNotMatch(prompt, /Spinach/);
    assert.deepEqual(models, ["gemini-3.5-flash-lite", "gemini-3.8-flash"]);
    assert.ok(schema.properties.recipes);
  });

  test("with no ingredients, works from what's expiring", async () => {
    const { cookie } = await userWithKitchen("Alice", [["Chicken thighs", 2]]);
    const res = await suggest(cookie, {});
    assert.equal(res.status, 200);
    assert.match(calls[0].prompt, /use up what's expiring soonest/);
  });

  test("never shows another user's kitchen to the model", async () => {
    await userWithKitchen("Bob", [["Bob's secret sauce", 3]]);
    const { cookie } = await userWithKitchen("Alice", [["Chicken thighs", 2]]);
    await suggest(cookie, {});
    assert.doesNotMatch(calls[0].prompt, /secret sauce/);
  });

  test("drops malformed recipes and cleans the rest", async () => {
    reply = async () => ({
      data: {
        recipes: [
          sampleRecipe({ title: "  Good one  ", minutes: -5, servings: "two" }),
          sampleRecipe({ title: "No steps", steps: [] }),
          { title: "Nothing else" },
          "not even an object"
        ]
      }
    });
    const { cookie } = await userWithKitchen("Alice", [["Chicken thighs", 2]]);
    const res = await suggest(cookie, {});
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.recipes.map((r) => [r.title, r.minutes, r.servings]), [["Good one", null, null]]);
  });
});

describe("protecting the free quota", () => {
  test("repeating a search uses the cache and doesn't count", async () => {
    const { cookie } = await userWithKitchen("Alice", [["Chicken thighs", 2]]);
    const first = await suggest(cookie, { ingredients: ["rice", "chicken"] });
    const second = await suggest(cookie, { ingredients: ["chicken", "rice"] });
    assert.equal(calls.length, 1);
    assert.equal(second.body.cached, true);
    assert.equal(second.body.remaining, first.body.remaining);
  });

  test("a changed kitchen isn't served from the cache", async () => {
    const { cookie } = await userWithKitchen("Alice", [["Chicken thighs", 2]]);
    await suggest(cookie, {});
    await t.request("POST", "/api/ingredient", { cookie, body: { name: "Rice", quantity: 1, date_expire: day(100), fridge_bool: false } });
    await suggest(cookie, {});
    assert.equal(calls.length, 2);
  });

  test("stops at the daily limit", async () => {
    const { cookie, user } = await userWithKitchen("Alice", [["Chicken thighs", 2]]);
    await t.db.AiUsages.create({ UserId: user.id, kind: "recipes", day: day(0), count: 20 });
    const res = await suggest(cookie, {});
    assert.equal(res.status, 429);
    assert.equal(res.body.remaining, 0);
    assert.equal(calls.length, 0);
  });

  test("the limit is per user", async () => {
    const alice = await userWithKitchen("Alice", [["Chicken thighs", 2]]);
    const bob = await userWithKitchen("Bob", [["Rice", 20]]);
    await t.db.AiUsages.create({ UserId: alice.user.id, kind: "recipes", day: day(0), count: 20 });
    assert.equal((await suggest(bob.cookie, {})).status, 200);
  });

  test("failed requests don't count", async () => {
    const { cookie, user } = await userWithKitchen("Alice", [["Chicken thighs", 2]]);
    reply = async () => { throw Object.assign(new Error("overloaded"), { status: 503 }); };
    const res = await suggest(cookie, {});
    assert.equal(res.status, 503);
    assert.match(res.body.error, /try again/);
    reply = async () => ({ data: { recipes: [] } });
    assert.equal((await suggest(cookie, {})).status, 502);
    assert.equal(await t.db.AiUsages.count({ where: { UserId: user.id } }), 0);
  });

  test("a missing API key fails gracefully", async () => {
    gemini.generateJson = realGenerateJson;
    const saved = process.env.GEMINI_RECIPES_API_KEY;
    delete process.env.GEMINI_RECIPES_API_KEY;
    const { cookie } = await userWithKitchen("Alice", [["Chicken thighs", 2]]);
    const res = await suggest(cookie, {});
    if (saved !== undefined) process.env.GEMINI_RECIPES_API_KEY = saved;
    assert.equal(res.status, 503);
  });
});
