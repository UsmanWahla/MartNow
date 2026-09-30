const { sendJSON, getPath, getQuery, getNumericId, getRequestBody } = require("../utils/http");
const { requireRole } = require("../middleware/auth");
const { OWNER, SUPER_ADMIN } = require("../utils/roles");
const { fromQuery } = require("../utils/list");
const storeTypeService = require("../services/storeTypeService");

const STORE_TYPE_READERS = [...OWNER, ...SUPER_ADMIN];

async function handleStoreTypeRoutes(req, res) {
    const path = getPath(req.url);

    if (req.method === "GET" && path === "/api/store-types") {
        const auth = requireRole(req, res, STORE_TYPE_READERS);

        if (!auth) {
            return true;
        }

        sendJSON(req, res, 200, await storeTypeService.listActiveStoreTypes());
        return true;
    }

    const storeTypeId = getNumericId(path, "/api/super/store-types");
    const statusMatch = path.match(/^\/api\/super\/store-types\/(\d+)\/status$/);
    const isManagementRoute =
        path === "/api/super/store-types" || Boolean(storeTypeId) || Boolean(statusMatch);

    if (!isManagementRoute) {
        return false;
    }

    const auth = requireRole(req, res, SUPER_ADMIN);

    if (!auth) {
        return true;
    }

    if (req.method === "GET" && path === "/api/super/store-types") {
        const query = getQuery(req.url);
        sendJSON(
            req,
            res,
            200,
            await storeTypeService.listManagedStoreTypes({
                ...fromQuery(query),
                status: query.get("status")
            })
        );
        return true;
    }

    if (req.method === "POST" && path === "/api/super/store-types") {
        const body = await getRequestBody(req);
        sendJSON(req, res, 201, await storeTypeService.createStoreType(body));
        return true;
    }

    if (req.method === "PUT" && storeTypeId) {
        const body = await getRequestBody(req);
        sendJSON(req, res, 200, await storeTypeService.updateStoreType(storeTypeId, body));
        return true;
    }

    if (req.method === "PUT" && statusMatch) {
        const body = await getRequestBody(req);
        sendJSON(
            req,
            res,
            200,
            await storeTypeService.setStoreTypeActive(Number(statusMatch[1]), body.is_active)
        );
        return true;
    }

    return false;
}

module.exports = handleStoreTypeRoutes;
