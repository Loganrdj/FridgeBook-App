const router = require("express").Router();
const db = require("../models");
const { classifyNames } = require("../lib/gluten");
const { requireAuth, localDate, handleError } = require("./validation");

const DAILY_LIMIT = Number(process.env.GLUTEN_DAILY_LIMIT) || 30;

router.use(requireAuth);

async function usedToday(userId, kind, today) {
    const row = await db.AiUsages.findOne({ where: { UserId: userId, kind, day: today } });
    return row ? row.count : 0;
}

async function recordUse(userId, kind, today) {
    await db.sequelize.query(
        `INSERT INTO "AiUsages" ("UserId", kind, day, count, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 1, now(), now())
         ON CONFLICT ("UserId", kind, day) DO UPDATE SET count = "AiUsages".count + 1, "updatedAt" = now()`,
        { bind: [userId, kind, today] }
    );
}

/**
 * route = /api/gluten/classify-kitchen
 * Labels kitchen items that haven't been checked yet (rules, then the shared
 * ingredient dictionary, then one AI call for the rest). Returns
 * [{ id, gluten_status, gluten_reason }] for what changed. Only a check that
 * asks the AI counts towards the daily limit.
 */
router.post("/classify-kitchen", async (req, res) => {
    const today = localDate(req.body && req.body.local_date);
    try {
        const foods = await db.Foods.findAll({ where: { UserId: req.user.id, gluten_status: null }, order: [["id", "ASC"]], limit: 60 });
        if (!foods.length) return res.json([]);
        const allowAi = await usedToday(req.user.id, "gluten", today) < DAILY_LIMIT;
        const results = await classifyNames(foods.map((food) => food.name), { allowAi });
        if (!allowAi && results.every((r) => r.retry)) {
            return res.status(429).json({ error: "You've used today's gluten checks. They reset at midnight." });
        }
        if (results.aiUsed) await recordUse(req.user.id, "gluten", today);
        const updates = [];
        for (const [i, food] of foods.entries()) {
            // a failed AI check isn't saved, so the item is checked again next time
            if (!results[i].retry) await food.update({ gluten_status: results[i].status, gluten_reason: results[i].reason });
            updates.push({ id: food.id, gluten_status: results[i].status, gluten_reason: results[i].reason });
        }
        res.json(updates);
    } catch (err) {
        handleError(res, "Gluten check")(err);
    }
});

module.exports = router;
module.exports.usedToday = usedToday;
module.exports.recordUse = recordUse;
