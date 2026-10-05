const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { startApp } = require("./helpers");

let t, gemini, real, calls, reply;
const day = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

before(async () => {
  t = await startApp();
  gemini = require("../../lib/gemini");
  real = gemini.generateJson;
});
after(async () => { gemini.generateJson = real; await t.stop(); });
beforeEach(() => {
  calls = [];
  reply = async () => ({ data: { items: [
    { line: 0, name: "Milk (2%)", quantity: 1, storage: "fridge", shelf_life_days: 7, confident: true },
    { line: 1, name: "Chicken thighs", quantity: 2, storage: "freezer", shelf_life_days: 180, confident: true },
    { line: 2, name: "Bananas", quantity: 5, storage: "pantry", shelf_life_days: 5, confident: false }
  ] } });
  gemini.generateJson = async (args) => { calls.push(args); return reply(args); };
});

const parse = (cookie, body) => t.request("POST", "/api/receipts/parse", { cookie, body });

test("requires login", async () => {
  assert.equal((await parse(undefined, { lines: ["GV MLK 3.48"] })).status, 401);
  assert.equal((await t.request("GET", "/api/receipts/usage")).status, 401);
});

test("turns receipt lines into kitchen items dated from the user's day", async () => {
  const { cookie } = await t.login("Alice");
  const res = await parse(cookie, { lines: ["GV 2% MLK GAL", "BNLS CHKN THGH", "BANANAS 3.21 lb"], local_date: day(0) });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.items.map((i) => [i.name, i.quantity, i.fridge_bool, i.frozen, i.date_expire, i.confident]), [
    ["Milk (2%)", 1, true, false, day(7), true],
    ["Chicken thighs", 2, true, true, day(180), true],
    ["Bananas", 5, false, false, day(5), false]
  ]);
  assert.equal(res.body.remaining, 9);
  assert.match(calls[0].prompt, /0: GV 2% MLK GAL\n1: BNLS CHKN THGH\n2: BANANAS 3.21 lb/);
  assert.equal(calls[0].apiKey, process.env.GEMINI_RECEIPTS_API_KEY);
});

test("never forwards card, account or contact details, even if a client sends them", async () => {
  const { cookie } = await t.login("Alice");
  const res = await parse(cookie, { lines: [
    "GV 2% MLK GAL", "VISA CREDIT **** 4821", "CARD NO XXXXXXXXXXXX9917", "TC 1234 5678 9012 3456",
    "UPC 007874235187", "call (555) 123-4567", "me@example.com", "APPROVAL 08812C", "DEBIT"
  ] });
  assert.equal(res.status, 200);
  assert.equal(calls[0].prompt, "Receipt lines:\n0: GV 2% MLK GAL");
  assert.deepEqual(res.body.lines, ["GV 2% MLK GAL"]);
});

test("rejects bad input without calling Gemini", async () => {
  const { cookie } = await t.login("Alice");
  assert.equal((await parse(cookie, {})).status, 422);
  assert.equal((await parse(cookie, { lines: [] })).status, 422);
  assert.equal((await parse(cookie, { lines: new Array(81).fill("ITEM 1.00") })).status, 422);
  const onlySecrets = await parse(cookie, { lines: ["VISA **** 4821"] });
  assert.equal(onlySecrets.status, 422);
  assert.match(onlySecrets.body.errors[0], /couldn't find any items/);
  assert.equal(calls.length, 0);
});

test("cleans odd model output", async () => {
  reply = async () => ({ data: { items: [
    { line: 99, name: "  Yogurt  ", quantity: 500, storage: "attic", shelf_life_days: 99999 },
    { line: 0, name: "", quantity: 1, storage: "fridge", shelf_life_days: 3 },
    "nonsense"
  ] } });
  const { cookie } = await t.login("Alice");
  const res = await parse(cookie, { lines: ["YOGURT"], local_date: day(0) });
  assert.deepEqual(res.body.items, [{ name: "Yogurt", quantity: 99, fridge_bool: true, frozen: false, date_expire: day(730), confident: true, line: null, gluten_status: "gluten_free", gluten_reason: "Naturally gluten-free." }]);
});

test("stops at 10 scans a day; failures don't count", async () => {
  const { cookie, user } = await t.login("Alice");
  reply = async () => { throw Object.assign(new Error("overloaded"), { status: 503 }); };
  assert.equal((await parse(cookie, { lines: ["MILK"] })).status, 503);
  assert.deepEqual((await t.request("GET", `/api/receipts/usage?local_date=${day(0)}`, { cookie })).body, { limit: 10, remaining: 10 });
  await t.db.AiUsages.create({ UserId: user.id, kind: "receipts", day: day(0), count: 10 });
  gemini.generateJson = async () => { throw new Error("should not be called"); };
  const res = await parse(cookie, { lines: ["MILK"], local_date: day(0) });
  assert.equal(res.status, 429);
  assert.match(res.body.error, /10 receipt scans/);
});

test("receipt scans and recipe searches have separate limits", async () => {
  const { cookie, user } = await t.login("Alice");
  await t.db.AiUsages.create({ UserId: user.id, kind: "recipes", day: day(0), count: 20 });
  assert.equal((await parse(cookie, { lines: ["MILK"], local_date: day(0) })).status, 200);
});

test("lets groceries through that only look like payment words", async () => {
  const { cookie } = await t.login("Alice");
  await parse(cookie, { lines: ["CASHEWS", "CARDAMOM PODS", "PINEAPPLE CHUNKS", "TORTILLA CHIPS", "AUTHENTIC SALSA"] });
  assert.equal(calls[0].prompt, "Receipt lines:\n0: CASHEWS\n1: CARDAMOM PODS\n2: PINEAPPLE CHUNKS\n3: TORTILLA CHIPS\n4: AUTHENTIC SALSA");
});

test("labels gluten on each item: rules first, then the model's assessment", async () => {
  reply = async () => ({ data: { items: [
    { line: 0, name: "Sourdough bread", quantity: 1, storage: "pantry", shelf_life_days: 5, confident: true, gluten: "gluten_free", gluten_reason: "wrong" },
    { line: 1, name: "Original beef jerky", quantity: 1, storage: "pantry", shelf_life_days: 60, confident: true, gluten: "may_contain", gluten_reason: "Many jerky marinades use soy sauce made with wheat." },
    { line: 2, name: "Snack mix", quantity: 1, storage: "pantry", shelf_life_days: 60, confident: true, gluten: "oops" }
  ] } });
  const { cookie } = await t.login("Alice");
  const res = await parse(cookie, { lines: ["SOURDOUGH", "TERIYAKI JERKY", "SNACK MIX"] });
  assert.deepEqual(res.body.items.map((i) => [i.name, i.gluten_status]), [
    ["Sourdough bread", "contains"], ["Original beef jerky", "may_contain"], ["Snack mix", "unknown"]
  ]);
  assert.equal(res.body.items[1].gluten_reason, "Many jerky marinades use soy sauce made with wheat.");
  assert.match(calls[0].system, /celiac disease/);
});
