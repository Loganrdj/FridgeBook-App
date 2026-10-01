const { test, before, after, describe } = require("node:test");
const assert = require("node:assert/strict");
const { startApp } = require("./helpers");

let t;
before(async () => { t = await startApp(); });
after(async () => { await t.stop(); });

const milk = { name: "Milk", quantity: 2, date_expire: "2026-10-05", fridge_bool: true };

describe("requires login", () => {
  for (const [method, path] of [
    ["GET", "/api/ingredient"],
    ["POST", "/api/ingredient"],
    ["POST", "/api/ingredient/import"],
    ["GET", "/api/ingredient/1"],
    ["PATCH", "/api/ingredient/1"],
    ["DELETE", "/api/ingredient/1"]
  ]) {
    test(`${method} ${path} returns 401 when logged out`, async () => {
      const res = await t.request(method, path, { body: method === "GET" || method === "DELETE" ? undefined : milk });
      assert.equal(res.status, 401);
    });
  }
});

describe("creating ingredients", () => {
  test("saves a valid ingredient with clean types", async () => {
    const { cookie } = await t.login("Alice");
    const res = await t.request("POST", "/api/ingredient", {
      cookie,
      body: { name: "  Oat milk ", quantity: "3", date_expire: "2026-10-02", date_start: "2026-10-01", fridge_bool: "true" }
    });
    assert.equal(res.status, 201);
    assert.deepEqual(
      { name: res.body.name, quantity: res.body.quantity, date_start: res.body.date_start, date_expire: res.body.date_expire, fridge_bool: res.body.fridge_bool },
      { name: "Oat milk", quantity: 3, date_start: "2026-10-01", date_expire: "2026-10-02", fridge_bool: true }
    );
  });

  test("defaults date_start to today when it's missing or invalid", async () => {
    const { cookie } = await t.login("Alice");
    const res = await t.request("POST", "/api/ingredient", { cookie, body: { ...milk, date_start: "nope" } });
    assert.equal(res.status, 201);
    assert.match(res.body.date_start, /^\d{4}-\d{2}-\d{2}$/);
  });

  test("ignores a client-supplied id and UserId", async () => {
    const { cookie, user } = await t.login("Alice");
    const res = await t.request("POST", "/api/ingredient", { cookie, body: { ...milk, id: 999999, UserId: user.id + 1000 } });
    assert.equal(res.status, 201);
    assert.notEqual(res.body.id, 999999);
    const row = await t.db.Foods.findByPk(res.body.id);
    assert.equal(row.UserId, user.id);
  });

  const invalid = [
    ["an empty body", {}],
    ["a blank name", { ...milk, name: "   " }],
    ["a name over 100 characters", { ...milk, name: "x".repeat(101) }],
    ["quantity 0", { ...milk, quantity: 0 }],
    ["a fractional quantity", { ...milk, quantity: 1.5 }],
    ["a quantity over 9999", { ...milk, quantity: 10000 }],
    ["a text quantity", { ...milk, quantity: "lots" }],
    ["an impossible date", { ...milk, date_expire: "2026-02-30" }],
    ["a non-ISO date", { ...milk, date_expire: "10/05/2026" }],
    ["a missing fridge_bool", { name: "Milk", quantity: 1, date_expire: "2026-10-05" }]
  ];
  for (const [label, body] of invalid) {
    test(`rejects ${label} with 422`, async () => {
      const { cookie } = await t.login("Alice");
      const res = await t.request("POST", "/api/ingredient", { cookie, body });
      assert.equal(res.status, 422);
      assert.ok(Array.isArray(res.body.errors) && res.body.errors.length > 0);
    });
  }
});

describe("each user only sees their own kitchen", () => {
  test("lists only the user's items, soonest-expiring first", async () => {
    const alice = await t.login("Alice");
    const bob = await t.login("Bob");
    await t.request("POST", "/api/ingredient", { cookie: alice.cookie, body: { ...milk, name: "Rice", date_expire: "2027-01-01", fridge_bool: false } });
    await t.request("POST", "/api/ingredient", { cookie: alice.cookie, body: { ...milk, name: "Milk", date_expire: "2026-10-03" } });
    await t.request("POST", "/api/ingredient", { cookie: bob.cookie, body: { ...milk, name: "Cheese" } });

    const aliceList = await t.request("GET", "/api/ingredient", { cookie: alice.cookie });
    const bobList = await t.request("GET", "/api/ingredient", { cookie: bob.cookie });
    assert.deepEqual(aliceList.body.map((i) => i.name), ["Milk", "Rice"]);
    assert.deepEqual(bobList.body.map((i) => i.name), ["Cheese"]);
  });

  test("another user's item can't be read, changed or deleted", async () => {
    const alice = await t.login("Alice");
    const bob = await t.login("Bob");
    const created = await t.request("POST", "/api/ingredient", { cookie: alice.cookie, body: { ...milk, quantity: 10 } });
    const id = created.body.id;

    assert.equal((await t.request("GET", `/api/ingredient/${id}`, { cookie: bob.cookie })).status, 404);
    assert.equal((await t.request("PATCH", `/api/ingredient/${id}`, { cookie: bob.cookie, body: { quantity: 0 } })).status, 404);
    assert.equal((await t.request("DELETE", `/api/ingredient/${id}`, { cookie: bob.cookie })).status, 404);

    const stillThere = await t.request("GET", `/api/ingredient/${id}`, { cookie: alice.cookie });
    assert.equal(stillThere.body.quantity, 10);
  });

  test("a non-numeric id is a 404", async () => {
    const { cookie } = await t.login("Alice");
    assert.equal((await t.request("GET", "/api/ingredient/abc", { cookie })).status, 404);
  });
});

