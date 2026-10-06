const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startApp } = require("./helpers");

let t;
before(async () => { t = await startApp({ migrate: false }); });
after(async () => { await t.stop(); });

async function tables() {
  const names = await t.db.sequelize.getQueryInterface().showAllTables();
  return names.map((n) => (typeof n === "string" ? n : n.tableName)).sort();
}

test("the baseline keeps existing tables and data (like production)", async () => {
  // A database created before migrations existed, with a user in it
  await t.db.sequelize.query(`
    CREATE TABLE "Users" (id serial PRIMARY KEY, name varchar(255) NOT NULL, "googleID" varchar(255),
      "createdAt" timestamptz NOT NULL, "updatedAt" timestamptz NOT NULL);
    INSERT INTO "Users" (name, "createdAt", "updatedAt") VALUES ('Existing user', now(), now());
  `);

  await t.umzug.up();

  const [users] = await t.db.sequelize.query(`SELECT name FROM "Users"`);
  assert.deepEqual(users, [{ name: "Existing user" }]);
  assert.deepEqual(await tables(), ["AiUsages", "DishChecks", "Foods", "IngredientChecks", "MealPlans", "ProductChecks", "RecipeStats", "RestaurantChecks", "SequelizeMeta", "ShoppingItems", "Users", "session"]);
});

test("the tables match the models", async () => {
  const foods = await t.db.sequelize.getQueryInterface().describeTable("Foods");
  assert.equal(foods.quantity.type, "INTEGER");
  assert.equal(foods.date_expire.type, "DATE");
  assert.equal(foods.UserId.allowNull, false);
  // The models can read and write the migrated tables
  const user = await t.db.Users.create({ name: "New user" });
  const food = await t.db.Foods.create({ name: "Eggs", quantity: 12, date_start: "2026-10-01", date_expire: "2026-10-20", fridge_bool: true, UserId: user.id });
  assert.equal((await t.db.Foods.findByPk(food.id)).date_expire, "2026-10-20");
});

test("running migrations again does nothing", async () => {
  const applied = await t.umzug.up();
  assert.deepEqual(applied, []);
  assert.equal((await t.umzug.pending()).length, 0);
});

test("the newest migration can be undone and redone", async () => {
  const before = await tables();
  const [undone] = await t.umzug.down();
  assert.notEqual(undone.name, "20261001000000-baseline.js");
  assert.ok((await tables()).length < before.length, `${undone.name} should drop a table`);
  await t.umzug.up();
  assert.deepEqual(await tables(), before);
});

test("the baseline can't be undone (it would drop all data)", async () => {
  await assert.rejects(() => t.umzug.down({ to: 0 }), /can't be undone/);
  assert.ok((await tables()).includes("Users"));
  const [users] = await t.db.sequelize.query(`SELECT name FROM "Users" ORDER BY id`);
  assert.equal(users[0].name, "Existing user");
});
