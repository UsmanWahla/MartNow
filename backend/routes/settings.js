const { sendJSON, getPath, getRequestBody } = require("../utils/http");
const { requireLogin, requireRole } = require("../middleware/auth");
const { CATALOG, OWNER } = require("../utils/roles");
const settingsService = require("../services/settingsService");
const { parseStoreForm } = require("../utils/upload");

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

        const body = await parseStoreForm(req);
        const result = await settingsService.updateShopProfile(auth.tenantId, body);
        sendJSON(req, res, 200, result);
        return true;
    }

    return false;
}

module.exports = handleSettingsRoutes;
