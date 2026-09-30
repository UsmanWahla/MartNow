const { sendJSON, getPath, getQuery } = require("../utils/http");
const { fromQuery } = require("../utils/list");
const { requireRole } = require("../middleware/auth");
const { REPORT } = require("../utils/roles");
const commissionLedgerService = require("../services/commissionLedgerService");

async function handleCommissionRoutes(req, res) {
    const path = getPath(req.url);

    if (req.method === "GET" && path === "/api/commission/summary") {
        const auth = requireRole(req, res, REPORT);

        if (!auth) {
            return true;
        }

        sendJSON(
            req,
            res,
            200,
            await commissionLedgerService.getStoreCommissionSummary(auth.tenantId)
        );
        return true;
    }

    if (req.method === "GET" && path === "/api/commission") {
        const auth = requireRole(req, res, REPORT);

        if (!auth) {
            return true;
        }

        sendJSON(
            req,
            res,
            200,
            await commissionLedgerService.listStoreCommissionLedger(
                auth.tenantId,
                fromQuery(getQuery(req.url))
            )
        );
        return true;
    }

    return false;
}

module.exports = handleCommissionRoutes;
