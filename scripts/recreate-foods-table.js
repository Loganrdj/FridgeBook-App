// One-time migration: recreate the Foods table with the current column types
// (integer quantity, date-only expiration). Refuses to run if it holds any rows.
//
//   NODE_ENV=production DATABASE_URL=... node scripts/recreate-foods-table.js
const db = require("../models");

(async () => {
  const tables = await db.sequelize.getQueryInterface().showAllTables();
  const exists = tables.map((t) => (typeof t === "string" ? t : t.tableName)).includes("Foods");
  const count = exists ? await db.Foods.count() : 0;
  if (count > 0) {
    console.error(`Foods has ${count} rows; not recreating it.`);
    process.exit(1);
  }
  await db.Foods.sync({ force: true });
  console.log("Foods table recreated.");
  await db.sequelize.close();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
