const { test, before, after, describe } = require("node:test");
const assert = require("node:assert/strict");
const { startApp } = require("./helpers");

let t;
before(async () => { t = await startApp(); });
after(async () => { await t.stop(); });

const day = (n) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const recipe = (overrides = {}) => ({
  title: "Chicken and spinach skillet",
  description: "Quick and green.",
  minutes: 25,
  servings: 2,
  ingredients: [
    { name: "chicken thighs", amount: "1 lb" },
    { name: "baby spinach", amount: "2 cups" },
    { name: "parmesan", amount: "1/4 cup" },
    { name: "kosher salt", amount: "1 tsp" }
  ],
  steps: ["Sear.", "Wilt.", "Serve."],
  ...overrides
});

const plan = (cookie, date, r = recipe()) => t.request("POST", "/api/meals", { cookie, body: { date, recipe: r, local_date: day(0) } });
const needs = async (cookie) => (await t.request("GET", `/api/meals/needs?local_date=${day(0)}`, { cookie })).body;
const stock = (cookie, name, expiresIn) => t.request("POST", "/api/ingredient", {
  cookie, body: { name, quantity: 1, date_expire: day(expiresIn), fridge_bool: true }
});

test("every meal route requires login", async () => {
  for (const [method, path] of [["GET", "/api/meals"], ["POST", "/api/meals"], ["GET", "/api/meals/needs"],
    ["PATCH", "/api/meals/1"], ["DELETE", "/api/meals/1"], ["POST", "/api/meals/1/dismiss"]]) {
    const res = await t.request(method, path, { body: method === "POST" || method === "PATCH" ? {} : undefined });
    assert.equal(res.status, 401, `${method} ${path}`);
  }
});

describe("planning meals", () => {
  test("plans a recipe on a day and says how many ingredients it needs", async () => {
    const { cookie } = await t.login("Alice");
    await stock(cookie, "Chicken thighs", 10);
    const res = await plan(cookie, day(3));
    assert.equal(res.status, 201);
    assert.equal(res.body.title, "Chicken and spinach skillet");
    assert.equal(res.body.date, day(3));
    assert.equal(res.body.needs, 2); // spinach and parmesan; chicken is stocked, salt is a staple
    const list = (await t.request("GET", "/api/meals", { cookie })).body;
    assert.deepEqual(list.map((m) => m.title), ["Chicken and spinach skillet"]);
  });

  test("keeps only known recipe fields, trimmed to size", async () => {
    const { cookie } = await t.login("Alice");
    const res = await plan(cookie, day(1), recipe({ title: "  " + "x".repeat(150), extra: "nope", minutes: -1, have: true }));
    assert.equal(res.status, 201);
    assert.equal(res.body.title.length, 100);
    assert.equal(res.body.recipe.extra, undefined);
    assert.equal(res.body.recipe.minutes, null);
  });

  for (const [label, body] of [
    ["no recipe", { date: day(1) }],
    ["a recipe without ingredients", { date: day(1), recipe: recipe({ ingredients: [] }) }],
    ["a recipe without steps", { date: day(1), recipe: recipe({ steps: [] }) }],
    ["a bad date", { date: "tomorrow", recipe: recipe() }],
    ["a date over a year away", { date: day(400), recipe: recipe() }],
    ["a date over a month ago", { date: day(-40), recipe: recipe() }]
  ]) {
    test(`rejects ${label}`, async () => {
      const { cookie } = await t.login("Alice");
      assert.equal((await t.request("POST", "/api/meals", { cookie, body: body })).status, 422);
    });
  }

  test("moves and removes a meal", async () => {
    const { cookie } = await t.login("Alice");
    const meal = (await plan(cookie, day(2))).body;
    const moved = await t.request("PATCH", `/api/meals/${meal.id}`, { cookie, body: { date: day(5) } });
    assert.equal(moved.body.date, day(5));
    assert.equal((await t.request("PATCH", `/api/meals/${meal.id}`, { cookie, body: { date: "soon" } })).status, 422);
    assert.equal((await t.request("DELETE", `/api/meals/${meal.id}`, { cookie })).status, 204);
    assert.equal((await t.request("DELETE", `/api/meals/${meal.id}`, { cookie })).status, 404);
  });

  test("meals are private to each user", async () => {
    const alice = await t.login("Alice");
    const bob = await t.login("Bob");
    const meal = (await plan(alice.cookie, day(2))).body;
    assert.deepEqual((await t.request("GET", "/api/meals", { cookie: bob.cookie })).body, []);
    assert.deepEqual(await needs(bob.cookie), []);
    assert.equal((await t.request("PATCH", `/api/meals/${meal.id}`, { cookie: bob.cookie, body: { date: day(4) } })).status, 404);
    assert.equal((await t.request("DELETE", `/api/meals/${meal.id}`, { cookie: bob.cookie })).status, 404);
    assert.equal((await t.request("POST", `/api/meals/${meal.id}/dismiss`, { cookie: bob.cookie, body: { name: "parmesan" } })).status, 404);
  });
});

