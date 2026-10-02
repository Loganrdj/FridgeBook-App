const { test, before, after, describe } = require("node:test");
const assert = require("node:assert/strict");
const { startApp } = require("./helpers");

let t;
before(async () => { t = await startApp(); });
after(async () => { await t.stop(); });

const add = (cookie, body) => t.request("POST", "/api/shopping", { cookie, body });
const list = async (cookie) => (await t.request("GET", "/api/shopping", { cookie })).body;

test("every shopping route requires login", async () => {
  for (const [method, path] of [["GET", "/api/shopping"], ["POST", "/api/shopping"], ["PATCH", "/api/shopping/1"],
    ["DELETE", "/api/shopping/1"], ["DELETE", "/api/shopping/checked"], ["POST", "/api/shopping/to-kitchen"]]) {
    const res = await t.request(method, path, { body: method === "POST" || method === "PATCH" ? {} : undefined });
    assert.equal(res.status, 401, `${method} ${path}`);
  }
});

describe("adding", () => {
  test("adds with defaults and cleans input", async () => {
    const { cookie } = await t.login("Alice");
    const res = await add(cookie, { name: "  Bananas ", source: "kitchen", id: 999, UserId: 12345, checked: true });
    assert.equal(res.status, 201);
    assert.deepEqual({ ...res.body, id: undefined }, { id: undefined, name: "Bananas", quantity: 1, note: null, checked: false, source: "kitchen" });
  });

  test("an unknown source becomes manual", async () => {
    const { cookie } = await t.login("Alice");
    assert.equal((await add(cookie, { name: "Tea", source: "hacker" })).body.source, "manual");
  });

  test("adding something already on the list bumps the quantity (case-insensitive)", async () => {
    const { cookie } = await t.login("Alice");
    const first = await add(cookie, { name: "Milk", quantity: 1 });
    const second = await add(cookie, { name: "milk", quantity: 2, note: "2%" });
    assert.equal(second.status, 200);
    assert.equal(second.body.merged, true);
    assert.equal(second.body.id, first.body.id);
    assert.equal(second.body.quantity, 3);
    assert.equal(second.body.note, "2%");
    assert.equal((await list(cookie)).length, 1);
  });

  test("a checked item isn't merged into; a new line is added", async () => {
    const { cookie } = await t.login("Alice");
    const first = await add(cookie, { name: "Eggs" });
    await t.request("PATCH", `/api/shopping/${first.body.id}`, { cookie, body: { checked: true } });
    const second = await add(cookie, { name: "Eggs" });
    assert.equal(second.status, 201);
    assert.notEqual(second.body.id, first.body.id);
  });

  for (const [label, body] of [["no name", {}], ["a blank name", { name: " " }], ["quantity 0", { name: "X", quantity: 0 }],
    ["a fractional quantity", { name: "X", quantity: 1.5 }], ["a note over 100 characters", { name: "X", note: "n".repeat(101) }]]) {
    test(`rejects ${label}`, async () => {
      const { cookie } = await t.login("Alice");
      assert.equal((await add(cookie, body)).status, 422);
    });
  }
});

describe("each user only sees their own list", () => {
  test("lists and changes are scoped to the user", async () => {
    const alice = await t.login("Alice");
    const bob = await t.login("Bob");
    const item = (await add(alice.cookie, { name: "Coffee" })).body;
    await add(bob.cookie, { name: "Tea" });

    assert.deepEqual((await list(alice.cookie)).map((i) => i.name), ["Coffee"]);
    assert.deepEqual((await list(bob.cookie)).map((i) => i.name), ["Tea"]);
    assert.equal((await t.request("PATCH", `/api/shopping/${item.id}`, { cookie: bob.cookie, body: { checked: true } })).status, 404);
    assert.equal((await t.request("DELETE", `/api/shopping/${item.id}`, { cookie: bob.cookie })).status, 404);
    const moved = await t.request("POST", "/api/shopping/to-kitchen", {
      cookie: bob.cookie, body: { items: [{ id: item.id, date_expire: "2026-12-01", fridge_bool: false }] }
    });
    assert.equal(moved.status, 404);
    assert.deepEqual((await list(alice.cookie)).map((i) => [i.name, i.checked]), [["Coffee", false]]);
  });

  test("adding the same name as another user doesn't merge into theirs", async () => {
    const alice = await t.login("Alice");
    const bob = await t.login("Bob");
    await add(alice.cookie, { name: "Bread" });
    assert.equal((await add(bob.cookie, { name: "Bread" })).status, 201);
    assert.equal((await list(alice.cookie))[0].quantity, 1);
  });
});

