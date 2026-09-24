const {
    sendJSON,
    getPath,
    getRequestBody,
    getQuery
} = require("../utils/http");
const { fromQuery } = require("../utils/list");
const { ServiceError } = require("../utils/errors");
const { clientKey, sendAuth } = require("../utils/authHttp");
const { handleRateLimitedAuth, SIGNUP_BLOCKED } = require("../utils/authRouteHelpers");
const { SHOPPER } = require("../utils/roles");
const { requireRole } = require("../middleware/auth");
const shopService = require("../services/shopService");

function requireShopper(req, res) {
    return requireRole(req, res, SHOPPER);
}

function shopMatch(path, suffix) {
    const match = path.match(new RegExp(`^\\/api\\/shop\\/([^/]+)${suffix}$`));
    return match ? decodeURIComponent(match[1]) : null;
}

async function handleShopRoutes(req, res) {
    const path = getPath(req.url);

    const metaSlug = shopMatch(path, "");
    if (req.method === "GET" && metaSlug && !path.slice("/api/shop/".length).includes("/")) {
        const meta = await shopService.getShopMeta(metaSlug);
        sendJSON(req, res, 200, meta);
        return true;
    }

    const listSlug = shopMatch(path, "/products");
    if (req.method === "GET" && listSlug) {
        const products = await shopService.listShopProducts(
            listSlug,
            fromQuery(getQuery(req.url))
        );
        sendJSON(req, res, 200, products);
        return true;
    }

    const productMatch = path.match(/^\/api\/shop\/([^/]+)\/products\/(\d+)$/);
    if (req.method === "GET" && productMatch) {
        const detail = await shopService.getShopProduct(
            decodeURIComponent(productMatch[1]),
            Number(productMatch[2])
        );
        sendJSON(req, res, 200, detail);
        return true;
    }

    const signupSlug = shopMatch(path, "/signup");
    if (req.method === "POST" && signupSlug) {
        const body = await getRequestBody(req);
        const key = `shop-signup:${clientKey(req, body.email)}`;
        const attempt = await handleRateLimitedAuth(
            req,
            res,
            key,
            () => shopService.signupShopper(signupSlug, body),
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

    const loginSlug = shopMatch(path, "/login");
    if (req.method === "POST" && loginSlug) {
        const body = await getRequestBody(req);
        const key = `shop-login:${clientKey(req, body.email)}`;
        const attempt = await handleRateLimitedAuth(
            req,
            res,
            key,
            () => shopService.loginShopper(loginSlug, body),
            {
                countFailure: (error) => error instanceof ServiceError
            }
        );

        if (attempt.handled) {
            return true;
        }

        sendAuth(req, res, 200, "Login successful", attempt.result);
        return true;
    }

    const profileSlug = shopMatch(path, "/profile");
    if (profileSlug) {
        const auth = requireShopper(req, res);

        if (!auth) {
            return true;
        }

        if (req.method === "GET") {
            sendJSON(req, res, 200, await shopService.checkoutProfile(profileSlug, auth));
            return true;
        }

        if (req.method === "PUT") {
            const body = await getRequestBody(req);
            sendJSON(req, res, 200, await shopService.updateShopperProfile(profileSlug, auth, body));
            return true;
        }
    }

    const passwordSlug = shopMatch(path, "/profile/password");
    if (req.method === "PUT" && passwordSlug) {
        const auth = requireShopper(req, res);

        if (!auth) {
            return true;
        }

        const body = await getRequestBody(req);
        sendJSON(req, res, 200, await shopService.updateShopperPassword(passwordSlug, auth, body));
        return true;
    }

    const ordersSlug = shopMatch(path, "/orders");
    if (req.method === "GET" && ordersSlug) {
        const auth = requireShopper(req, res);

        if (!auth) {
            return true;
        }

        sendJSON(req, res, 200, await shopService.listShopperOrders(ordersSlug, auth));
        return true;
    }

    const checkoutProfileSlug = shopMatch(path, "/checkout/profile");
    if (req.method === "GET" && checkoutProfileSlug) {
        const auth = requireShopper(req, res);

        if (!auth) {
            return true;
        }

        const profile = await shopService.checkoutProfile(checkoutProfileSlug, auth);
        sendJSON(req, res, 200, profile);
        return true;
    }

    const checkoutSlug = shopMatch(path, "/checkout");
    if (req.method === "POST" && checkoutSlug) {
        const auth = requireShopper(req, res);

        if (!auth) {
            return true;
        }

        const body = await getRequestBody(req);
        const result = await shopService.checkout(checkoutSlug, auth, body);
        sendJSON(req, res, 201, result);
        return true;
    }

    const cartSlug = shopMatch(path, "/cart");
    if (cartSlug) {
        const auth = requireShopper(req, res);

        if (!auth) {
            return true;
        }

        if (req.method === "GET") {
            sendJSON(req, res, 200, await shopService.listCart(cartSlug, auth));
            return true;
        }

        if (req.method === "POST") {
            const body = await getRequestBody(req);
            sendJSON(req, res, 200, await shopService.addToCart(cartSlug, auth, body));
            return true;
        }
    }

    const cartItemMatch = path.match(/^\/api\/shop\/([^/]+)\/cart\/(\d+)$/);
    if (cartItemMatch) {
        const auth = requireShopper(req, res);

        if (!auth) {
            return true;
        }

        const slug = decodeURIComponent(cartItemMatch[1]);
        const itemId = Number(cartItemMatch[2]);

        if (req.method === "PUT") {
            const body = await getRequestBody(req);
            sendJSON(
                req,
                res,
                200,
                await shopService.updateCartItem(slug, auth, itemId, body.quantity)
            );
            return true;
        }

        if (req.method === "DELETE") {
            sendJSON(req, res, 200, await shopService.removeCartItem(slug, auth, itemId));
            return true;
        }
    }

    const orderMatch = path.match(/^\/api\/shop\/([^/]+)\/orders\/(\d+)$/);
    if (req.method === "GET" && orderMatch) {
        const auth = requireShopper(req, res);

        if (!auth) {
            return true;
        }

        const order = await shopService.getShopperOrder(
            decodeURIComponent(orderMatch[1]),
            auth,
            Number(orderMatch[2])
        );
        sendJSON(req, res, 200, order);
        return true;
    }

    return false;
}

module.exports = handleShopRoutes;
