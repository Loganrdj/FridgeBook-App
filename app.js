// Builds the Express app (no listening, no migrations), so tests can load it too
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const router = require("./routes");
require("./config/passport-config.js");
const myKeys = require("./config/keys.js");

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Render (and the Netlify proxy in front of it) terminate TLS upstream
app.set("trust proxy", 1);

// Sessions live in Postgres so logins survive Render's free-tier spin-downs
// and redeploys (the default MemoryStore is wiped on every restart)
const PgSession = require("connect-pg-simple")(session);
const sessionStore = new PgSession({
  conObject: {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
  },
  createTableIfMissing: true
});

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

app.use(router);

// Don't leak stack traces or database errors to clients
app.use(function (err, req, res, next) {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON" });
  }
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Something went wrong" });
});

app.sessionStore = sessionStore;

module.exports = app;
