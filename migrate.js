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

function runMigrations() {
  return umzug.up();
}

module.exports = { umzug, runMigrations };

// `node migrate.js` applies migrations; `node migrate.js down` undoes the last one
if (require.main === module) {
  const action = process.argv[2] === "down" ? umzug.down() : umzug.up();
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
