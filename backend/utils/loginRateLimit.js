const rateLimit = require("./rateLimit");
const { ServiceError } = require("./errors");

/**
 * Runs a login/signup attempt with shared rate-limit bookkeeping.
 * @returns {{ blocked: true } | { blocked: false, result: unknown }}
 */
async function runAuthAttempt(key, attempt, { countFailure } = {}) {
    if (rateLimit.isBlocked(key)) {
        return { blocked: true };
    }

    try {
        const result = await attempt();
        rateLimit.reset(key);
        return { blocked: false, result };
    } catch (error) {
        if (error instanceof ServiceError) {
            const shouldCount =
                typeof countFailure === "function" ? countFailure(error) : error.status === 401;

            if (shouldCount) {
                rateLimit.recordFailure(key);
            }
        }

        throw error;
    }
}

module.exports = { runAuthAttempt };
