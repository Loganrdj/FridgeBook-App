const { test } = require("node:test");
const assert = require("node:assert/strict");
const { matches, isStaple, haveChecker } = require("../../lib/ingredientMatch");

test("matches the same ingredient written differently", () => {
  assert.ok(matches("Chicken thighs", "boneless skinless chicken thighs"));
  assert.ok(matches("Milk (2%)", "whole milk"));
  assert.ok(matches("Strawberries", "fresh strawberry"));
  assert.ok(matches("Cheddar cheese", "cheese"));
  assert.ok(matches("Tomatoes", "tomato"));
  assert.ok(matches("Berries", "berry"));
});

test("doesn't match different ingredients", () => {
  assert.ok(!matches("Bell peppers", "black pepper"));
  assert.ok(!matches("Chicken thighs", "chicken broth"));
  assert.ok(!matches("Olive oil", "butter"));
  assert.ok(!matches("", "milk"));
});

test("treats only true basics as always available", () => {
  for (const name of ["salt", "Kosher salt", "freshly ground black pepper", "salt and pepper", "water", "vegetable oil", "oil for frying"]) {
    assert.ok(isStaple(name), name);
  }
  for (const name of ["bell peppers", "red pepper flakes", "olive oil", "sesame oil", "salted butter", "coconut water"]) {
    assert.ok(!isStaple(name), name);
  }
});

test("haveChecker covers kitchen items and staples", () => {
  const have = haveChecker(["Spinach", "Chicken thighs", "Lemons"]);
  assert.ok(have("baby spinach"));
  assert.ok(have("lemon"));
  assert.ok(have("salt"));
  assert.ok(!have("parmesan"));
});
