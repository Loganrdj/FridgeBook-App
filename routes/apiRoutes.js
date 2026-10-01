const router = require("express").Router();
const db = require("../models");

const MAX_QUANTITY = 9999;
const MAX_IMPORT = 200;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * route = /api/health
 * Runs a trivial query so an external keep-alive ping counts as database
 * activity (Supabase's free tier pauses projects after a week without any).
 */
router.get("/health", (req, res) => {
    db.sequelize.query("SELECT 1")
        .then(() => res.json({ status: "ok" }))
        .catch(() => res.status(503).json({ status: "db_unavailable" }));
});

// Everything below belongs to the logged-in user only
function requireAuth(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ error: "Not logged in" });
}

function isValidDate(value) {
    if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
    const [y, m, d] = value.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function toBoolean(value) {
    if (value === true || value === "true") return true;
    if (value === false || value === "false") return false;
    return undefined;
}

function todayString() {
    return new Date().toISOString().slice(0, 10);
}

/**
 * Validates an ingredient from the request body and returns only the fields a
 * client may set. With partial = true (updates), missing fields are skipped.
 */
function parseIngredient(body, { partial = false } = {}) {
    const errors = [];
    const fields = {};
    body = body || {};

    if (!partial || body.name !== undefined) {
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (!name || name.length > 100) errors.push("name must be 1-100 characters");
        else fields.name = name;
    }

    if (!partial || body.quantity !== undefined) {
        const quantity = Number(body.quantity);
        const min = partial ? 0 : 1;
        if (!Number.isInteger(quantity) || quantity < min || quantity > MAX_QUANTITY) {
            errors.push(`quantity must be a whole number from ${min} to ${MAX_QUANTITY}`);
        } else {
            fields.quantity = quantity;
        }
    }

    if (!partial || body.date_expire !== undefined) {
        if (!isValidDate(body.date_expire)) errors.push("date_expire must be a date (YYYY-MM-DD)");
        else fields.date_expire = body.date_expire;
    }

    if (!partial) {
        // The client sends its own local date; fall back to the server's
        fields.date_start = isValidDate(body.date_start) ? body.date_start : todayString();
    }

    if (!partial || body.fridge_bool !== undefined) {
        const fridge = toBoolean(body.fridge_bool);
        if (fridge === undefined) errors.push("fridge_bool must be true or false");
        else fields.fridge_bool = fridge;
    }

    return { errors, fields };
}

function serialize(food) {
    return {
        id: food.id,
        name: food.name,
        quantity: food.quantity,
        date_start: food.date_start,
        date_expire: food.date_expire,
        fridge_bool: food.fridge_bool
    };
}

// Looks up an ingredient by :id, scoped to the current user
function findOwnIngredient(req) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return Promise.resolve(null);
    return db.Foods.findOne({ where: { id, UserId: req.user.id } });
}

function handleError(res) {
    return (err) => {
        console.error("Ingredient route failed:", err.message);
        res.status(500).json({ error: "Something went wrong" });
    };
}

/**
 * route = /api/ingredient
 */
router.route("/ingredient")
    // list the current user's ingredients
    .get(requireAuth, (req, res) => {
        db.Foods.findAll({
            where: { UserId: req.user.id },
            order: [["date_expire", "ASC"], ["id", "ASC"]]
        })
            .then(foods => res.json(foods.map(serialize)))
            .catch(handleError(res));
    })
    // add an ingredient for the current user
    .post(requireAuth, (req, res) => {
        const { errors, fields } = parseIngredient(req.body);
        if (errors.length) return res.status(422).json({ errors });

        db.Foods.create({ ...fields, UserId: req.user.id })
            .then(food => res.status(201).json(serialize(food)))
            .catch(handleError(res));
    });

/**
 * route = /api/ingredient/import
 * One-time copy of ingredients saved in the browser before accounts existed.
 * Invalid items are skipped rather than failing the whole import.
 */
router.post("/ingredient/import", requireAuth, (req, res) => {
    const items = Array.isArray(req.body && req.body.ingredients) ? req.body.ingredients : null;
    if (!items) return res.status(422).json({ errors: ["ingredients must be an array"] });
    if (items.length > MAX_IMPORT) return res.status(422).json({ errors: [`at most ${MAX_IMPORT} ingredients`] });

    const rows = [];
    let skipped = 0;
    for (const item of items) {
        const { errors, fields } = parseIngredient(item);
        if (errors.length) skipped++;
        else rows.push({ ...fields, UserId: req.user.id });
    }

    db.Foods.bulkCreate(rows)
        .then(created => res.status(201).json({ imported: created.length, skipped }))
        .catch(handleError(res));
});

/**
 * route = /api/ingredient/:id
 */
router.route("/ingredient/:id")
    // get one of the current user's ingredients
    .get(requireAuth, (req, res) => {
        findOwnIngredient(req)
            .then(food => food ? res.json(serialize(food)) : res.status(404).json({ error: "Not found" }))
            .catch(handleError(res));
    })
    // update fields; setting quantity to 0 removes the ingredient
    .patch(requireAuth, (req, res) => {
        const { errors, fields } = parseIngredient(req.body, { partial: true });
        if (errors.length) return res.status(422).json({ errors });
        if (!Object.keys(fields).length) return res.status(422).json({ errors: ["nothing to update"] });

        findOwnIngredient(req)
            .then(food => {
                if (!food) return res.status(404).json({ error: "Not found" });
                if (fields.quantity === 0) {
                    return food.destroy().then(() => res.json({ id: food.id, deleted: true }));
                }
                return food.update(fields).then(updated => res.json(serialize(updated)));
            })
            .catch(handleError(res));
    })
    // remove one of the current user's ingredients
    .delete(requireAuth, (req, res) => {
        findOwnIngredient(req)
            .then(food => {
                if (!food) return res.status(404).json({ error: "Not found" });
                return food.destroy().then(() => res.status(204).end());
            })
            .catch(handleError(res));
    });

module.exports = router;
