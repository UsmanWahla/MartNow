const { sendJSON, getPath, getRequestBody } = require("../utils/http");
const { requireLogin } = require("../middleware/auth");
const profileService = require("../services/profileService");

async function handleProfileRoutes(req, res) {
    const path = getPath(req.url);

    if (req.method === "PUT" && path === "/api/profile") {
        const auth = requireLogin(req, res);

        if (!auth) {
            return true;
        }

        const body = await getRequestBody(req);
        const result = await profileService.updateName(auth.id, auth.email, body.name);
        sendJSON(req, res, 200, result);
        return true;
    }

    if (req.method === "PUT" && path === "/api/profile/password") {
        const auth = requireLogin(req, res);

        if (!auth) {
            return true;
        }

        const body = await getRequestBody(req);
        const result = await profileService.updatePassword(auth.id, body);
        sendJSON(req, res, 200, result);
        return true;
    }

    return false;
}

module.exports = handleProfileRoutes;
