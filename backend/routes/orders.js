const {
    sendJSON,
    getPath,
    getNumericId,
    getRequestBody,
    getQuery
} = require("../utils/http");
const { fromQuery } = require("../utils/list");
const { requireRole } = require("../middleware/auth");
const { STAFF } = require("../utils/roles");
const orderService = require("../services/orderService");

async function handleOrderRoutes(req, res) {
    const path = getPath(req.url);
    const collectMatch = path.match(/^\/api\/orders\/(\d+)\/collect$/);
    const statusMatch = path.match(/^\/api\/orders\/(\d+)\/status$/);
    const orderId = getNumericId(path, "/api/orders");

    if (req.method === "GET" && path === "/api/orders") {
        const auth = requireRole(req, res, STAFF);

        if (!auth) {
            return true;
        }

        const orders = await orderService.listOrders(
            auth.tenantId,
            fromQuery(getQuery(req.url))
        );
        sendJSON(req, res, 200, orders);
        return true;
    }

    if (req.method === "GET" && orderId) {
        const auth = requireRole(req, res, STAFF);

        if (!auth) {
            return true;
        }

        const order = await orderService.getOrder(auth.tenantId, orderId);
        sendJSON(req, res, 200, order);
        return true;
    }

    if (req.method === "POST" && collectMatch) {
        const auth = requireRole(req, res, STAFF);

        if (!auth) {
            return true;
        }

        const result = await orderService.collectOrder(
            auth.tenantId,
            Number(collectMatch[1])
        );
        sendJSON(req, res, 200, result);
        return true;
    }

    if (req.method === "PUT" && statusMatch) {
        const auth = requireRole(req, res, STAFF);

        if (!auth) {
            return true;
        }

        const body = await getRequestBody(req);
        const result = await orderService.updateOrderStatus(
            auth.tenantId,
            Number(statusMatch[1]),
            body.delivery_status || body.status
        );
        sendJSON(req, res, 200, result);
        return true;
    }

    return false;
}

module.exports = handleOrderRoutes;
