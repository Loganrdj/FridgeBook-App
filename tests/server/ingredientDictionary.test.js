const { test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { startApp } = require("./helpers");

let t, gemini, gluten, spoonacular, dishCheck, real;
before(async () => {
  t = await startApp();
  gemini = require("../../lib/gemini");
  gluten = require("../../lib/gluten");
  spoonacular = require("../../lib/providers/spoonacular");
  dishCheck = require("../../lib/dishCheck");
  real = { gemini: gemini.generateJson, spoon: spoonacular.searchIngredients };
});
after(async () => {
  gemini.generateJson = real.gemini;
  spoonacular.searchIngredients = real.spoon;
  await t.stop();
});

let aiCalls;
beforeEach(async () => {
  aiCalls = [];
  process.env.GEMINI_RECEIPTS_API_KEY = "test-key";
  await t.db.IngredientChecks.destroy({ where: {} });
  await t.db.AiUsages.destroy({ where: {} });
});

// Fake gluten AI: answers every item with the given status
function fakeAi(status, reason = "From the AI.") {
  gemini.generateJson = async (args) => {
    aiCalls.push(args);
    const items = args.prompt.split("\n").slice(1).map((line, index) => ({ index, status, reason }));
    return { data: { items } };
  };
}

const day = (n) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

test("AI answers are remembered, so the same ingredient is never asked about twice", async () => {
  fakeAi("may_contain", "Many broths add wheat.");
  const [first] = await gluten.classifyNames(["Chicken broth"]);
  assert.equal(first.status, "may_contain");
  assert.equal(aiCalls.length, 1);

  // written differently, still the same ingredient
  const again = await gluten.classifyNames(["2 lb Organic Chicken Broths", "Chicken broth"]);
  assert.deepEqual(again.map((r) => r.status), ["may_contain", "may_contain"]);
  assert.equal(again.aiUsed, false);
  assert.equal(aiCalls.length, 1);
  const row = await t.db.IngredientChecks.findOne({ where: { key: "chicken broth" } });
  assert.equal(row.reason, "Many broths add wheat.");
  assert.equal(row.hits, 1);
});

test("the rules still come first, and only unanswered names go to the AI", async () => {
  fakeAi("gluten_free");
  await t.db.IngredientChecks.create({ key: "veggie stock", status: "may_contain", reason: "Saved.", checked_at: new Date() });
  const results = await gluten.classifyNames(["Bread", "Veggie stock", "Fish sauce"]);
  assert.deepEqual(results.map((r) => r.status), ["contains", "may_contain", "gluten_free"]);
  assert.equal(aiCalls.length, 1);
  assert.match(aiCalls[0].prompt, /0: Fish sauce$/);
});

test("unknown answers, failed checks and odd names aren't remembered", async () => {
  fakeAi("unknown");
  await gluten.classifyNames(["Mystery mix"]);
  gemini.generateJson = async () => { throw new Error("down"); };
  const [failed] = await gluten.classifyNames(["Fish sauce"]);
  assert.equal(failed.retry, true);
  fakeAi("gluten_free");
  await gluten.classifyNames(["a very long product name with far too many words in it", "1234"]);
  assert.equal(await t.db.IngredientChecks.count(), 0);
});

test("old entries are checked again", async () => {
  fakeAi("gluten_free");
  const old = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);
  await t.db.IngredientChecks.create({ key: "fish sauce", status: "may_contain", reason: "Old.", checked_at: old });
  const [result] = await gluten.classifyNames(["Fish sauce"]);
  assert.equal(result.status, "gluten_free");
  assert.equal((await t.db.IngredientChecks.findOne({ where: { key: "fish sauce" } })).status, "gluten_free");
});

test("the kitchen check uses the dictionary without using anyone's daily limit", async () => {
  fakeAi("may_contain", "Many cereals use malt.");
  const alice = await t.login("Alice");
  await t.request("POST", "/api/ingredient", { cookie: alice.cookie, body: { name: "Cereal", quantity: 1, date_expire: day(5), fridge_bool: false } });
  await t.request("POST", "/api/gluten/classify-kitchen", { cookie: alice.cookie, body: { local_date: day(0) } });
  assert.equal(aiCalls.length, 1);

  // Bob has used all his checks today, but the dictionary already knows cereal
  const bob = await t.login("Bob");
  await t.db.AiUsages.create({ UserId: bob.user.id, kind: "gluten", day: day(0), count: 30 });
  await t.request("POST", "/api/ingredient", { cookie: bob.cookie, body: { name: "Cereal", quantity: 1, date_expire: day(5), fridge_bool: false } });
  const res = await t.request("POST", "/api/gluten/classify-kitchen", { cookie: bob.cookie, body: { local_date: day(0) } });
  assert.equal(res.status, 200);
  assert.equal(res.body[0].gluten_status, "may_contain");
  assert.equal(aiCalls.length, 1);
  assert.equal((await t.db.AiUsages.findOne({ where: { UserId: bob.user.id, kind: "gluten" } })).count, 30);

  // something new still needs the AI, which Bob has no checks left for
  await t.request("POST", "/api/ingredient", { cookie: bob.cookie, body: { name: "Granola bar", quantity: 1, date_expire: day(5), fridge_bool: false } });
  await t.request("POST", "/api/ingredient", { cookie: bob.cookie, body: { name: "Fish sauce", quantity: 1, date_expire: day(5), fridge_bool: false } });
  const limited = await t.request("POST", "/api/gluten/classify-kitchen", { cookie: bob.cookie, body: { local_date: day(0) } });
  assert.equal(limited.status, 429);
});

