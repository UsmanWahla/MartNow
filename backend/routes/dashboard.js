const { sendJSON, getPath, getQuery } = require("../utils/http");
const { requireLogin } = require("../middleware/auth");
const dashboardService = require("../services/dashboardService");

async function handleDashboardRoutes(req, res) {
    const path = getPath(req.url);

    if (req.method === "GET" && path === "/api/dashboard") {
        const auth = requireLogin(req, res);

        if (!auth) {
            return true;
        }

        const period = getQuery(req.url).get("period") || "month";
        const stats = await dashboardService.getStats(auth.tenantId, period);
        sendJSON(req, res, 200, stats);
        return true;
    }

    return false;
}

module.exports = handleDashboardRoutes;
