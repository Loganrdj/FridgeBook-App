const router = require("express").Router();
const passport = require("passport");
const mobileAuth = require("../lib/mobileAuth");

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000/";

/* google log in*/
router.get("/google", passport.authenticate("google", { scope: ["profile"] }));

// Sends the sign-in browser back to the app with ?code=... or ?error=...
function backToApp(redirectUri, params) {
    const url = new URL(redirectUri);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return url.href;
}

// A sign-in started by the app (see /mobile/start) finishes here: no website
// login, just a one-time code handed back to the app
function finishAppSignIn(req, res, next) {
    const pending = req.session && req.session.mobileLogin;
    if (!pending) return next();
    delete req.session.mobileLogin;
    if (Date.now() - pending.at > mobileAuth.START_TTL_MS || !mobileAuth.allowedRedirect(pending.redirect_uri)) {
        return res.redirect(new URL("/?login=failed", CLIENT_URL).href);
    }
    passport.authenticate("google", { session: false }, (err, user) => {
        if (err || !user) return res.redirect(backToApp(pending.redirect_uri, { error: "cancelled" }));
        res.redirect(backToApp(pending.redirect_uri, { code: mobileAuth.issueCode(user.id, pending.challenge) }));
    })(req, res, next);
}

// Logged-in users land on the dashboard; a cancelled or failed sign-in goes back to the landing page
router.get("/google/redirect",
    finishAppSignIn,
    passport.authenticate("google", { failureRedirect: new URL("/?login=failed", CLIENT_URL).href }),
    (req, res) => {
        res.redirect(new URL("/dashboard", CLIENT_URL).href);
    });


/* log out */
router.get("/logout", (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        res.redirect(CLIENT_URL);
    });
});

/* ---------- iPhone app sign-in (see lib/mobileAuth.js) ---------- */

// GET /auth/mobile/start?redirect_uri=fridgebook://auth&code_challenge=...
router.get("/mobile/start", (req, res) => {
    const redirect = mobileAuth.allowedRedirect(req.query.redirect_uri);
    if (!redirect || !mobileAuth.isChallenge(req.query.code_challenge)) {
        return res.status(400).send("This sign-in link isn't valid. Please start again from the FridgeBook app.");
    }
    req.session.mobileLogin = { redirect_uri: redirect.href, challenge: req.query.code_challenge, at: Date.now() };
    req.session.save((err) => {
        if (err) return res.status(500).send("Something went wrong. Please try again.");
        res.redirect("/auth/google");
    });
});

// POST /auth/mobile/token { code, code_verifier, device_name? } -> { token, user }
router.post("/mobile/token", async (req, res) => {
    const body = req.body || {};
    const userId = mobileAuth.redeemCode(body.code, body.code_verifier);
    if (!userId) return res.status(400).json({ error: "That sign-in didn't finish. Please try again." });
    try {
        const db = require("../models");
        const user = await db.Users.findByPk(userId);
        if (!user) return res.status(400).json({ error: "That sign-in didn't finish. Please try again." });
        const token = await mobileAuth.createToken(user.id, body.device_name);
        res.json({
            token,
            user: { user_id: user.id, user_name: user.name, celiac_mode: !!user.celiac_mode, celiac_strict: !!user.celiac_strict }
        });
    } catch (err) {
        console.error("App sign-in failed:", err.message);
        res.status(500).json({ error: "Something went wrong. Please try again." });
    }
});

// DELETE /auth/mobile/token: signs this app out (the token stops working)
router.delete("/mobile/token", async (req, res) => {
    if (!req.mobileToken) return res.status(401).json({ error: "Not logged in" });
    try {
        await req.mobileToken.destroy();
        res.status(204).end();
    } catch (err) {
        console.error("App sign-out failed:", err.message);
        res.status(500).json({ error: "Something went wrong" });
    }
});

module.exports = router;
