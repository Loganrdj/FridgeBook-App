// Applies pending database migrations (files in migrations/, run in name order).
// The server runs this on every start; applied migrations are recorded in the
// SequelizeMeta table so each one only runs once.
const path = require("path");
const { Umzug, SequelizeStorage } = require("umzug");
const db = require("./models");

const umzug = new Umzug({
  migrations: {
    glob: ["migrations/*.js", { cwd: __dirname }],
    resolve: ({ name, path: file, context }) => {
      const migration = require(file);
      return {
        name,
        up: () => migration.up(context, db.Sequelize),
        down: () => migration.down(context, db.Sequelize)
      };
    }
  },
  context: db.sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize: db.sequelize }),
  logger: process.env.NODE_ENV === "test" ? undefined : console
});

// Supabase publishes the `public` schema through its Data API (PostgREST), and
// gives its `anon` and `authenticated` roles full access to every table the
// `postgres` user creates. This app never uses that API: the server connects
// straight to Postgres as the table owner, which RLS doesn't restrict. So every
// table gets RLS switched on with no policies (the Data API sees nothing), and
// the Supabase roles lose their grants. It runs on every start, so tables added
// by future migrations are covered too. On plain Postgres (dev, tests) the
// Supabase roles don't exist and only the RLS step runs.
const LOCK_DOWN_SQL = `
DO $$
DECLARE
  t record;
  r text;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
      AND NOT c.relrowsecurity AND pg_has_role(c.relowner, 'USAGE')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;

  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
    END IF;
  END LOOP;
END
$$;`;

function lockDownTables() {
  return db.sequelize.query(LOCK_DOWN_SQL);
}

async function runMigrations() {
  const done = await umzug.up();
  await lockDownTables();
  return done;
}

module.exports = { umzug, runMigrations, lockDownTables };

// `node migrate.js` applies migrations; `node migrate.js down` undoes the last one
if (require.main === module) {
  const action = process.argv[2] === "down" ? umzug.down() : runMigrations();
  action
    .then((done) => {
      console.log(done.length ? `Done: ${done.map((m) => m.name).join(", ")}` : "Nothing to do.");
      return db.sequelize.close();
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
