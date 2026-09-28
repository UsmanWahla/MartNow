const { sendJSON, getPath, getQuery } = require("../utils/http");
const { requireRole } = require("../middleware/auth");
const { OWNER, SUPER_ADMIN } = require("../utils/roles");
const locationService = require("../services/locationService");

const LOCATION_ROLES = [...OWNER, ...SUPER_ADMIN];

async function handleLocationRoutes(req, res) {
    const path = getPath(req.url);

    if (req.method !== "GET" || !["/api/locations/search", "/api/locations/reverse"].includes(path)) {
        return false;
    }

    const auth = requireRole(req, res, LOCATION_ROLES);

    if (!auth) {
        return true;
    }

    const params = getQuery(req.url);

    if (path === "/api/locations/search") {
        const rows = await locationService.searchLocations(params.get("q"));
        sendJSON(req, res, 200, { rows });
        return true;
    }

    const location = await locationService.reverseLocation(params.get("latitude"), params.get("longitude"));
    sendJSON(req, res, 200, { location });
    return true;
}

module.exports = handleLocationRoutes;
