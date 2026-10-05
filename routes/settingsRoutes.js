const router = require("express").Router();
const { requireAuth, toBoolean, handleError } = require("./validation");

router.use(requireAuth);

const serialize = (user) => ({ celiac_mode: !!user.celiac_mode, celiac_strict: !!user.celiac_strict });

/**
 * route = /api/me/settings
 */
router.route("/settings")
    .get((req, res) => res.json(serialize(req.user)))
    // { celiac_mode?, celiac_strict? }
    .patch(async (req, res) => {
        const fields = {};
        const errors = [];
        for (const key of ["celiac_mode", "celiac_strict"]) {
            if (req.body && req.body[key] !== undefined) {
                const value = toBoolean(req.body[key]);
                if (value === undefined) errors.push(`${key} must be true or false`);
                else fields[key] = value;
            }
        }
        if (errors.length) return res.status(422).json({ errors });
        if (!Object.keys(fields).length) return res.status(422).json({ errors: ["nothing to update"] });
        try {
            await req.user.update(fields);
            res.json(serialize(req.user));
        } catch (err) {
            handleError(res, "Settings")(err);
        }
    });

module.exports = router;
