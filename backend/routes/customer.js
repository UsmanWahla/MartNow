const { sendJSON, getPath, getQuery, getRequestBody } = require("../utils/http");
const { ServiceError } = require("../utils/errors");
const { clientKey, sendAuth } = require("../utils/authHttp");
const { handleRateLimitedAuth, SIGNUP_BLOCKED } = require("../utils/authRouteHelpers");
const { fromQuery } = require("../utils/list");
const { requireRole } = require("../middleware/auth");
const { SHOPPER } = require("../utils/roles");
const authService = require("../services/authService");
const customerAccountService = require("../services/customerAccountService");
const storeService = require("../services/storeService");

function requireCustomer(req, res) {
    return requireRole(req, res, SHOPPER);
}

async function handleCustomerRoutes(req, res) {
    const path = getPath(req.url);

    if (req.method === "GET" && path === "/api/stores/public") {
        sendJSON(req, res, 200, await storeService.listPublicStores());
        return true;
    }

    if (path === "/api/customer/profile") {
        const auth = requireCustomer(req, res);

        if (!auth) {
            return true;
        }

        if (req.method === "GET") {
            sendJSON(req, res, 200, await customerAccountService.getProfile(auth.id));
            return true;
        }

        if (req.method === "PUT") {
            const body = await getRequestBody(req);
            sendJSON(req, res, 200, await customerAccountService.updateProfile(auth.id, body));
            return true;
        }
    }

    if (req.method === "PUT" && path === "/api/customer/profile/password") {
        const auth = requireCustomer(req, res);

        if (!auth) {
            return true;
        }

        const body = await getRequestBody(req);
        sendJSON(req, res, 200, await customerAccountService.updatePassword(auth.id, body));
        return true;
    }

    if (path === "/api/customer/addresses") {
        const auth = requireCustomer(req, res);

        if (!auth) {
            return true;
        }

        if (req.method === "GET") {
            sendJSON(req, res, 200, await customerAccountService.listAddresses(auth.id));
            return true;
        }

        if (req.method === "POST") {
            const body = await getRequestBody(req);
            sendJSON(req, res, 201, await customerAccountService.createAddress(auth.id, body));
            return true;
        }
    }

    const defaultAddressMatch = path.match(/^\/api\/customer\/addresses\/(\d+)\/default$/);
    if (req.method === "PUT" && defaultAddressMatch) {
        const auth = requireCustomer(req, res);

        if (!auth) {
            return true;
        }

        sendJSON(
            req,
            res,
            200,
            await customerAccountService.setDefaultAddress(auth.id, Number(defaultAddressMatch[1]))
        );
        return true;
    }

    const addressMatch = path.match(/^\/api\/customer\/addresses\/(\d+)$/);
    if (addressMatch) {
        const auth = requireCustomer(req, res);

        if (!auth) {
            return true;
        }

        const addressId = Number(addressMatch[1]);

        if (req.method === "PUT") {
            const body = await getRequestBody(req);
            sendJSON(
                req,
                res,
                200,
                await customerAccountService.updateAddress(auth.id, addressId, body)
            );
            return true;
        }

        if (req.method === "DELETE") {
            sendJSON(
                req,
                res,
                200,
                await customerAccountService.deleteAddress(auth.id, addressId)
            );
            return true;
        }
    }

    if (req.method === "GET" && path === "/api/customer/orders") {
        const auth = requireCustomer(req, res);

        if (!auth) {
            return true;
        }

        const params = getQuery(req.url);
        sendJSON(
            req,
            res,
            200,
            await customerAccountService.listOrders(auth.id, {
                ...fromQuery(params),
                status: params.get("status")
            })
        );
        return true;
    }

    const orderMatch = path.match(/^\/api\/customer\/orders\/(\d+)$/);
    if (req.method === "GET" && orderMatch) {
        const auth = requireCustomer(req, res);

        if (!auth) {
            return true;
        }

        sendJSON(
            req,
            res,
            200,
            await customerAccountService.getOrder(auth.id, Number(orderMatch[1]))
        );
        return true;
    }

    if (req.method === "POST" && path === "/api/customer/signup") {
        const body = await getRequestBody(req);
        const key = `customer-signup:${req.socket.remoteAddress || "unknown"}`;
        const attempt = await handleRateLimitedAuth(
            req,
            res,
            key,
            () => authService.signupCustomer(body),
            {
                blockedMessage: SIGNUP_BLOCKED,
                countFailure: (error) => error instanceof ServiceError
            }
        );

        if (attempt.handled) {
            return true;
        }

        sendAuth(req, res, 201, "Account created successfully", attempt.result);
        return true;
    }

    if (req.method === "POST" && path === "/api/customer/login") {
        const body = await getRequestBody(req);
        const key = `customer-login:${clientKey(req, body.email)}`;
        const attempt = await handleRateLimitedAuth(req, res, key, () =>
            authService.loginCustomer(body)
        );

        if (attempt.handled) {
            return true;
        }

        sendAuth(req, res, 200, "Login successful", attempt.result);
        return true;
    }

    return false;
}

module.exports = handleCustomerRoutes;
