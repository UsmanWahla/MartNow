const {
    sendJSON,
    getPath,
    getNumericId,
    getRequestBody,
    getQuery
} = require("../utils/http");
const { fromQuery } = require("../utils/list");
const { requireLogin, requireRole } = require("../middleware/auth");
const { CATALOG } = require("../utils/roles");
const customerService = require("../services/customerService");

async function handleCustomerRoutes(req, res) {
    const path = getPath(req.url);
    const payMatch = path.match(/^\/api\/customers\/(\d+)\/pay$/);
    const customerId = getNumericId(path, "/api/customers");

    if (req.method === "GET" && path === "/api/customers") {
        const auth = requireLogin(req, res);

        if (!auth) {
            return true;
        }

        const customers = await customerService.listCustomers(
            auth.tenantId,
            fromQuery(getQuery(req.url))
        );
        sendJSON(req, res, 200, customers);
        return true;
    }

    if (req.method === "POST" && path === "/api/customers") {
        const auth = requireLogin(req, res);

        if (!auth) {
            return true;
        }

        const body = await getRequestBody(req);
        const result = await customerService.addCustomer(auth.tenantId, body);
        sendJSON(req, res, 201, result);
        return true;
    }

    if (req.method === "PUT" && customerId) {
        const auth = requireRole(req, res, CATALOG);

        if (!auth) {
            return true;
        }

        const body = await getRequestBody(req);
        const result = await customerService.updateCustomer(
            auth.tenantId,
            customerId,
            body
        );
        sendJSON(req, res, 200, result);
        return true;
    }

    if (req.method === "POST" && payMatch) {
        const auth = requireRole(req, res, CATALOG);

        if (!auth) {
            return true;
        }

        const body = await getRequestBody(req);
        const result = await customerService.payCustomer(
            auth.tenantId,
            Number(payMatch[1]),
            body.amount
        );
        sendJSON(req, res, 200, result);
        return true;
    }

    if (req.method === "DELETE" && customerId) {
        const auth = requireRole(req, res, CATALOG);

        if (!auth) {
            return true;
        }

        const result = await customerService.deleteCustomer(auth.tenantId, customerId);
        sendJSON(req, res, 200, result);
        return true;
    }

    return false;
}

module.exports = handleCustomerRoutes;
