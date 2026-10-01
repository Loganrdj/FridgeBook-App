const express = require("express");
const router = require("./routes");

// load databse
var db = require("./models");

// load auth config
const passportSetup = require("./config/passport-config.js");
const myKeys = require("./config/keys.js");
const passport = require("passport");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());


var session = require("express-session");

// Render (and the Netlify proxy in front of it) terminate TLS upstream
app.set("trust proxy", 1);

// In production, keep sessions in Postgres so logins survive Render's free-tier
// spin-downs and redeploys (the default MemoryStore is wiped on every restart)
var sessionStore;
if (process.env.NODE_ENV === "production") {
  var PgSession = require("connect-pg-simple")(session);
  sessionStore = new PgSession({
    conObject: {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    },
    createTableIfMissing: true
  });
}

app.use(session({
  store: sessionStore,
  secret: myKeys.cookieSession.sessioinKey,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // stay logged in for 30 days
    httpOnly: true,
    sameSite: "lax", // not sent on cross-site POSTs, which blocks CSRF on the API
    secure: "auto" // HTTPS-only whenever the request came in over HTTPS
  }
}));
app.use(passport.initialize());
app.use(passport.session());

app.use(router);                                   //"backend routing/api call"

// Don't leak stack traces or database errors to clients
app.use(function (err, req, res, next) {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON" });
  }
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Something went wrong" });
});


var syncOptions = { force: false };
if (process.env.NODE_ENV === "test") {
  syncOptions.force = true;
}

db.sequelize.sync(syncOptions).then(function () {
  app.listen(PORT, function () {
    console.log(`Server now running on PORT ${PORT}.`);
  })
}).catch(function (err) {
  // Exit instead of hanging so the host reports the failed deploy right away
  console.error("Could not connect to the database:", err.message);
  process.exit(1);
});
