const { sendJSON, getPath, getRequestBody } = require("../utils/http");
const { requireLogin } = require("../middleware/auth");
const profileService = require("../services/profileService");
const { parseStoreForm } = require("../utils/upload");

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

    if (req.method === "PUT" && path === "/api/profile/account") {
        const auth = requireLogin(req, res);

        if (!auth) {
            return true;
        }

        const body = await parseStoreForm(req, {
            fileFields: ["avatar"],
            uploadFolder: "avatars",
            resultField: "avatar_path"
        });
        const result = await profileService.updateAccountProfile(auth.id, auth.email, body);
        sendJSON(req, res, 200, result);
        return true;
    }

    return false;
}

module.exports = handleProfileRoutes;
