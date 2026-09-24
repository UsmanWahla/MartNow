const {
    sendJSON,
    getPath,
    getNumericId,
    getRequestBody,
    getQuery
} = require("../utils/http");
const { fromQuery } = require("../utils/list");
const { requireLogin, requireRole } = require("../middleware/auth");
const { MANAGE_SALE } = require("../utils/roles");
const saleService = require("../services/saleService");

async function handleSaleRoutes(req, res) {
    const path = getPath(req.url);
    const saleId = getNumericId(path, "/api/sales");

    if (req.method === "GET" && path === "/api/sales") {
        const auth = requireLogin(req, res);

        if (!auth) {
            return true;
        }

        const sales = await saleService.listSales(
            auth.tenantId,
            fromQuery(getQuery(req.url))
        );
        sendJSON(req, res, 200, sales);
        return true;
    }

    if (req.method === "GET" && saleId) {
        const auth = requireLogin(req, res);

        if (!auth) {
            return true;
        }

        const sale = await saleService.getSale(auth.tenantId, saleId);
        sendJSON(req, res, 200, sale);
        return true;
    }

    if (req.method === "POST" && path === "/api/sales") {
        const auth = requireLogin(req, res);

        if (!auth) {
            return true;
        }

        const body = await getRequestBody(req);
        const result = await saleService.addSale(auth.tenantId, body, auth.id);
        sendJSON(req, res, 201, result);
        return true;
    }

    if (req.method === "PUT" && saleId) {
        const auth = requireRole(req, res, MANAGE_SALE);

        if (!auth) {
            return true;
        }

        const body = await getRequestBody(req);
        const result = await saleService.updateSale(
            auth.tenantId,
            saleId,
            body,
            auth.id
        );
        sendJSON(req, res, 200, result);
        return true;
    }

    if (req.method === "DELETE" && saleId) {
        const auth = requireRole(req, res, MANAGE_SALE);

        if (!auth) {
            return true;
        }

        const result = await saleService.deleteSale(auth.tenantId, saleId, auth.id);
        sendJSON(req, res, 200, result);
        return true;
    }

    return false;
}

module.exports = handleSaleRoutes;
