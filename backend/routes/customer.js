const { sendJSON, getPath, getRequestBody } = require("../utils/http");
const { ServiceError } = require("../utils/errors");
const { clientKey, sendAuth } = require("../utils/authHttp");
const { handleRateLimitedAuth, SIGNUP_BLOCKED } = require("../utils/authRouteHelpers");
const authService = require("../services/authService");
const storeService = require("../services/storeService");

async function handleCustomerRoutes(req, res) {
    const path = getPath(req.url);

    if (req.method === "GET" && path === "/api/stores/public") {
        sendJSON(req, res, 200, await storeService.listPublicStores());
        return true;
    }

    if (req.method === "POST" && path === "/api/customer/signup") {
        const body = await getRequestBody(req);
        const key = `customer-signup:${req.socket.remoteAddress || "unknown"}`;
        const attempt = await handleRateLimitedAuth(
            req,
            res,
            key,
            () => authService.signupCustomer(body),
            {
                blockedMessage: SIGNUP_BLOCKED,
                countFailure: (error) => error instanceof ServiceError
            }
        );

        if (attempt.handled) {
            return true;
        }

        sendAuth(req, res, 201, "Account created successfully", attempt.result);
        return true;
    }

    if (req.method === "POST" && path === "/api/customer/login") {
        const body = await getRequestBody(req);
        const key = `customer-login:${clientKey(req, body.email)}`;
        const attempt = await handleRateLimitedAuth(req, res, key, () =>
            authService.loginCustomer(body)
        );

        if (attempt.handled) {
            return true;
        }

        sendAuth(req, res, 200, "Login successful", attempt.result);
        return true;
    }

    return false;
}

module.exports = handleCustomerRoutes;
