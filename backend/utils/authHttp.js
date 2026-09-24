const { sendJSON, parseCookies, authCookies } = require("./http");

function clientKey(req, email) {
    const ip = req.socket.remoteAddress || "unknown";
    return `${ip}:${String(email || "").toLowerCase()}`;
}

function sendAuth(req, res, status, message, result) {
    sendJSON(
        req,
        res,
        status,
        {
            message,
            token: result.token,
            refreshToken: result.refreshToken,
            user: result.user
        },
        authCookies(result.token, result.refreshToken)
    );
}

function refreshFrom(req, body = {}) {
    const cookies = parseCookies(req.headers.cookie);
    return body.refreshToken || cookies.refresh_token || "";
}

module.exports = {
    clientKey,
    sendAuth,
    refreshFrom
};
