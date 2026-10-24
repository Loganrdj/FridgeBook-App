const { test, before, after, describe } = require("node:test");
const assert = require("node:assert/strict");
const { startApp } = require("./helpers");

let t, gemini, real;
before(async () => { t = await startApp(); gemini = require("../../lib/gemini"); real = gemini.generateJson; });
after(async () => { gemini.generateJson = real; await t.stop(); });

const day = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const addItem = (cookie, name, extra = {}) => t.request("POST", "/api/ingredient", { cookie, body: { name, quantity: 1, date_expire: day(5), fridge_bool: true, ...extra } });

describe("settings", () => {
  test("Celiac Mode is off by default and can be turned on", async () => {
    const { cookie } = await t.login("Alice");
    assert.deepEqual((await t.request("GET", "/api/me/settings", { cookie })).body, { celiac_mode: false, celiac_strict: false });
    const res = await t.request("PATCH", "/api/me/settings", { cookie, body: { celiac_mode: true } });
    assert.deepEqual(res.body, { celiac_mode: true, celiac_strict: false });
    assert.equal((await t.request("GET", "/profile", { cookie })).body.celiac_mode, true);
    assert.equal((await t.request("PATCH", "/api/me/settings", { cookie, body: { celiac_strict: "true" } })).body.celiac_strict, true);
  });

  test("rejects bad values and empty updates", async () => {
    const { cookie } = await t.login("Alice");
    assert.equal((await t.request("PATCH", "/api/me/settings", { cookie, body: { celiac_mode: "yes" } })).status, 422);
    assert.equal((await t.request("PATCH", "/api/me/settings", { cookie, body: {} })).status, 422);
    assert.equal((await t.request("PATCH", "/api/me/settings", { body: { celiac_mode: true } })).status, 401);
  });

  test("settings are per user", async () => {
    const alice = await t.login("Alice");
    const bob = await t.login("Bob");
    await t.request("PATCH", "/api/me/settings", { cookie: alice.cookie, body: { celiac_mode: true } });
    assert.equal((await t.request("GET", "/api/me/settings", { cookie: bob.cookie })).body.celiac_mode, false);
  });
});

describe("gluten labels on kitchen items", () => {
  test("items are labeled by the rules when added, renamed or put away", async () => {
    const { cookie } = await t.login("Alice");
    const bread = (await addItem(cookie, "Sourdough bread")).body;
    assert.equal(bread.gluten_status, "contains");
    assert.match(bread.gluten_reason, /wheat/);
    assert.equal((await addItem(cookie, "Rolled oats")).body.gluten_status, "may_contain");
    assert.equal((await addItem(cookie, "Eggs")).body.gluten_status, "gluten_free");
    assert.equal((await addItem(cookie, "Cereal")).body.gluten_status, null); // left for the AI check

    const renamed = await t.request("PATCH", `/api/ingredient/${bread.id}`, { cookie, body: { name: "Gluten-free bread" } });
    assert.equal(renamed.body.gluten_status, "gluten_free");
    const qtyOnly = await t.request("PATCH", `/api/ingredient/${bread.id}`, { cookie, body: { quantity: 2 } });
    assert.equal(qtyOnly.body.gluten_status, "gluten_free");

    await t.request("POST", "/api/shopping", { cookie, body: { name: "Bagels" } });
    const list = (await t.request("GET", "/api/shopping", { cookie })).body;
    const moved = await t.request("POST", "/api/shopping/to-kitchen", { cookie, body: { items: [{ id: list[0].id, date_expire: day(3), fridge_bool: false }] } });
    assert.equal(moved.body.ingredients[0].gluten_status, "contains");
  });

  test("a label supplied by a receipt scan is kept", async () => {
    const { cookie } = await t.login("Alice");
    const res = await t.request("POST", "/api/ingredient/import", { cookie, body: { ingredients: [
      { name: "Teriyaki jerky", quantity: 1, date_expire: day(30), fridge_bool: false, gluten_status: "contains", gluten_reason: "Teriyaki sauce has wheat." },
      { name: "Mystery snack", quantity: 1, date_expire: day(30), fridge_bool: false, gluten_status: "made-up" }
    ] } });
    assert.equal(res.body.imported, 2);
    const items = (await t.request("GET", "/api/ingredient", { cookie })).body;
    assert.deepEqual(items.map((i) => [i.name, i.gluten_status]).sort(), [["Mystery snack", null], ["Teriyaki jerky", "contains"]]);
  });

  test("the kitchen check labels only unchecked items, with one AI call", async () => {
    const calls = [];
    gemini.generateJson = async (args) => {
      calls.push(args);
      return { data: { items: [{ index: 0, status: "may_contain", reason: "Many cereals use malt." }] } };
    };
    const { cookie } = await t.login("Alice");
    await addItem(cookie, "Bread");
    const cereal = (await addItem(cookie, "Cereal")).body;
    const res = await t.request("POST", "/api/gluten/classify-kitchen", { cookie, body: { local_date: day(0) } });
    assert.deepEqual(res.body, [{ id: cereal.id, gluten_status: "may_contain", gluten_reason: "Many cereals use malt." }]);
    assert.equal(calls.length, 1);
    // nothing left to check: no more AI calls
    assert.deepEqual((await t.request("POST", "/api/gluten/classify-kitchen", { cookie, body: {} })).body, []);
    assert.equal(calls.length, 1);
  });

  test("the kitchen check is per user and limited per day", async () => {
    gemini.generateJson = async () => ({ data: { items: [] } });
    const alice = await t.login("Alice");
    const bob = await t.login("Bob");
    await addItem(bob.cookie, "Cereal");
    assert.deepEqual((await t.request("POST", "/api/gluten/classify-kitchen", { cookie: alice.cookie, body: {} })).body, []);
    await addItem(alice.cookie, "Hot sauce");
    await t.db.AiUsages.create({ UserId: alice.user.id, kind: "gluten", day: day(0), count: 30 });
    assert.equal((await t.request("POST", "/api/gluten/classify-kitchen", { cookie: alice.cookie, body: { local_date: day(0) } })).status, 429);
    assert.equal((await t.request("POST", "/api/gluten/classify-kitchen", { body: {} })).status, 401);
  });
});

test("a failed AI check isn't saved, so the item is checked again later", async () => {
  gemini.generateJson = async () => { throw new Error("down"); };
  await t.db.IngredientChecks.destroy({ where: {} }); // an earlier test taught the dictionary about cereal
  const { cookie } = await t.login("Alice");
  await addItem(cookie, "Cereal");
  const first = await t.request("POST", "/api/gluten/classify-kitchen", { cookie, body: {} });
  assert.equal(first.body[0].gluten_status, "unknown");
  gemini.generateJson = async () => ({ data: { items: [{ index: 0, status: "may_contain", reason: "Malt." }] } });
  const second = await t.request("POST", "/api/gluten/classify-kitchen", { cookie, body: {} });
  assert.equal(second.body[0].gluten_status, "may_contain");
});
