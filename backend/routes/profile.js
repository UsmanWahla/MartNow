const { sendJSON, getPath, getRequestBody } = require("../utils/http");
const { requireLogin } = require("../middleware/auth");
const profileService = require("../services/profileService");
const { parseStoreForm, deleteUploadPaths, getUploadedPaths } = require("../utils/upload");

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

        const existing = await profileService.getAccountProfile(auth.id);
        const body = await parseStoreForm(req, {
            fileFields: ["avatar"],
            uploadFolder: "avatars",
            resultField: "avatar_path"
        });
        let result;

        try {
            result = await profileService.updateAccountProfile(auth.id, auth.email, body);
        } catch (error) {
            await deleteUploadPaths(getUploadedPaths(body));
            throw error;
        }

        if (existing.avatar_path && existing.avatar_path !== result.user.avatar_path) {
            await deleteUploadPaths([existing.avatar_path]);
        }

        sendJSON(req, res, 200, result);
        return true;
    }

    return false;
}

module.exports = handleProfileRoutes;