describe("what planned meals need", () => {
  test("flags missing items and items that expire before the meal", async () => {
    const { cookie } = await t.login("Alice");
    await stock(cookie, "Chicken thighs", 1);   // expires before the day-3 meal
    await stock(cookie, "Spinach", 5);          // still good on day 3
    await plan(cookie, day(3));
    const list = await needs(cookie);
    assert.deepEqual(list.map((n) => [n.name, n.reason, n.expires, n.date]), [
      ["chicken thighs", "expires_before", day(1), day(3)],
      ["parmesan", "missing", null, day(3)]
    ]);
    assert.equal(list[0].amount, "1 lb");
  });

  test("a fresher purchase covers an item that would have expired", async () => {
    const { cookie } = await t.login("Alice");
    await stock(cookie, "Chicken thighs", 1);
    await stock(cookie, "Chicken thighs", 7);
    await plan(cookie, day(3), recipe({ ingredients: [{ name: "chicken thighs", amount: "1 lb" }] }));
    assert.deepEqual(await needs(cookie), []);
  });

  test("shows when a needed item is already on the shopping list", async () => {
    const { cookie } = await t.login("Alice");
    await t.request("POST", "/api/shopping", { cookie, body: { name: "Parmesan" } });
    await plan(cookie, day(2));
    const parmesan = (await needs(cookie)).find((n) => n.name === "parmesan");
    assert.equal(parmesan.on_list, true);
    assert.equal((await needs(cookie)).find((n) => n.name === "baby spinach").on_list, false);
  });

  test("'I have it' hides an ingredient for that meal only", async () => {
    const { cookie } = await t.login("Alice");
    const first = (await plan(cookie, day(2))).body;
    await plan(cookie, day(4));
    await t.request("POST", `/api/meals/${first.id}/dismiss`, { cookie, body: { name: "Parmesan" } });
    const parmesan = (await needs(cookie)).filter((n) => n.name === "parmesan");
    assert.deepEqual(parmesan.map((n) => n.date), [day(4)]);
    assert.equal((await t.request("POST", `/api/meals/${first.id}/dismiss`, { cookie, body: {} })).status, 422);
  });

  test("ignores past meals and sorts by date", async () => {
    const { cookie } = await t.login("Alice");
    await plan(cookie, day(-2), recipe({ title: "Old", ingredients: [{ name: "tofu", amount: "1 block" }] }));
    await plan(cookie, day(6), recipe({ title: "Later", ingredients: [{ name: "rice", amount: "1 cup" }] }));
    await plan(cookie, day(1), recipe({ title: "Sooner", ingredients: [{ name: "beans", amount: "1 can" }] }));
    assert.deepEqual((await needs(cookie)).map((n) => n.meal_title), ["Sooner", "Later"]);
  });
});

describe("meals from Spoonacular and the web", () => {
  test("a Spoonacular meal stores only its id, title, image and link, and fetches ingredients for needs", async () => {
    const spoon = require("../../lib/providers/spoonacular");
    const realGet = spoon.getRecipe;
    let asked;
    spoon.getRecipe = async (id) => { asked = id; return { ingredients: [{ name: "eggplant", amount: "1" }, { name: "salt", amount: "1 tsp" }] }; };
    try {
      const { cookie } = await t.login("Alice");
      const res = await plan(cookie, day(2), {
        provider: "spoonacular", id: "715415", title: "Classic Ratatouille", image: "https://img/1.jpg",
        source_name: "Serious Eats", source_url: "https://www.seriouseats.com/ratatouille",
        ingredients: [{ name: "eggplant", amount: "1" }], steps: ["Bake."]
      });
      assert.equal(res.status, 201);
      assert.deepEqual(res.body.recipe, {
        provider: "spoonacular", external_id: "715415", description: "", minutes: null, servings: null,
        image: "https://img/1.jpg", source_name: "Serious Eats", source_url: "https://www.seriouseats.com/ratatouille"
      });
      assert.equal(res.body.needs, 1);
      assert.equal(asked, "715415");
      assert.deepEqual((await needs(cookie)).map((n) => n.name), ["eggplant"]);
    } finally {
      spoon.getRecipe = realGet;
    }
  });

  test("a web recipe keeps its link and may skip steps", async () => {
    const { cookie } = await t.login("Alice");
    const res = await plan(cookie, day(1), recipe({ provider: "web", steps: [], source_name: "BBC Good Food", source_url: "https://www.bbcgoodfood.com/r" }));
    assert.equal(res.status, 201);
    assert.equal(res.body.recipe.source_url, "https://www.bbcgoodfood.com/r");
    assert.equal(res.body.recipe.provider, "web");
  });

  test("rejects a Spoonacular meal without a valid id, and unsafe links", async () => {
    const { cookie } = await t.login("Alice");
    assert.equal((await plan(cookie, day(1), { provider: "spoonacular", id: "abc", title: "X" })).status, 422);
    const res = await plan(cookie, day(1), recipe({ source_url: "javascript:alert(1)" }));
    assert.equal(res.body.recipe.source_url, null);
  });
});
