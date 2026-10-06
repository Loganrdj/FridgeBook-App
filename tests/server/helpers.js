// Test helpers: a throwaway Postgres, the app on a random port, and fake logins.
//
// Each test file runs in its own process, so it gets its own database. Set
// TEST_DATABASE_URL to use an existing (empty) database instead.
const os = require("os");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

async function startDatabase() {
  if (process.env.TEST_DATABASE_URL) {
    return { url: process.env.TEST_DATABASE_URL, stop: async () => {} };
  }
  const EmbeddedPostgres = require("embedded-postgres").default;
  const port = 20000 + Math.floor(Math.random() * 20000);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fridgebook-test-db-"));
  const pg = new EmbeddedPostgres({ databaseDir: dir, port, user: "postgres", password: "postgres", persistent: false, onLog: () => {} });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("fridgebook_test");
  return {
    url: `postgres://postgres:postgres@localhost:${port}/fridgebook_test`,
    stop: async () => {
      await pg.stop();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
}

/**
 * Starts a database, runs migrations, and starts the app. Must be called
 * before anything requires the app or models (they read env vars on load).
 */
async function startApp({ migrate = true } = {}) {
  const database = await startDatabase();
  Object.assign(process.env, {
    NODE_ENV: "test",
    DATABASE_URL: database.url,
    SESSION_SECRET: "test-secret",
    GOOGLE_CLIENT_ID: "test-client-id",
    GOOGLE_CLIENT_SECRET: "test-client-secret",
    CLIENT_URL: "https://fridge-book.com/"
  });

  const db = require("../../models");
  const { umzug } = require("../../migrate");
  if (migrate) await umzug.up();
  const app = require("../../app");
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  // Logs in as a new user by writing a session straight into the store,
  // the same thing Passport does after a successful Google sign-in
  async function login(name) {
    const user = await db.Users.create({ name, googleID: `google-${crypto.randomUUID()}` });
    const sid = crypto.randomUUID();
    await new Promise((resolve, reject) => app.sessionStore.set(sid, {
      cookie: { originalMaxAge: 86400000, expires: new Date(Date.now() + 86400000), httpOnly: true, path: "/" },
      passport: { user: user.id }
    }, (err) => (err ? reject(err) : resolve())));
    const signature = crypto.createHmac("sha256", process.env.SESSION_SECRET).update(sid).digest("base64").replace(/=+$/, "");
    return { user, cookie: `connect.sid=${encodeURIComponent(`s:${sid}.${signature}`)}` };
  }

  // fetch wrapper: request(method, path, { cookie, body, raw, contentType })
  async function request(method, urlPath, { cookie, body, raw, contentType } = {}) {
    const headers = {};
    if (cookie) headers.Cookie = cookie;
    if (body !== undefined || raw !== undefined) headers["Content-Type"] = contentType || "application/json";
    const res = await fetch(base + urlPath, {
      method,
      headers,
      body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
      redirect: "manual"
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch (e) { json = undefined; }
    return { status: res.status, body: json, text, location: res.headers.get("location") };
  }

  async function stop() {
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => app.sessionStore.close ? (app.sessionStore.close(), resolve()) : resolve());
    await db.sequelize.close();
    await database.stop();
  }

  return { db, umzug, login, request, stop, base, app };
}

module.exports = { startApp, startDatabase };
