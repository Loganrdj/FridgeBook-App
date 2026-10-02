const router = require("express").Router();
const db = require("../models");
const { matches, isStaple } = require("../lib/ingredientMatch");
const { requireAuth, isValidDate, localDate, daysBetween, parseId, handleError } = require("./validation");

const PAST_DAYS = 31;
const FUTURE_DAYS = 365;
const NEEDS_DAYS = 60;

router.use(requireAuth);

const fail = (res) => handleError(res, "Meal route");

function text(value, max) {
    return typeof value === "string" ? value.trim().slice(0, max) : "";
}

// A recipe sent by the browser (it came from a search): keep only known fields, sanely sized
function parseRecipe(raw) {
    const errors = [];
    raw = raw && typeof raw === "object" ? raw : {};
    const title = text(raw.title, 100);
    if (!title) errors.push("recipe needs a title");
    const ingredients = (Array.isArray(raw.ingredients) ? raw.ingredients : [])
        .slice(0, 25)
        .map((item) => ({ name: text(item && item.name, 80), amount: text(item && item.amount, 40) }))
        .filter((item) => item.name);
    if (!ingredients.length) errors.push("recipe needs ingredients");
    const steps = (Array.isArray(raw.steps) ? raw.steps : []).map((step) => text(step, 500)).filter(Boolean).slice(0, 15);
    if (!steps.length) errors.push("recipe needs steps");
    const whole = (value, max) => (Number.isInteger(value) && value > 0 ? Math.min(value, max) : null);
    return {
        errors,
        title,
        recipe: { description: text(raw.description, 300), minutes: whole(raw.minutes, 1440), servings: whole(raw.servings, 50), ingredients, steps }
    };
}

function checkDate(date, today) {
    if (!isValidDate(date)) return "date must be a date (YYYY-MM-DD)";
    const offset = daysBetween(today, date);
    if (offset < -PAST_DAYS || offset > FUTURE_DAYS) return "date must be within the past month or the next year";
    return null;
}

function serialize(meal) {
    return { id: meal.id, date: meal.date, title: meal.title, recipe: meal.recipe, dismissed: meal.dismissed || [] };
}

function findOwnMeal(req) {
    const id = parseId(req.params.id);
    if (!id) return Promise.resolve(null);
    return db.MealPlans.findOne({ where: { id, UserId: req.user.id } });
}

/**
 * What upcoming meals still need, judged against the kitchen on each meal's day:
 * an ingredient is needed if nothing in the kitchen matches it, or everything
 * that matches expires before the meal. Staples and "I have it" items are skipped.
 */
async function computeNeeds(userId, today, onlyMealId) {
    const where = { UserId: userId };
    if (onlyMealId) where.id = onlyMealId;
    const meals = (await db.MealPlans.findAll({ where, order: [["date", "ASC"], ["id", "ASC"]] }))
        .filter((meal) => {
            const offset = daysBetween(today, meal.date);
            return offset >= 0 && offset <= NEEDS_DAYS;
        });
    if (!meals.length) return [];

    const foods = await db.Foods.findAll({ where: { UserId: userId } });
    const shopping = await db.ShoppingItems.findAll({ where: { UserId: userId } });
    const needs = [];
    for (const meal of meals) {
        const dismissed = (meal.dismissed || []).map((name) => name.toLowerCase());
        for (const item of meal.recipe.ingredients || []) {
            if (isStaple(item.name) || dismissed.includes(item.name.toLowerCase())) continue;
            const inKitchen = foods.filter((food) => matches(food.name, item.name));
            if (inKitchen.some((food) => food.date_expire >= meal.date)) continue;
            const latest = inKitchen.map((food) => food.date_expire).sort().pop() || null;
            needs.push({
                meal_id: meal.id,
                meal_title: meal.title,
                date: meal.date,
                name: item.name,
                amount: item.amount || null,
                reason: latest ? "expires_before" : "missing",
                expires: latest,
                on_list: shopping.some((entry) => matches(entry.name, item.name))
            });
        }
    }
    return needs;
}

/**
 * route = /api/meals
 */
router.route("/")
    .get(async (req, res) => {
        try {
            const today = localDate(req.query.local_date);
            const meals = await db.MealPlans.findAll({ where: { UserId: req.user.id }, order: [["date", "ASC"], ["id", "ASC"]] });
            res.json(meals.filter((meal) => daysBetween(today, meal.date) >= -PAST_DAYS).map(serialize));
        } catch (err) {
            fail(res)(err);
        }
    })
    // plan a recipe on a day; the reply says how many ingredients that meal still needs
    .post(async (req, res) => {
        const today = localDate(req.body && req.body.local_date);
        const parsed = parseRecipe(req.body && req.body.recipe);
        const dateError = checkDate(req.body && req.body.date, today);
        const errors = [...parsed.errors, ...(dateError ? [dateError] : [])];
        if (errors.length) return res.status(422).json({ errors });
        try {
            const meal = await db.MealPlans.create({
                date: req.body.date, title: parsed.title, recipe: parsed.recipe, dismissed: [], UserId: req.user.id
            });
            const needs = await computeNeeds(req.user.id, today, meal.id);
            res.status(201).json({ ...serialize(meal), needs: needs.length });
        } catch (err) {
            fail(res)(err);
        }
    });

/**
 * route = /api/meals/needs?local_date=YYYY-MM-DD
 * Ingredients upcoming meals still need (see computeNeeds)
 */
router.get("/needs", async (req, res) => {
    try {
        res.json(await computeNeeds(req.user.id, localDate(req.query.local_date)));
    } catch (err) {
        fail(res)(err);
    }
});

/**
 * route = /api/meals/:id
 */
router.route("/:id")
    // move to another day
    .patch(async (req, res) => {
        const dateError = checkDate(req.body && req.body.date, localDate(req.body && req.body.local_date));
        if (dateError) return res.status(422).json({ errors: [dateError] });
        try {
            const meal = await findOwnMeal(req);
            if (!meal) return res.status(404).json({ error: "Not found" });
            await meal.update({ date: req.body.date });
            res.json(serialize(meal));
        } catch (err) {
            fail(res)(err);
        }
    })
    .delete(async (req, res) => {
        try {
            const meal = await findOwnMeal(req);
            if (!meal) return res.status(404).json({ error: "Not found" });
            await meal.destroy();
            res.status(204).end();
        } catch (err) {
            fail(res)(err);
        }
    });

/**
 * route = /api/meals/:id/dismiss
 * { name } -> "I have it": stop listing this ingredient as needed for this meal
 */
router.post("/:id/dismiss", async (req, res) => {
    const name = text(req.body && req.body.name, 80);
    if (!name) return res.status(422).json({ errors: ["name is required"] });
    try {
        const meal = await findOwnMeal(req);
        if (!meal) return res.status(404).json({ error: "Not found" });
        const dismissed = meal.dismissed || [];
        if (!dismissed.some((entry) => entry.toLowerCase() === name.toLowerCase()) && dismissed.length < 50) {
            await meal.update({ dismissed: [...dismissed, name] });
        }
        res.json(serialize(meal));
    } catch (err) {
        fail(res)(err);
    }
});

module.exports = router;