describe("updating", () => {
  test("checks off, edits and sorts checked items last", async () => {
    const { cookie } = await t.login("Alice");
    const a = (await add(cookie, { name: "Apples" })).body;
    await add(cookie, { name: "Basil" });
    const res = await t.request("PATCH", `/api/shopping/${a.id}`, { cookie, body: { checked: true, quantity: 6, note: "Honeycrisp" } });
    assert.deepEqual([res.body.checked, res.body.quantity, res.body.note], [true, 6, "Honeycrisp"]);
    assert.deepEqual((await list(cookie)).map((i) => i.name), ["Basil", "Apples"]);
  });

  test("rejects an empty or invalid update", async () => {
    const { cookie } = await t.login("Alice");
    const item = (await add(cookie, { name: "Rice" })).body;
    assert.equal((await t.request("PATCH", `/api/shopping/${item.id}`, { cookie, body: {} })).status, 422);
    assert.equal((await t.request("PATCH", `/api/shopping/${item.id}`, { cookie, body: { checked: "maybe" } })).status, 422);
    assert.equal((await t.request("PATCH", `/api/shopping/${item.id}`, { cookie, body: { quantity: 0 } })).status, 422);
  });

  test("clear checked removes only the user's checked items", async () => {
    const alice = await t.login("Alice");
    const bob = await t.login("Bob");
    const done = (await add(alice.cookie, { name: "Done" })).body;
    await add(alice.cookie, { name: "Still needed" });
    const bobs = (await add(bob.cookie, { name: "Bob's done" })).body;
    await t.request("PATCH", `/api/shopping/${done.id}`, { cookie: alice.cookie, body: { checked: true } });
    await t.request("PATCH", `/api/shopping/${bobs.id}`, { cookie: bob.cookie, body: { checked: true } });

    const res = await t.request("DELETE", "/api/shopping/checked", { cookie: alice.cookie });
    assert.deepEqual(res.body, { removed: 1 });
    assert.deepEqual((await list(alice.cookie)).map((i) => i.name), ["Still needed"]);
    assert.equal((await list(bob.cookie)).length, 1);
  });

  test("DELETE removes one item", async () => {
    const { cookie } = await t.login("Alice");
    const item = (await add(cookie, { name: "Salt" })).body;
    assert.equal((await t.request("DELETE", `/api/shopping/${item.id}`, { cookie })).status, 204);
    assert.equal((await t.request("DELETE", `/api/shopping/${item.id}`, { cookie })).status, 404);
  });
});

describe("moving bought items to the kitchen", () => {
  test("creates kitchen items and removes them from the list", async () => {
    const { cookie } = await t.login("Alice");
    const milk = (await add(cookie, { name: "Milk", quantity: 2 })).body;
    const rice = (await add(cookie, { name: "Rice" })).body;
    const keep = (await add(cookie, { name: "Not bought yet" })).body;

    const res = await t.request("POST", "/api/shopping/to-kitchen", {
      cookie,
      body: { items: [
        { id: milk.id, date_expire: "2026-10-09", fridge_bool: true },
        { id: rice.id, date_expire: "2027-06-01", fridge_bool: false, quantity: 3 }
      ] }
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.moved, 2);
    const kitchen = (await t.request("GET", "/api/ingredient", { cookie })).body;
    assert.deepEqual(kitchen.map((i) => [i.name, i.quantity, i.date_expire, i.fridge_bool]),
      [["Milk", 2, "2026-10-09", true], ["Rice", 3, "2027-06-01", false]]);
    assert.deepEqual((await list(cookie)).map((i) => i.id), [keep.id]);
  });

  test("an invalid entry moves nothing", async () => {
    const { cookie } = await t.login("Alice");
    const good = (await add(cookie, { name: "Good" })).body;
    const bad = (await add(cookie, { name: "Bad" })).body;
    const res = await t.request("POST", "/api/shopping/to-kitchen", {
      cookie,
      body: { items: [{ id: good.id, date_expire: "2026-10-09", fridge_bool: true }, { id: bad.id, date_expire: "soon", fridge_bool: true }] }
    });
    assert.equal(res.status, 422);
    assert.match(res.body.errors[0], /^Bad:/);
    assert.equal((await t.request("GET", "/api/ingredient", { cookie })).body.length, 0);
    assert.equal((await list(cookie)).length, 2);
  });

  test("rejects empty, duplicate or oversized batches", async () => {
    const { cookie } = await t.login("Alice");
    const item = (await add(cookie, { name: "Oats" })).body;
    const post = (items) => t.request("POST", "/api/shopping/to-kitchen", { cookie, body: { items } });
    assert.equal((await post([])).status, 422);
    assert.equal((await post([{ id: item.id, date_expire: "2026-10-09", fridge_bool: true }, { id: item.id, date_expire: "2026-10-09", fridge_bool: true }])).status, 422);
    assert.equal((await post(new Array(101).fill({ id: item.id }))).status, 422);
  });
});

describe("adding several items at once", () => {
  test("adds and merges, returning the whole list", async () => {
    const { cookie } = await t.login("Alice");
    await add(cookie, { name: "Parmesan" });
    const res = await t.request("POST", "/api/shopping/bulk", {
      cookie, body: { items: [{ name: "parmesan", note: "1/4 cup", source: "recipe" }, { name: "Lemons", quantity: 2, source: "recipe" }] }
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.added, 2);
    assert.deepEqual(res.body.items.map((i) => [i.name, i.quantity, i.source]), [["Parmesan", 2, "manual"], ["Lemons", 2, "recipe"]]);
  });

  test("validates every item and adds nothing if one is bad", async () => {
    const { cookie } = await t.login("Alice");
    const res = await t.request("POST", "/api/shopping/bulk", { cookie, body: { items: [{ name: "Fine" }, { name: "" }] } });
    assert.equal(res.status, 422);
    assert.match(res.body.errors[0], /^item 2:/);
    assert.equal((await list(cookie)).length, 0);
    assert.equal((await t.request("POST", "/api/shopping/bulk", { cookie, body: { items: [] } })).status, 422);
  });

  test("requires login and stays per user", async () => {
    assert.equal((await t.request("POST", "/api/shopping/bulk", { body: { items: [{ name: "X" }] } })).status, 401);
    const alice = await t.login("Alice");
    const bob = await t.login("Bob");
    await add(bob.cookie, { name: "Tea" });
    const res = await t.request("POST", "/api/shopping/bulk", { cookie: alice.cookie, body: { items: [{ name: "Tea" }] } });
    assert.deepEqual(res.body.items.map((i) => i.name), ["Tea"]);
    assert.equal((await list(bob.cookie))[0].quantity, 1);
  });
});
