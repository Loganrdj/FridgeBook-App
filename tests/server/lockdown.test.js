// Supabase exposes the public schema through its Data API to the `anon` and
// `authenticated` roles. These tests set up those roles the way Supabase does
// and check that the server's start-up lock-down shuts them out.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startApp } = require("./helpers");

let t;
let migrate;
const q = (sql) => t.db.sequelize.query(sql);

before(async () => {
  t = await startApp({ migrate: false });
  migrate = require("../../migrate");
  // What a Supabase project has before any app tables exist
  await q(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    GRANT USAGE ON SCHEMA public TO anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
  `);
  await migrate.runMigrations();
  await t.db.Users.create({ name: "Someone" });
});
after(async () => { await t.stop(); });

test("every public table has row level security on", async () => {
  const [rows] = await q(`
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity`);
  assert.deepEqual(rows, []);
});

test("the Supabase API roles can't read or write any table", async () => {
  for (const role of ["anon", "authenticated"]) {
    for (const sql of [`SELECT * FROM "Users"`, `SELECT * FROM "session"`, `DELETE FROM "Foods"`]) {
      await assert.rejects(
        () => t.db.sequelize.transaction(async (tx) => {
          await t.db.sequelize.query(`SET LOCAL ROLE ${role}`, { transaction: tx });
          await t.db.sequelize.query(sql, { transaction: tx });
        }),
        /permission denied/,
        `${role}: ${sql}`
      );
    }
  }
});

test("tables created later are locked down on the next start", async () => {
  await q(`CREATE TABLE "Later" (id serial PRIMARY KEY)`);
  await migrate.lockDownTables();
  const [[row]] = await q(`SELECT relrowsecurity FROM pg_class WHERE relname = 'Later'`);
  assert.equal(row.relrowsecurity, true);
  const [grants] = await q(`
    SELECT grantee FROM information_schema.role_table_grants
    WHERE table_name = 'Later' AND grantee IN ('anon', 'authenticated')`);
  assert.deepEqual(grants, []);
  await q(`DROP TABLE "Later"`);
});

test("a non-superuser table owner (like Supabase's postgres) still sees its data", async () => {
  await q(`
    CREATE ROLE app_owner NOLOGIN NOSUPERUSER NOBYPASSRLS;
    GRANT CREATE, USAGE ON SCHEMA public TO app_owner;
    SET ROLE app_owner;
    CREATE TABLE "Owned" (id serial PRIMARY KEY, note text);
    INSERT INTO "Owned" (note) VALUES ('kept');
    RESET ROLE;
  `);
  await migrate.lockDownTables();
  const rows = await t.db.sequelize.transaction(async (tx) => {
    await t.db.sequelize.query(`SET LOCAL ROLE app_owner`, { transaction: tx });
    const [r] = await t.db.sequelize.query(`SELECT note FROM "Owned"`, { transaction: tx });
    return r;
  });
  assert.deepEqual(rows, [{ note: "kept" }]);
  const [[row]] = await q(`SELECT relrowsecurity FROM pg_class WHERE relname = 'Owned'`);
  assert.equal(row.relrowsecurity, true);
  await q(`DROP TABLE "Owned"`);
});

test("running it again changes nothing and doesn't fail", async () => {
  await migrate.lockDownTables();
  await migrate.lockDownTables();
});
