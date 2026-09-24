const {
    sendJSON,
    getPath,
    getNumericId,
    getRequestBody,
    getQuery
} = require("../utils/http");
const { fromQuery } = require("../utils/list");
const { requireRole } = require("../middleware/auth");
const { CATALOG } = require("../utils/roles");
const supplierService = require("../services/supplierService");

async function handleSupplierRoutes(req, res) {
    const path = getPath(req.url);
    const supplierId = getNumericId(path, "/api/suppliers");

    if (req.method === "GET" && path === "/api/suppliers") {
        const auth = requireRole(req, res, CATALOG);

        if (!auth) {
            return true;
        }

        const suppliers = await supplierService.listSuppliers(
            auth.tenantId,
            fromQuery(getQuery(req.url))
        );
        sendJSON(req, res, 200, suppliers);
        return true;
    }

    if (req.method === "POST" && path === "/api/suppliers") {
        const auth = requireRole(req, res, CATALOG);

        if (!auth) {
            return true;
        }

        const body = await getRequestBody(req);
        const result = await supplierService.addSupplier(auth.tenantId, body);
        sendJSON(req, res, 201, result);
        return true;
    }

    if (req.method === "PUT" && supplierId) {
        const auth = requireRole(req, res, CATALOG);

        if (!auth) {
            return true;
        }

        const body = await getRequestBody(req);
        const result = await supplierService.updateSupplier(
            auth.tenantId,
            supplierId,
            body
        );
        sendJSON(req, res, 200, result);
        return true;
    }

    if (req.method === "DELETE" && supplierId) {
        const auth = requireRole(req, res, CATALOG);

        if (!auth) {
            return true;
        }

        const result = await supplierService.deleteSupplier(auth.tenantId, supplierId);
        sendJSON(req, res, 200, result);
        return true;
    }

    return false;
}

module.exports = handleSupplierRoutes;
