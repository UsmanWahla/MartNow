const { sendJSON, getPath, getRequestBody, getQuery, getNumericId } = require("../utils/http");
const { fromQuery } = require("../utils/list");
const { requireRole } = require("../middleware/auth");
const { STOCK } = require("../utils/roles");
const stockService = require("../services/stockService");
const productService = require("../services/productService");

async function handleStockRoutes(req, res) {
    const path = getPath(req.url);
    const movementId = getNumericId(path, "/api/stock");

    if (req.method === "GET" && path === "/api/stock") {
        const auth = requireRole(req, res, STOCK);

        if (!auth) {
            return true;
        }

        const query = getQuery(req.url);

        if (query.get("ledger") === "1") {
            const productId = Number(query.get("product_id"));

            if (!productId) {
                sendJSON(req, res, 400, {
                    message: "Product is required"
                });
                return true;
            }

            const ledger = await productService.getLedger(auth.tenantId, productId);
            sendJSON(req, res, 200, ledger);
            return true;
        }

        const movements = await stockService.listMovements(
            auth.tenantId,
            fromQuery(query)
        );
        sendJSON(req, res, 200, movements);
        return true;
    }

    if (req.method === "POST" && path === "/api/stock") {
        const auth = requireRole(req, res, STOCK);

        if (!auth) {
            return true;
        }

        const body = await getRequestBody(req);
        const result = await stockService.addMovement(auth.tenantId, auth.id, body);
        sendJSON(req, res, 201, result);
        return true;
    }

    if (req.method === "PUT" && movementId) {
        const auth = requireRole(req, res, STOCK);

        if (!auth) {
            return true;
        }

        const body = await getRequestBody(req);
        const result = await stockService.updateMovement(
            auth.tenantId,
            auth.id,
            movementId,
            body
        );
        sendJSON(req, res, 200, result);
        return true;
    }

    if (req.method === "DELETE" && movementId) {
        const auth = requireRole(req, res, STOCK);

        if (!auth) {
            return true;
        }

        const result = await stockService.deleteMovement(auth.tenantId, auth.id, movementId);
        sendJSON(req, res, 200, result);
        return true;
    }

    return false;
}

module.exports = handleStockRoutes;
