const { test } = require("node:test");
const assert = require("node:assert/strict");
const gemini = require("../../lib/gemini");
const { classifyName, classifyNames, scanIngredientsText } = require("../../lib/gluten");

const status = (name) => (classifyName(name) || { status: null }).status;

test("flags foods that contain gluten", () => {
  for (const name of ["Sourdough bread", "Pasta", "Flour tortillas whole wheat", "Bagels", "Beer", "Panko breadcrumbs", "Soy sauce", "Chicken nuggets", "Spaghetti", "All-purpose flour", "Malt vinegar"]) {
    assert.equal(status(name), "contains", name);
  }
});

test("doesn't flag look-alikes made without gluten", () => {
  for (const name of ["Rice noodles", "Almond flour", "Corn tortillas", "Rice crackers", "Buckwheat groats", "Gluten-free bread", "GF pasta", "Tamari soy sauce"]) {
    assert.notEqual(status(name), "contains", name);
  }
});

test("oats are a 'may contain' unless labeled gluten-free", () => {
  assert.equal(status("Rolled oats"), "may_contain");
  assert.equal(status("Granola"), "may_contain");
  assert.equal(status("Gluten-free rolled oats"), "gluten_free");
});

test("plain whole foods are gluten-free", () => {
  for (const name of ["Eggs", "Milk (2%)", "Greek yogurt", "Cheddar cheese", "Salmon fillets", "Boneless chicken thighs", "Strawberries", "Broccoli", "Canned tomatoes", "Black beans", "Basmati rice", "Honey", "Olive oil", "Peanut butter", "Bell peppers"]) {
    assert.equal(status(name), "gluten_free", name);
  }
});

test("judges by the main food word, ignoring varieties", () => {
  for (const name of ["Basmati rice", "Honeycrisp apples", "Roma tomatoes", "Yukon gold potatoes"]) {
    assert.equal(status(name), "gluten_free", name);
  }
});

test("leaves processed or ambiguous foods for a closer check", () => {
  for (const name of ["Tortillas", "Cereal", "Chicken broth", "Salad dressing", "Hot dogs", "Chocolate bar", "Potato chips", "Corn flakes", "Chicken soup"]) {
    assert.equal(classifyName(name), null, name);
  }
});

test("classifyNames asks AI only about undecided items, in one call", async () => {
  const real = gemini.generateJson;
  const calls = [];
  gemini.generateJson = async (args) => {
    calls.push(args);
    return { data: { items: [{ index: 0, status: "may_contain", reason: "Many cereals contain malt." }, { index: 1, status: "bogus", reason: "x" }] } };
  };
  try {
    const out = await classifyNames(["Bread", "Cereal", "Eggs", "Chicken broth"]);
    assert.equal(calls.length, 1);
    assert.match(calls[0].prompt, /0: Cereal\n1: Chicken broth/);
    assert.deepEqual(out.map((r) => r.status), ["contains", "may_contain", "gluten_free", "unknown"]);
  } finally {
    gemini.generateJson = real;
  }
});

test("classifyNames survives an AI failure", async () => {
  const real = gemini.generateJson;
  gemini.generateJson = async () => { throw new Error("down"); };
  try {
    const [result] = await classifyNames(["Cereal"]);
    assert.equal(result.status, "unknown");
    assert.equal(result.retry, true);
  } finally {
    gemini.generateJson = real;
  }
});

test("reads ingredient lists and allergen warnings", () => {
  assert.equal(scanIngredientsText("Corn, sugar, malt flavoring, salt").status, "contains");
  assert.equal(scanIngredientsText("Rice, sugar. May contain wheat.").status, "may_contain");
  assert.equal(scanIngredientsText("Made in a facility that also processes wheat").status, "may_contain");
  assert.equal(scanIngredientsText("Wheat flour, sugar. Made in a facility that also processes nuts.").status, "contains");
  assert.equal(scanIngredientsText("Buckwheat flour, water, salt"), null);
  assert.equal(scanIngredientsText("Whole grain oats, sugar").status, "may_contain");
  assert.equal(scanIngredientsText(""), null);
});
