// Sign-in for the iPhone app.
//
// 1. The app opens /auth/mobile/start in a secure browser sheet, with where to
//    come back to (redirect_uri) and a PKCE code_challenge.
// 2. The person signs in with Google exactly as on the website.
// 3. The server sends the browser back to the app with a one-time code (good
//    for 2 minutes, once).
// 4. The app swaps the code, plus the secret behind its code_challenge, for a
//    long-lived token at POST /auth/mobile/token. A code caught by anything
//    else is useless without that secret.
// 5. The app sends "Authorization: Bearer <token>" with every API call, and
//    every existing route sees the user just as with a website login.
const crypto = require("crypto");
const db = require("../models");
const { isPrivateAddress } = require("./safeFetch");

const CODE_TTL_MS = 2 * 60 * 1000;
const START_TTL_MS = 10 * 60 * 1000;
const TOKEN_TTL_MS = 180 * 24 * 60 * 60 * 1000;
const TOUCH_EVERY_MS = 60 * 60 * 1000;
const APP_SCHEME = "fridgebook:";

const sha256 = (value) => crypto.createHash("sha256").update(value).digest();
const hashToken = (token) => sha256(token).toString("hex");
const base64url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/**
 * Where the browser may send someone back to: the app's own fridgebook://
 * address, or, only while MOBILE_DEV_REDIRECTS is "true", an Expo Go address
 * on a private network (the computer running the app in development).
 */
function allowedRedirect(value) {
  let url;
  try { url = new URL(String(value || "")); } catch (e) { return null; }
  if (url.protocol === APP_SCHEME) return url;
  if (process.env.MOBILE_DEV_REDIRECTS === "true" && url.protocol === "exp:") {
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (host === "localhost" || isPrivateAddress(host)) return url;
  }
  return null;
}

const isChallenge = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);

// One-time codes live in memory for 2 minutes; a server restart just means signing in again
const codes = new Map();

function issueCode(userId, challenge) {
  const now = Date.now();
  for (const [key, entry] of codes) if (now - entry.at > CODE_TTL_MS) codes.delete(key);
  const code = base64url(crypto.randomBytes(32));
  codes.set(hashToken(code), { userId, challenge, at: now });
  return code;
}

// Returns the user id for a valid code and matching verifier (once), else null
function redeemCode(code, verifier) {
  if (typeof code !== "string" || typeof verifier !== "string" || verifier.length < 43 || verifier.length > 128) return null;
  const key = hashToken(code);
  const entry = codes.get(key);
  if (!entry) return null;
  codes.delete(key); // one attempt only
  if (Date.now() - entry.at > CODE_TTL_MS) return null;
  const expected = Buffer.from(entry.challenge);
  const actual = Buffer.from(base64url(sha256(verifier)));
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  return entry.userId;
}

async function createToken(userId, deviceName) {
  const token = `fbm_${base64url(crypto.randomBytes(32))}`;
  await db.MobileTokens.create({
    token_hash: hashToken(token),
    UserId: userId,
    device_name: typeof deviceName === "string" ? deviceName.trim().slice(0, 80) || null : null,
    expires_at: new Date(Date.now() + TOKEN_TTL_MS),
    last_used_at: new Date()
  });
  return token;
}

/**
 * Express middleware: a request with "Authorization: Bearer <token>" is
 * signed in as that token's user. A bad or expired token gets a 401 (never
 * silently treated as logged out).
 */
async function bearer(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !/^Bearer\s+/i.test(header)) return next();
  const token = header.replace(/^Bearer\s+/i, "").trim();
  try {
    const row = token ? await db.MobileTokens.findOne({ where: { token_hash: hashToken(token) } }) : null;
    const user = row && row.expires_at > new Date() ? await db.Users.findByPk(row.UserId) : null;
    if (!user) return res.status(401).json({ error: "Your sign-in has expired. Please sign in again." });
    req.user = user;
    req.mobileToken = row;
    if (!row.last_used_at || Date.now() - new Date(row.last_used_at).getTime() > TOUCH_EVERY_MS) {
      await row.update({ last_used_at: new Date() });
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  allowedRedirect, isChallenge, issueCode, redeemCode, createToken, bearer, hashToken,
  START_TTL_MS, clearCodes: () => codes.clear()
};
