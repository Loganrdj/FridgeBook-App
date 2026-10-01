const router = require("express").Router();
const db = require("../models");
const { requireAuth, toBoolean, parseId, handleError } = require("./validation");
const { parseIngredient, serialize: serializeIngredient } = require("./apiRoutes");

const MAX_QUANTITY = 9999;
const MAX_BATCH = 100;
const SOURCES = ["manual", "kitchen", "recipe"];

router.use(requireAuth);

function serialize(item) {
    return {
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        note: item.note,
        checked: item.checked,
        source: item.source
    };
}

/**
 * Validates a shopping item and returns only the fields a client may set.
 * With partial = true (updates), missing fields are skipped.
 */
function parseItem(body, { partial = false } = {}) {
    const errors = [];
    const fields = {};
    body = body || {};

    if (!partial || body.name !== undefined) {
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (!name || name.length > 100) errors.push("name must be 1-100 characters");
        else fields.name = name;
    }

    if (body.quantity !== undefined || !partial) {
        const quantity = body.quantity === undefined ? 1 : Number(body.quantity);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
            errors.push(`quantity must be a whole number from 1 to ${MAX_QUANTITY}`);
        } else {
            fields.quantity = quantity;
        }
    }

    if (body.note !== undefined) {
        if (body.note === null || body.note === "") fields.note = null;
        else if (typeof body.note !== "string" || body.note.trim().length > 100) errors.push("note must be up to 100 characters");
        else fields.note = body.note.trim();
    }

    if (partial && body.checked !== undefined) {
        const checked = toBoolean(body.checked);
        if (checked === undefined) errors.push("checked must be true or false");
        else fields.checked = checked;
    }

    if (!partial) {
        fields.source = SOURCES.includes(body.source) ? body.source : "manual";
    }

    return { errors, fields };
}

function findOwnItem(req) {
    const id = parseId(req.params.id);
    if (!id) return Promise.resolve(null);
    return db.ShoppingItems.findOne({ where: { id, UserId: req.user.id } });
}

const fail = (res) => handleError(res, "Shopping route");

/**
 * route = /api/shopping
 */
router.route("/")
    // the user's list: still-needed items first, oldest first
    .get((req, res) => {
        db.ShoppingItems.findAll({
            where: { UserId: req.user.id },
            order: [["checked", "ASC"], ["id", "ASC"]]
        })
            .then(items => res.json(items.map(serialize)))
            .catch(fail(res));
    })
    // add an item; adding something already on the list (unchecked) bumps its quantity instead
    .post(async (req, res) => {
        const { errors, fields } = parseItem(req.body);
        if (errors.length) return res.status(422).json({ errors });
        try {
            const existing = await db.ShoppingItems.findOne({
                where: {
                    UserId: req.user.id,
                    checked: false,
                    name: db.sequelize.where(db.sequelize.fn("lower", db.sequelize.col("name")), fields.name.toLowerCase())
                }
            });
            if (existing) {
                const quantity = Math.min(MAX_QUANTITY, existing.quantity + fields.quantity);
                await existing.update({ quantity, note: existing.note || fields.note || null });
                return res.status(200).json({ ...serialize(existing), merged: true });
            }
            const item = await db.ShoppingItems.create({ ...fields, UserId: req.user.id });
            res.status(201).json(serialize(item));
        } catch (err) {
            fail(res)(err);
        }
    });

/**
 * route = /api/shopping/checked
 * Removes every checked item ("Clear checked")
 */
router.delete("/checked", (req, res) => {
    db.ShoppingItems.destroy({ where: { UserId: req.user.id, checked: true } })
        .then(removed => res.json({ removed }))
        .catch(fail(res));
});

/**
 * route = /api/shopping/to-kitchen
 * Moves bought items into the kitchen in one step:
 * { items: [{ id, date_expire, fridge_bool, quantity? }] }
 */
router.post("/to-kitchen", async (req, res) => {
    const entries = Array.isArray(req.body && req.body.items) ? req.body.items : null;
    if (!entries || entries.length === 0) return res.status(422).json({ errors: ["items must be a non-empty array"] });
    if (entries.length > MAX_BATCH) return res.status(422).json({ errors: [`at most ${MAX_BATCH} items`] });

    const ids = entries.map((entry) => parseId(entry && entry.id));
    if (ids.some((id) => !id) || new Set(ids).size !== ids.length) {
        return res.status(422).json({ errors: ["each item needs a unique id"] });
    }

    try {
        const items = await db.ShoppingItems.findAll({ where: { id: ids, UserId: req.user.id } });
        if (items.length !== ids.length) return res.status(404).json({ error: "Not found" });
        const byId = new Map(items.map((item) => [item.id, item]));

        const rows = [];
        const errors = [];
        entries.forEach((entry, index) => {
            const item = byId.get(ids[index]);
            const parsed = parseIngredient({
                name: item.name,
                quantity: entry.quantity === undefined ? item.quantity : entry.quantity,
                date_expire: entry.date_expire,
                date_start: entry.date_start,
                fridge_bool: entry.fridge_bool
            });
            if (parsed.errors.length) errors.push(`${item.name}: ${parsed.errors.join(", ")}`);
            else rows.push({ ...parsed.fields, UserId: req.user.id });
        });
        if (errors.length) return res.status(422).json({ errors });

        const created = await db.sequelize.transaction(async (transaction) => {
            const foods = await db.Foods.bulkCreate(rows, { transaction });
            await db.ShoppingItems.destroy({ where: { id: ids, UserId: req.user.id }, transaction });
            return foods;
        });
        res.status(201).json({ moved: created.length, ingredients: created.map(serializeIngredient) });
    } catch (err) {
        fail(res)(err);
    }
});

/**
 * route = /api/shopping/:id
 */
router.route("/:id")
    // edit name, quantity, note, or check it off
    .patch(async (req, res) => {
        const { errors, fields } = parseItem(req.body, { partial: true });
        if (errors.length) return res.status(422).json({ errors });
        if (!Object.keys(fields).length) return res.status(422).json({ errors: ["nothing to update"] });
        try {
            const item = await findOwnItem(req);
            if (!item) return res.status(404).json({ error: "Not found" });
            await item.update(fields);
            res.json(serialize(item));
        } catch (err) {
            fail(res)(err);
        }
    })
    .delete(async (req, res) => {
        try {
            const item = await findOwnItem(req);
            if (!item) return res.status(404).json({ error: "Not found" });
            await item.destroy();
            res.status(204).end();
        } catch (err) {
            fail(res)(err);
        }
    });

module.exports = router;
