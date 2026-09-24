const jwt = require("jsonwebtoken");
const { sendJSON, parseCookies } = require("../utils/http");
const { isCustomerRole } = require("../utils/roles");

function normalizeAuth(payload) {
    const role = payload.role || "owner";
    const tenantId =
        role === "super_admin" || isCustomerRole(role)
            ? payload.tenantId || payload.owner_id || null
            : payload.tenantId || payload.id;

    return {
        ...payload,
        role,
        tenantId
    };
}

function readAccessToken(req) {
    const header = req.headers.authorization || "";

    if (header.startsWith("Bearer ")) {
        const bearer = header.slice(7).trim();

        if (bearer) {
            return bearer;
        }
    }

    return parseCookies(req.headers.cookie).access_token || "";
}

function requireLogin(req, res, options = {}) {
    const token = readAccessToken(req);

    if (!token) {
        sendJSON(req, res, 401, {
            message: "Please login first"
        });
        return null;
    }

    try {
        const auth = normalizeAuth(jwt.verify(token, process.env.JWT_SECRET));

        if (!options.allowShopper && isCustomerRole(auth.role)) {
            sendJSON(req, res, 403, {
                message: "Use the shop for this account"
            });
            return null;
        }

        if (!options.allowSuper && auth.role === "super_admin") {
            sendJSON(req, res, 403, {
                message: "Use the platform admin"
            });
            return null;
        }

        return auth;
    } catch (error) {
        sendJSON(req, res, 401, {
            message: "Invalid or expired token"
        });
        return null;
    }
}

function requireRole(req, res, roles) {
    const auth = requireLogin(req, res, {
        allowShopper: roles.some((role) => isCustomerRole(role)),
        allowSuper: roles.includes("super_admin")
    });

    if (!auth) {
        return null;
    }

    if (!roles.includes(auth.role)) {
        sendJSON(req, res, 403, {
            message: "You do not have permission"
        });
        return null;
    }

    return auth;
}

module.exports = { requireLogin, requireRole, readAccessToken };
