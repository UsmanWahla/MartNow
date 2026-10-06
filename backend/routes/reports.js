const { sendJSON, getPath, getQuery } = require("../utils/http");
const { fromQuery } = require("../utils/list");
const { requireRole } = require("../middleware/auth");
const { REPORT, SUPER_ADMIN } = require("../utils/roles");
const reportService = require("../services/reportService");

async function handleReportRoutes(req, res) {
    const path = getPath(req.url);

    if (req.method === "GET" && path === "/api/reports") {
        const auth = requireRole(req, res, REPORT);

        if (!auth) {
            return true;
        }

        const report = await reportService.getStoreReport(
            auth.tenantId,
            fromQuery(getQuery(req.url))
        );
        sendJSON(req, res, 200, report);
        return true;
    }

    if (req.method === "GET" && path === "/api/super/reports") {
        const auth = requireRole(req, res, SUPER_ADMIN);

        if (!auth) {
            return true;
        }

        const report = await reportService.getPlatformReport(
            fromQuery(getQuery(req.url))
        );
        sendJSON(req, res, 200, report);
        return true;
    }

    return false;
}

module.exports = handleReportRoutes;
