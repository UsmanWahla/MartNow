const { sendJSON } = require("./http");
const { runAuthAttempt } = require("./loginRateLimit");

const LOGIN_BLOCKED = "Too many login attempts. Try again in 15 minutes";
const SIGNUP_BLOCKED = "Too many signup attempts. Try again in 15 minutes";

async function handleRateLimitedAuth(req, res, key, attempt, options = {}) {
    const blockedMessage = options.blockedMessage || LOGIN_BLOCKED;
    const outcome = await runAuthAttempt(key, attempt, {
        countFailure: options.countFailure
    });

    if (outcome.blocked) {
        sendJSON(req, res, 429, { message: blockedMessage });
        return { handled: true };
    }

    return { handled: false, result: outcome.result };
}

module.exports = {
    LOGIN_BLOCKED,
    SIGNUP_BLOCKED,
    handleRateLimitedAuth
};
