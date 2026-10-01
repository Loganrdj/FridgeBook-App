const router = require("express").Router();

// Who is logged in (an empty response means nobody)
router.get("/profile", (req, res) => {
    if (req.isAuthenticated()) {
        res.json({ user_name: req.user.name });
    } else {
        res.end();
    }
});

module.exports = router;
