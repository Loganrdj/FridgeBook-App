const app = require("./app");
const { runMigrations } = require("./migrate");

const PORT = process.env.PORT || 8080;

// Bring the database schema up to date, then start serving
runMigrations().then(function () {
  app.listen(PORT, function () {
    console.log(`Server now running on PORT ${PORT}.`);
  });
}).catch(function (err) {
  // Exit instead of hanging so the host reports the failed deploy right away
  console.error("Database setup failed:", err.message);
  process.exit(1);
});
