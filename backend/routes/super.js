const { sendJSON, getPath, getRequestBody, getQuery, getNumericId } = require("../utils/http");
const { fromQuery } = require("../utils/list");
const { clientKey, sendAuth } = require("../utils/authHttp");
const { handleRateLimitedAuth } = require("../utils/authRouteHelpers");
const { SUPER_ADMIN } = require("../utils/roles");
const { requireRole } = require("../middleware/auth");
const {
    parseStoreForm,
    deleteUploadPaths,
    deleteTenantProductUploads,
    getUploadedPaths
} = require("../utils/upload");
const authService = require("../services/authService");
const storeService = require("../services/storeService");
const commissionLedgerService = require("../services/commissionLedgerService");

function requireSuper(req, res) {
    return requireRole(req, res, SUPER_ADMIN);
}

async function handleSuperRoutes(req, res) {
    const path = getPath(req.url);
    const storeId = getNumericId(path, "/api/super/stores");
    const orderId = getNumericId(path, "/api/super/orders");
    const statusMatch = path.match(/^\/api\/super\/orders\/(\d+)\/status$/);
    const storeStatusMatch = path.match(/^\/api\/super\/stores\/(\d+)\/status$/);
    const storeProductsMatch = path.match(/^\/api\/super\/stores\/(\d+)\/products$/);

    if (req.method === "POST" && path === "/api/super/login") {
        const body = await getRequestBody(req);
        const key = `super-login:${clientKey(req, body.email)}`;
        const attempt = await handleRateLimitedAuth(req, res, key, () =>
            authService.loginSuper(body)
        );

        if (attempt.handled) {
            return true;
        }

        sendAuth(req, res, 200, "Login successful", attempt.result);
        return true;
    }

    if (req.method === "GET" && path === "/api/super/dashboard") {
        const auth = requireSuper(req, res);

        if (!auth) {
            return true;
        }

        const period = getQuery(req.url).get("period") || "month";
        sendJSON(req, res, 200, await storeService.getPlatformStats(period));
        return true;
    }

    if (req.method === "GET" && path === "/api/super/commission-ledger/summary") {
        const auth = requireSuper(req, res);

        if (!auth) {
            return true;
        }

        sendJSON(
            req,
            res,
            200,
            await commissionLedgerService.getCommissionLedgerSummary(
                fromQuery(getQuery(req.url))
            )
        );
        return true;
    }

    if (req.method === "GET" && path === "/api/super/commission-ledger") {
        const auth = requireSuper(req, res);

        if (!auth) {
            return true;
        }

        sendJSON(
            req,
            res,
            200,
            await commissionLedgerService.listCommissionLedger(fromQuery(getQuery(req.url)))
        );
        return true;
    }

    if (req.method === "POST" && path === "/api/super/commission-ledger/settlements") {
        const auth = requireSuper(req, res);

        if (!auth) {
            return true;
        }

        const body = await getRequestBody(req);
        sendJSON(
            req,
            res,
            201,
            await commissionLedgerService.recordCommissionSettlement(body, auth.id)
        );
        return true;
    }

    if (req.method === "GET" && path === "/api/super/orders") {
        const auth = requireSuper(req, res);

        if (!auth) {
            return true;
        }

        sendJSON(req, res, 200, await storeService.listPlatformOrders(fromQuery(getQuery(req.url))));
        return true;
    }

    if (req.method === "GET" && path === "/api/super/deliveries") {
        const auth = requireSuper(req, res);

        if (!auth) {
            return true;
        }

        const options = fromQuery(getQuery(req.url));
        sendJSON(
            req,
            res,
            200,
            await storeService.listPlatformOrders({ ...options, deliveryBy: "platform" })
        );
        return true;
    }

    if (req.method === "PATCH" && statusMatch) {
        const auth = requireSuper(req, res);

        if (!auth) {
            return true;
        }

        const body = await getRequestBody(req);
        sendJSON(
            req,
            res,
            200,
            await storeService.updatePlatformOrderStatus(
                Number(statusMatch[1]),
                body.delivery_status || body.status
            )
        );
        return true;
    }

    if (req.method === "GET" && orderId) {
        const auth = requireSuper(req, res);

        if (!auth) {
            return true;
        }

        const kind = getQuery(req.url).get("kind");

        if (kind === "walkin") {
            sendJSON(req, res, 200, await storeService.getPlatformWalkInSale(orderId));
        } else {
            sendJSON(req, res, 200, await storeService.getPlatformOrder(orderId));
        }

        return true;
    }

    if (req.method === "GET" && path === "/api/super/stores") {
        const auth = requireSuper(req, res);

        if (!auth) {
            return true;
        }

        sendJSON(req, res, 200, await storeService.listStores(fromQuery(getQuery(req.url))));
        return true;
    }

    if (req.method === "GET" && storeProductsMatch) {
        const auth = requireSuper(req, res);

        if (!auth) {
            return true;
        }

        sendJSON(
            req,
            res,
            200,
            await storeService.listStoreProducts(
                Number(storeProductsMatch[1]),
                fromQuery(getQuery(req.url))
            )
        );
        return true;
    }

    if (req.method === "GET" && storeId) {
        const auth = requireSuper(req, res);

        if (!auth) {
            return true;
        }

        sendJSON(req, res, 200, await storeService.getStoreDetail(storeId));
        return true;
    }

    if (req.method === "POST" && path === "/api/super/stores") {
        const auth = requireSuper(req, res);

        if (!auth) {
            return true;
        }

        const body = await parseStoreForm(req);
        let result;

        try {
            result = await storeService.createStore(body);
        } catch (error) {
            await deleteUploadPaths(getUploadedPaths(body));
            throw error;
        }

        sendJSON(req, res, 201, result);
        return true;
    }

    if (req.method === "PUT" && storeId) {
        const auth = requireSuper(req, res);

        if (!auth) {
            return true;
        }

        const existing = await storeService.getStore(storeId);
        const body = await parseStoreForm(req);
        let result;

        try {
            result = await storeService.updateStore(storeId, body);
        } catch (error) {
            await deleteUploadPaths(getUploadedPaths(body));
            throw error;
        }

        if (existing.logo_path && existing.logo_path !== result.store.logo_path) {
            await deleteUploadPaths([existing.logo_path]);
        }

        sendJSON(req, res, 200, result);
        return true;
    }

    if (req.method === "PUT" && storeStatusMatch) {
        const auth = requireSuper(req, res);

        if (!auth) {
            return true;
        }

        const body = await getRequestBody(req);
        sendJSON(
            req,
            res,
            200,
            await storeService.setStoreStatus(Number(storeStatusMatch[1]), body.status)
        );
        return true;
    }

    if (req.method === "DELETE" && storeId) {
        const auth = requireSuper(req, res);

        if (!auth) {
            return true;
        }

        const permanent = getQuery(req.url).get("permanent") === "1";
        const existing = permanent ? await storeService.getStore(storeId) : null;
        const result = permanent
            ? await storeService.deleteInactiveStore(storeId)
            : await storeService.deactivateStore(storeId);

        if (permanent && existing) {
            await Promise.all([
                deleteUploadPaths([existing.logo_path]),
                deleteTenantProductUploads(existing.tenant_user_id)
            ]);
        }

        sendJSON(req, res, 200, result);
        return true;
    }

    return false;
}

module.exports = handleSuperRoutes;
