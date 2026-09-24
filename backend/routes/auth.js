const {
    sendJSON,
    getPath,
    getRequestBody,
    clearAuthCookies
} = require("../utils/http");
const { clientKey, sendAuth, refreshFrom } = require("../utils/authHttp");
const { handleRateLimitedAuth } = require("../utils/authRouteHelpers");
const authService = require("../services/authService");

async function handleAuthRoutes(req, res) {
    const path = getPath(req.url);

    if (req.method === "POST" && path === "/api/signup") {
        sendJSON(req, res, 403, {
            message: "Store accounts are created by the platform admin"
        });
        return true;
    }

    if (req.method === "POST" && path === "/api/refresh") {
        const body = await getRequestBody(req);
        const result = await authService.refresh(refreshFrom(req, body));
        sendAuth(req, res, 200, "Token refreshed", result);
        return true;
    }

    if (req.method === "POST" && path === "/api/logout") {
        const body = await getRequestBody(req);
        const result = await authService.logout(refreshFrom(req, body));
        sendJSON(req, res, 200, result, clearAuthCookies());
        return true;
    }

    if (req.method === "POST" && path === "/api/login") {
        const body = await getRequestBody(req);
        const key = clientKey(req, body.username || body.email);
        const attempt = await handleRateLimitedAuth(req, res, key, () => authService.login(body));

        if (attempt.handled) {
            return true;
        }

        sendAuth(req, res, 200, "Login successful", attempt.result);
        return true;
    }

    return false;
}

module.exports = handleAuthRoutes;
