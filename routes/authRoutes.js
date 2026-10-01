const router = require("express").Router();
const passport = require("passport");


const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000/";

/* google log in*/
router.get("/google", passport.authenticate("google", { scope: ["profile"] }));

// Logged-in users land on the dashboard; a cancelled or failed sign-in goes back to the landing page
router.get("/google/redirect",
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

module.exports = router;