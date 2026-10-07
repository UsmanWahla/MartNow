const { sendJSON, getPath, getRequestBody } = require("../utils/http");
const { requireLogin, requireRole } = require("../middleware/auth");
const { CATALOG, OWNER } = require("../utils/roles");
const settingsService = require("../services/settingsService");
const { parseStoreForm, deleteUploadPaths, getUploadedPaths } = require("../utils/upload");

async function handleSettingsRoutes(req, res) {
    const path = getPath(req.url);

    if (req.method === "GET" && path === "/api/settings") {
        const auth = requireLogin(req, res);

        if (!auth) {
            return true;
        }

        const settings = await settingsService.getSettings(auth.tenantId);
        sendJSON(req, res, 200, settings);
        return true;
    }

    if (req.method === "PUT" && path === "/api/settings") {
        const auth = requireRole(req, res, CATALOG);

        if (!auth) {
            return true;
        }

        const body = await getRequestBody(req);
        const result = await settingsService.updateSettings(auth.tenantId, body);
        sendJSON(req, res, 200, result);
        return true;
    }

    if (req.method === "PUT" && path === "/api/settings/shop-profile") {
        const auth = requireRole(req, res, OWNER);

        if (!auth) {
            return true;
        }

        const existing = await settingsService.getSettings(auth.tenantId);
        const body = await parseStoreForm(req);
        let result;

        try {
            result = await settingsService.updateShopProfile(auth.tenantId, body);
        } catch (error) {
            await deleteUploadPaths(getUploadedPaths(body));
            throw error;
        }

        if (existing.logo_path && existing.logo_path !== result.settings.logo_path) {
            await deleteUploadPaths([existing.logo_path]);
        }

        sendJSON(req, res, 200, result);
        return true;
    }

    return false;
}

module.exports = handleSettingsRoutes;
