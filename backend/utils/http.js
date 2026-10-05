const DEFAULT_CORS_ORIGIN = "http://localhost:5173";

function configuredCorsOrigins() {
    const configured = String(
        process.env.CORS_ORIGINS ||
            process.env.CORS_ORIGIN ||
            process.env.FRONTEND_URL ||
            process.env.CLIENT_ORIGIN ||
            ""
    )
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);

    return configured.length > 0 ? configured : [DEFAULT_CORS_ORIGIN];
}

function isLocalOrigin(origin) {
    return (
        origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:")
    );
}

function getCorsOrigin(req) {
    const origin = req.headers.origin;
    const allowedOrigins = configuredCorsOrigins();

    if (!origin) {
        return allowedOrigins[0] || DEFAULT_CORS_ORIGIN;
    }

    if (allowedOrigins.includes(origin)) {
        return origin;
    }

    if (
        allowedOrigins.length === 1 &&
        allowedOrigins[0] === DEFAULT_CORS_ORIGIN &&
        isLocalOrigin(origin)
    ) {
        return origin;
    }

    return allowedOrigins[0] || DEFAULT_CORS_ORIGIN;
}

function corsHeaders(req) {
    return {
        "Access-Control-Allow-Origin": getCorsOrigin(req),
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true"
    };
}

function sendJSON(req, res, statusCode, data, extraHeaders = {}) {
    const headers = {
        "Content-Type": "application/json",
        ...corsHeaders(req),
        ...extraHeaders
    };

    if (headers["Set-Cookie"] && typeof res.setHeader === "function") {
        res.setHeader("Set-Cookie", headers["Set-Cookie"]);
        delete headers["Set-Cookie"];
    }

    res.writeHead(statusCode, headers);
    res.end(JSON.stringify(data));
}

function sendCorsOptions(req, res) {
    res.writeHead(204, corsHeaders(req));
    res.end();
}

function envFlag(name) {
    const value = String(process.env[name] || "").trim().toLowerCase();

    if (["1", "true", "yes", "on"].includes(value)) {
        return true;
    }

    if (["0", "false", "no", "off"].includes(value)) {
        return false;
    }

    return null;
}

function cookieSameSite() {
    const value = String(process.env.COOKIE_SAMESITE || process.env.COOKIE_SAME_SITE || "")
        .trim()
        .toLowerCase();

    if (["strict", "lax", "none"].includes(value)) {
        return value[0].toUpperCase() + value.slice(1);
    }

    return "Lax";
}

function cookieSecure(sameSite) {
    const configured = envFlag("COOKIE_SECURE");

    if (configured !== null) {
        return configured;
    }

    return process.env.NODE_ENV === "production" || sameSite === "None";
}

function cookieFlags() {
    const sameSite = cookieSameSite();
    const domain = String(process.env.COOKIE_DOMAIN || "").trim();
    const flags = ["HttpOnly", "Path=/"];

    if (domain) {
        flags.push(`Domain=${domain}`);
    }

    flags.push(`SameSite=${sameSite}`);

    if (cookieSecure(sameSite)) {
        flags.push("Secure");
    }

    return flags.join("; ");
}

function authCookies(accessToken, refreshToken) {
    return {
        "Set-Cookie": [
            `access_token=${accessToken}; ${cookieFlags()}; Max-Age=900`,
            `refresh_token=${refreshToken}; ${cookieFlags()}; Max-Age=604800`
        ]
    };
}

function clearAuthCookies() {
    return {
        "Set-Cookie": [
            `access_token=; ${cookieFlags()}; Max-Age=0`,
            `refresh_token=; ${cookieFlags()}; Max-Age=0`
        ]
    };
}

function parseCookies(header) {
    const cookies = {};

    String(header || "")
        .split(";")
        .forEach((part) => {
            const trimmed = part.trim();

            if (!trimmed) {
                return;
            }

            const eq = trimmed.indexOf("=");

            if (eq === -1) {
                return;
            }

            cookies[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
        });

    return cookies;
}

function getPath(url) {
    return (url || "/").split("?")[0];
}

function getQuery(url) {
    const queryString = (url || "").split("?")[1] || "";
    return new URLSearchParams(queryString);
}

function getNumericId(path, basePath) {
    const prefix = basePath + "/";

    if (!path.startsWith(prefix)) {
        return null;
    }

    const idPart = path.slice(prefix.length);

    if (!/^[0-9]+$/.test(idPart)) {
        return null;
    }

    return Number(idPart);
}

function toNumber(value) {
    const amount = Number(value);
    return Number.isFinite(amount) ? amount : 0;
}

function toMoney(value) {
    return Math.round(toNumber(value) * 100) / 100;
}

const MAX_BODY_BYTES = 1_000_000;

function getRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";

        req.on("data", (chunk) => {
            body += chunk.toString();

            if (body.length > MAX_BODY_BYTES) {
                reject(new Error("Request body too large"));
                req.destroy();
            }
        });

        req.on("end", () => {
            if (!body.trim()) {
                resolve({});
                return;
            }

            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(new Error("Invalid JSON"));
            }
        });

        req.on("error", (error) => {
            reject(error);
        });
    });
}

module.exports = {
    getCorsOrigin,
    corsHeaders,
    sendJSON,
    sendCorsOptions,
    authCookies,
    clearAuthCookies,
    parseCookies,
    getPath,
    getQuery,
    getNumericId,
    toNumber,
    toMoney,
    getRequestBody
};
