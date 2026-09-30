const { sendJSON, getPath } = require("../utils/http");
const { requireRole } = require("../middleware/auth");
const { OWNER, SUPER_ADMIN } = require("../utils/roles");
const storeTypeService = require("../services/storeTypeService");

const STORE_TYPE_READERS = [...OWNER, ...SUPER_ADMIN];

async function handleStoreTypeRoutes(req, res) {
    if (req.method !== "GET" || getPath(req.url) !== "/api/store-types") {
        return false;
    }

    const auth = requireRole(req, res, STORE_TYPE_READERS);

    if (!auth) {
        return true;
    }

    sendJSON(req, res, 200, await storeTypeService.listActiveStoreTypes());
    return true;
}

module.exports = handleStoreTypeRoutes;