describe("updating and deleting", () => {
  async function create(cookie, body = {}) {
    return (await t.request("POST", "/api/ingredient", { cookie, body: { ...milk, ...body } })).body;
  }

  test("sets quantity as a number (10 -> 9 doesn't delete)", async () => {
    const { cookie } = await t.login("Alice");
    const item = await create(cookie, { quantity: 10 });
    const res = await t.request("PATCH", `/api/ingredient/${item.id}`, { cookie, body: { quantity: 9 } });
    assert.equal(res.status, 200);
    assert.equal(res.body.quantity, 9);
  });

  test("edits name, expiration and location", async () => {
    const { cookie } = await t.login("Alice");
    const item = await create(cookie);
    const res = await t.request("PATCH", `/api/ingredient/${item.id}`, {
      cookie,
      body: { name: "Whole milk", date_expire: "2026-10-09", fridge_bool: false }
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.name, "Whole milk");
    assert.equal(res.body.date_expire, "2026-10-09");
    assert.equal(res.body.fridge_bool, false);
    assert.equal(res.body.quantity, item.quantity);
  });

  test("quantity 0 removes the item", async () => {
    const { cookie } = await t.login("Alice");
    const item = await create(cookie);
    const res = await t.request("PATCH", `/api/ingredient/${item.id}`, { cookie, body: { quantity: 0 } });
    assert.deepEqual(res.body, { id: item.id, deleted: true });
    assert.equal((await t.request("GET", `/api/ingredient/${item.id}`, { cookie })).status, 404);
  });

  test("rejects an empty or invalid update", async () => {
    const { cookie } = await t.login("Alice");
    const item = await create(cookie);
    assert.equal((await t.request("PATCH", `/api/ingredient/${item.id}`, { cookie, body: {} })).status, 422);
    assert.equal((await t.request("PATCH", `/api/ingredient/${item.id}`, { cookie, body: { quantity: -1 } })).status, 422);
    assert.equal((await t.request("PATCH", `/api/ingredient/${item.id}`, { cookie, body: { name: "" } })).status, 422);
  });

  test("DELETE removes the item, then 404s", async () => {
    const { cookie } = await t.login("Alice");
    const item = await create(cookie);
    assert.equal((await t.request("DELETE", `/api/ingredient/${item.id}`, { cookie })).status, 204);
    assert.equal((await t.request("DELETE", `/api/ingredient/${item.id}`, { cookie })).status, 404);
  });
});

describe("importing browser-saved items", () => {
  test("imports valid fridge items and skips everything else", async () => {
    const { cookie } = await t.login("Alice");
    const res = await t.request("POST", "/api/ingredient/import", {
      cookie,
      body: {
        ingredients: [
          { id: "123-abc", name: "Carrot", quantity: 3, date_start: "2026-10-1", date_expire: "2026-10-15", fridge_bool: true },
          { id: 55, value: "garlic" },
          { name: "Eggs", quantity: "12", date_expire: "2026-10-20", fridge_bool: "false" }
        ]
      }
    });
    assert.equal(res.status, 201);
    assert.deepEqual(res.body, { imported: 2, skipped: 1 });
    const list = await t.request("GET", "/api/ingredient", { cookie });
    assert.deepEqual(list.body.map((i) => i.name), ["Carrot", "Eggs"]);
  });

  test("rejects a non-array or an oversized import", async () => {
    const { cookie } = await t.login("Alice");
    assert.equal((await t.request("POST", "/api/ingredient/import", { cookie, body: { ingredients: "x" } })).status, 422);
    assert.equal((await t.request("POST", "/api/ingredient/import", { cookie, body: { ingredients: new Array(201).fill({}) } })).status, 422);
  });
});
