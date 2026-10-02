const router = require("express").Router();

// Who is logged in (an empty response means nobody)
router.get("/profile", (req, res) => {
    if (req.isAuthenticated()) {
        // the id lets the browser keep per-account data (like recipe history) apart on shared devices
        res.json({ user_id: req.user.id, user_name: req.user.name });
    } else {
        res.end();
    }
});

module.exports = router;
