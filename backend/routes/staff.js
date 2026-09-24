const {
    sendJSON,
    getPath,
    getNumericId,
    getRequestBody
} = require("../utils/http");
const { requireRole } = require("../middleware/auth");
const { OWNER } = require("../utils/roles");
const staffService = require("../services/staffService");

async function handleStaffRoutes(req, res) {
    const path = getPath(req.url);
    const staffId = getNumericId(path, "/api/staff");

    if (req.method === "GET" && path === "/api/staff") {
        const auth = requireRole(req, res, OWNER);

        if (!auth) {
            return true;
        }

        const staff = await staffService.listStaff(auth.tenantId);
        sendJSON(req, res, 200, staff);
        return true;
    }

    if (req.method === "POST" && path === "/api/staff") {
        const auth = requireRole(req, res, OWNER);

        if (!auth) {
            return true;
        }

        const body = await getRequestBody(req);
        const result = await staffService.createStaff(auth.tenantId, body);
        sendJSON(req, res, 201, result);
        return true;
    }

    if (req.method === "DELETE" && staffId) {
        const auth = requireRole(req, res, OWNER);

        if (!auth) {
            return true;
        }

        const result = await staffService.deleteStaff(auth.tenantId, staffId);
        sendJSON(req, res, 200, result);
        return true;
    }

    return false;
}

module.exports = handleStaffRoutes;