test("receipt scans teach the dictionary, and later scans trust it", async () => {
  const receiptAi = (gluten, reason) => {
    gemini.generateJson = async (args) => {
      aiCalls.push(args);
      return { data: { items: [{ name: "Fish sauce", quantity: 1, storage: "pantry", shelf_life_days: 365, confident: true, line: 0, gluten, gluten_reason: reason }] } };
    };
  };
  const { cookie } = await t.login("Alice");
  receiptAi("gluten_free", "Fish and salt.");
  const first = await t.request("POST", "/api/receipts/parse", { cookie, body: { lines: ["FISH SAUCE 3.99"] } });
  assert.equal(first.body.items[0].gluten_status, "gluten_free");

  receiptAi("may_contain", "A different guess.");
  const second = await t.request("POST", "/api/receipts/parse", { cookie, body: { lines: ["FISH SAUCE 3.99"] } });
  assert.equal(second.body.items[0].gluten_status, "gluten_free");
  assert.equal(second.body.items[0].gluten_reason, "Fish and salt.");
});

test("labels sent by a browser never reach the shared dictionary", async () => {
  const { cookie } = await t.login("Mallory");
  await t.request("POST", "/api/ingredient/import", { cookie, body: { ingredients: [
    { name: "Fish sauce", quantity: 1, date_expire: day(30), fridge_bool: false, gluten_status: "contains", gluten_reason: "Made up." }
  ] } });
  await t.request("POST", "/api/ingredient", { cookie, body: { name: "Fish sauce", quantity: 1, date_expire: day(5), fridge_bool: false, gluten_status: "gluten_free" } });
  assert.equal(await t.db.IngredientChecks.count(), 0);
});

test("answers that came with another task go through the rules and dictionary first", async () => {
  await t.db.IngredientChecks.create({ key: "fish sauce", status: "gluten_free", reason: "Saved.", checked_at: new Date() });
  const labels = await gluten.resolveWithAnswers([
    { name: "soy sauce", aiStatus: "gluten_free", aiReason: "Wrong." },
    { name: "fish sauce", aiStatus: "contains", aiReason: "Different." },
    { name: "chili paste", aiStatus: "may_contain", aiReason: "Some add wheat." },
    { name: "mystery", aiStatus: "nonsense" }
  ]);
  assert.deepEqual(labels.map((l) => l.status), ["contains", "gluten_free", "may_contain", "unknown"]);
  assert.equal((await t.db.IngredientChecks.findOne({ where: { key: "chili paste" } })).reason, "Some add wheat.");
  assert.equal(await t.db.IngredientChecks.count(), 2);
});

test("the recipe cross-check uses the dictionary for ingredients the rules don't know", async () => {
  await t.db.IngredientChecks.create({ key: "chili bean paste", status: "contains", reason: "Usually has wheat.", checked_at: new Date() });
  spoonacular.searchIngredients = async () => [
    { title: "Mapo tofu", source_url: null, gluten_free: false, ingredients: ["tofu", "chili bean paste"] },
    { title: "Easy mapo tofu", source_url: null, gluten_free: false, ingredients: ["tofu", "garlic"] }
  ];
  const result = await dishCheck.crossCheckRecipes("mapo tofu");
  assert.deepEqual([result.checked, result.with_gluten], [2, 1]);
  assert.deepEqual(result.examples[0].gluten, ["chili bean paste"]);
});

test("hidden gluten is caught by the rules without any lookup", () => {
  const status = (name) => (gluten.classifyName(name) || {}).status;
  assert.equal(status("Hoisin sauce"), "contains");
  assert.equal(status("Gluten-free hoisin sauce"), "gluten_free");
  assert.equal(status("Beef gravy"), "contains");
  assert.equal(status("Imitation crab"), "contains");
  assert.equal(status("Oyster sauce"), "may_contain");
  assert.equal(status("White miso paste"), "may_contain");
  assert.equal(status("Cornstarch"), "gluten_free");
  assert.equal(status("Rice vinegar"), "gluten_free");
  assert.equal(status("Tapioca pudding with cookie crumbs"), "contains");
  assert.equal(status("Spaghetti squash"), "gluten_free");
});
