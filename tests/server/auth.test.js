const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { startApp } = require("./helpers");

let t;
before(async () => { t = await startApp(); });
after(async () => { await t.stop(); });

test("health check runs a database query", async () => {
  const res = await t.request("GET", "/api/health");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: "ok" });
});

test("/profile is empty when logged out", async () => {
  const res = await t.request("GET", "/profile");
  assert.equal(res.status, 200);
  assert.equal(res.text, "");
});

test("/profile returns the user's id, name and settings", async () => {
  const { cookie } = await t.login("Alice Smith");
  const res = await t.request("GET", "/profile", { cookie });
  assert.deepEqual(res.body, { user_id: res.body.user_id, user_name: "Alice Smith", celiac_mode: false, celiac_strict: false });
  assert.ok(Number.isInteger(res.body.user_id));
});

test("sign-in sends the user to Google with the configured callback", async () => {
  const res = await t.request("GET", "/auth/google");
  assert.equal(res.status, 302);
  const location = new URL(res.location);
  assert.equal(location.hostname, "accounts.google.com");
  assert.equal(location.searchParams.get("client_id"), "test-client-id");
  assert.equal(location.searchParams.get("scope"), "profile");
});

test("a cancelled Google sign-in returns to the landing page", async () => {
  const res = await t.request("GET", "/auth/google/redirect?error=access_denied");
  assert.equal(res.status, 302);
  assert.equal(res.location, "https://fridge-book.com/?login=failed");
});

test("logout ends the session and returns to the landing page", async () => {
  const { cookie } = await t.login("Alice");
  assert.equal((await t.request("GET", "/api/ingredient", { cookie })).status, 200);
  const res = await t.request("GET", "/auth/logout", { cookie });
  assert.equal(res.status, 302);
  assert.equal(res.location, "https://fridge-book.com/");
  assert.equal((await t.request("GET", "/api/ingredient", { cookie })).status, 401);
});

test("a session for a deleted user counts as logged out", async () => {
  const { cookie, user } = await t.login("Ghost");
  await user.destroy();
  assert.equal((await t.request("GET", "/api/ingredient", { cookie })).status, 401);
});

test("a forged session cookie is rejected", async () => {
  const res = await t.request("GET", "/api/ingredient", { cookie: "connect.sid=s%3Afake.signature" });
  assert.equal(res.status, 401);
});

test("malformed JSON gets a 400 without internals", async () => {
  const { cookie } = await t.login("Alice");
  const res = await t.request("POST", "/api/ingredient", { cookie, raw: "{bad" });
  assert.equal(res.status, 400);
  assert.deepEqual(res.body, { error: "Invalid JSON" });
});

test("the API doesn't serve files at /", async () => {
  assert.equal((await t.request("GET", "/")).status, 404);
});
