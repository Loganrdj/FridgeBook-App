// Helpers shared by the API routes
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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

// A positive whole id from a route param, or null
function parseId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function handleError(res, label) {
    return (err) => {
        console.error(`${label} failed:`, err.message);
        res.status(500).json({ error: "Something went wrong" });
    };
}

module.exports = { requireAuth, isValidDate, toBoolean, todayString, parseId, handleError };
