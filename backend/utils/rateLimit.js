const WINDOW_MS = 15 * 60 * 1000;
const MAX_TRIES = 5;
const attempts = new Map();

function getEntry(key) {
    const now = Date.now();
    const entry = attempts.get(key);

    if (!entry || now > entry.resetAt) {
        const fresh = { count: 0, resetAt: now + WINDOW_MS };
        attempts.set(key, fresh);
        return fresh;
    }

    return entry;
}

function isBlocked(key) {
    return getEntry(key).count >= MAX_TRIES;
}

function recordFailure(key) {
    getEntry(key).count += 1;
}

function reset(key) {
    attempts.delete(key);
}

module.exports = {
    MAX_TRIES,
    isBlocked,
    recordFailure,
    reset
};
