const { test, before, after, beforeEach, describe } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { startApp } = require("./helpers");

let t, passport, mobileAuth, googleUser, googleFails;
before(async () => {
  t = await startApp();
  passport = require("passport");
  mobileAuth = require("../../lib/mobileAuth");
  // Stands in for Google: signs in as googleUser, or fails like a cancelled sign-in
  const { Strategy } = require("passport-strategy");
  class FakeGoogle extends Strategy {
    constructor() { super(); this.name = "google"; }
    authenticate() { return googleFails ? this.fail() : this.success(googleUser); }
  }
  passport.use(new FakeGoogle());
});
after(async () => { await t.stop(); });

beforeEach(async () => {
  googleFails = false;
  googleUser = await t.db.Users.create({ name: "Logan Moss", googleID: `g-${crypto.randomUUID()}` });
  mobileAuth.clearCodes();
  delete process.env.MOBILE_DEV_REDIRECTS;
});

const b64url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
function pkce() {
  const verifier = b64url(crypto.randomBytes(32));
  return { verifier, challenge: b64url(crypto.createHash("sha256").update(verifier).digest()) };
}

// Walks the browser part: start -> (Google) -> back to the app. Returns the app URL it lands on.
async function signInInBrowser({ redirect = "fridgebook://auth", challenge }) {
  const start = await fetch(`${t.base}/auth/mobile/start?${new URLSearchParams({ redirect_uri: redirect, code_challenge: challenge })}`, { redirect: "manual" });
  assert.equal(start.status, 302, await start.text());
  assert.equal(start.headers.get("location"), "/auth/google");
  const cookie = start.headers.get("set-cookie").split(";")[0];
  const back = await fetch(`${t.base}/auth/google/redirect?code=from-google`, { headers: { Cookie: cookie }, redirect: "manual" });
  assert.equal(back.status, 302);
  return { url: new URL(back.headers.get("location")), cookie };
}

async function getToken(code, verifier, extra = {}) {
  return t.request("POST", "/auth/mobile/token", { body: { code, code_verifier: verifier, device_name: "Logan's iPhone", ...extra } });
}

