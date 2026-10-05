// Limits on paid web searches: a per-user daily cap and a monthly total for the
// whole app (both counted in AiUsages with kind "web").
const db = require("../models");

const PER_USER_DAILY = () => Number(process.env.WEB_SEARCH_DAILY_LIMIT) || 5;
const MONTHLY_TOTAL = () => Number(process.env.WEB_SEARCH_MONTHLY_LIMIT) || 300;

async function canSearch(userId, today) {
  const [[{ user_today, month_total }]] = await db.sequelize.query(
    `SELECT
       COALESCE(SUM(count) FILTER (WHERE "UserId" = $1 AND day = $2), 0)::int AS user_today,
       COALESCE(SUM(count) FILTER (WHERE day >= date_trunc('month', $2::date)), 0)::int AS month_total
     FROM "AiUsages" WHERE kind = 'web'`,
    { bind: [userId, today] }
  );
  return user_today < PER_USER_DAILY() && month_total < MONTHLY_TOTAL();
}

async function recordSearch(userId, today) {
  await db.sequelize.query(
    `INSERT INTO "AiUsages" ("UserId", kind, day, count, "createdAt", "updatedAt")
     VALUES ($1, 'web', $2, 1, now(), now())
     ON CONFLICT ("UserId", kind, day) DO UPDATE SET count = "AiUsages".count + 1, "updatedAt" = now()`,
    { bind: [userId, today] }
  );
}

module.exports = { canSearch, recordSearch };
