// Runs a local Postgres for development (data kept in .devdb/). Leave it running,
// then in another terminal:
//   DATABASE_URL=postgres://postgres:postgres@localhost:5433/fridgebook npm run start:server
const path = require("path");
const fs = require("fs");
const EmbeddedPostgres = require("embedded-postgres").default;

const dir = path.join(__dirname, "..", ".devdb");
const pg = new EmbeddedPostgres({ databaseDir: dir, port: 5433, user: "postgres", password: "postgres", persistent: true });

(async () => {
  const fresh = !fs.existsSync(path.join(dir, "PG_VERSION"));
  if (fresh) await pg.initialise();
  await pg.start();
  if (fresh) await pg.createDatabase("fridgebook");
  console.log("Postgres running: postgres://postgres:postgres@localhost:5433/fridgebook (Ctrl+C to stop)");
  process.on("SIGINT", async () => { await pg.stop(); process.exit(0); });
})().catch((err) => { console.error(err.message); process.exit(1); });