const withToken = (token) => ({ headers: { Authorization: `Bearer ${token}` } });
async function api(method, path, token, body) {
  const res = await fetch(t.base + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

describe("signing in from the app", () => {
  test("Google sign-in hands the app a one-time code it swaps for a token", async () => {
    const { verifier, challenge } = pkce();
    const { url, cookie } = await signInInBrowser({ challenge });
    assert.equal(url.protocol, "fridgebook:");
    const code = url.searchParams.get("code");
    assert.ok(code);

    const res = await getToken(code, verifier);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.match(res.body.token, /^fbm_/);
    assert.deepEqual(res.body.user, { user_id: googleUser.id, user_name: "Logan Moss", celiac_mode: false, celiac_strict: false });
    const row = await t.db.MobileTokens.findOne({ where: { UserId: googleUser.id } });
    assert.equal(row.device_name, "Logan's iPhone");
    assert.notEqual(row.token_hash, res.body.token); // only a hash is stored

    // the token works on every existing API route
    const profile = await fetch(`${t.base}/profile`, withToken(res.body.token)).then((r) => r.json());
    assert.equal(profile.user_name, "Logan Moss");
    const added = await api("POST", "/api/ingredient", res.body.token, { name: "Eggs", quantity: 12, date_expire: "2030-01-01", fridge_bool: true });
    assert.equal(added.status, 201, JSON.stringify(added.body));
    assert.equal((await api("GET", "/api/ingredient", res.body.token)).body.length, 1);

    // the browser that did the sign-in isn't left logged in to the website
    assert.equal(await fetch(`${t.base}/profile`, { headers: { Cookie: cookie } }).then((r) => r.text()), "");
  });

  test("a code only works once, only with the app's secret, and only quickly", async () => {
    const { verifier, challenge } = pkce();
    const code = (await signInInBrowser({ challenge })).url.searchParams.get("code");
    assert.equal((await getToken(code, pkce().verifier)).status, 400); // someone else's secret
    assert.equal((await getToken(code, verifier)).status, 400); // already used up by that attempt

    const second = pkce();
    const code2 = (await signInInBrowser({ challenge: second.challenge })).url.searchParams.get("code");
    assert.equal((await getToken(code2, second.verifier)).status, 200);
    assert.equal((await getToken(code2, second.verifier)).status, 400);
    assert.equal((await getToken("made-up", second.verifier)).status, 400);
    assert.equal((await t.request("POST", "/auth/mobile/token", { body: {} })).status, 400);
  });

  test("a cancelled Google sign-in goes back to the app with an error", async () => {
    googleFails = true;
    const { url } = await signInInBrowser({ challenge: pkce().challenge });
    assert.equal(url.href, "fridgebook://auth?error=cancelled");
  });

  test("only the app's own address is allowed to receive codes", async () => {
    const { challenge } = pkce();
    const start = (redirect, c = challenge) => fetch(`${t.base}/auth/mobile/start?${new URLSearchParams({ redirect_uri: redirect, code_challenge: c })}`, { redirect: "manual" });
    for (const bad of ["https://evil.example/steal", "javascript:alert(1)", "exp://192.168.1.20:8081/--/auth", "", "fridgebook-evil://auth"]) {
      assert.equal((await start(bad)).status, 400, bad);
    }
    assert.equal((await start("fridgebook://auth", "short")).status, 400);

    // Expo Go during development: only on a private network, and only when switched on
    process.env.MOBILE_DEV_REDIRECTS = "true";
    assert.equal((await start("exp://192.168.1.20:8081/--/auth")).status, 302);
    assert.equal((await start("exp://evil.example.com/--/auth")).status, 400);
    assert.equal((await start("https://evil.example/steal")).status, 400);
  });

  test("the website's own Google sign-in still works the same way", async () => {
    const res = await fetch(`${t.base}/auth/google/redirect?code=x`, { redirect: "manual" });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get("location"), "https://fridge-book.com/dashboard");
  });
});

describe("app tokens", () => {
  async function tokenFor(user) {
    googleUser = user;
    const { verifier, challenge } = pkce();
    const code = (await signInInBrowser({ challenge })).url.searchParams.get("code");
    return (await getToken(code, verifier)).body.token;
  }

  test("each token only sees its own user's kitchen", async () => {
    const alice = await tokenFor(googleUser);
    const bob = await tokenFor(await t.db.Users.create({ name: "Bob", googleID: `g-${crypto.randomUUID()}` }));
    const item = (await api("POST", "/api/ingredient", alice, { name: "Milk", quantity: 1, date_expire: "2030-01-01", fridge_bool: true })).body;
    assert.equal((await api("GET", "/api/ingredient", bob)).body.length, 0);
    assert.equal((await api("DELETE", `/api/ingredient/${item.id}`, bob)).status, 404);
  });

  test("bad, expired and signed-out tokens are refused, never treated as logged out", async () => {
    assert.equal((await api("GET", "/api/ingredient", "fbm_made-up")).status, 401);
    const token = await tokenFor(googleUser);
    await t.db.MobileTokens.update({ expires_at: new Date(Date.now() - 1000) }, { where: { token_hash: mobileAuth.hashToken(token) } });
    const expired = await api("GET", "/api/ingredient", token);
    assert.equal(expired.status, 401);
    assert.match(expired.body.error, /sign in again/);

    const fresh = await tokenFor(googleUser);
    assert.equal((await api("DELETE", "/auth/mobile/token", fresh)).status, 204);
    assert.equal((await api("GET", "/api/ingredient", fresh)).status, 401);
    assert.equal((await t.request("DELETE", "/auth/mobile/token")).status, 401);
  });

  test("deleting a user removes their app sign-ins", async () => {
    const user = await t.db.Users.create({ name: "Temp", googleID: `g-${crypto.randomUUID()}` });
    const token = await tokenFor(user);
    await user.destroy();
    assert.equal(await t.db.MobileTokens.count({ where: { UserId: user.id } }), 0);
    assert.equal((await api("GET", "/profile", token)).status, 401);
  });
});
