const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../utils/query");
const { ServiceError } = require("../utils/errors");
const {
    isValidEmail,
    getPasswordError,
    normalizeEmail,
    normalizeUsername
} = require("../utils/validation");
const { isCustomerRole } = require("../utils/roles");

const { hydrateShopMeta } = require("../utils/slug");

function toPublicUser(user) {
    const role = user.role || "owner";
    const tenantId = role === "super_admin" || isCustomerRole(role) ? null : user.owner_id || user.id;

    return {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username || "",
        role,
        tenantId,
        shop_name: user.shop_name || "",
        shop_slug: user.shop_slug || "",
        low_stock_threshold: Number(user.low_stock_threshold || 3)
    };
}

function createToken(user) {
    const publicUser = toPublicUser(user);

    return jwt.sign(
        {
            id: publicUser.id,
            email: publicUser.email,
            role: publicUser.role,
            tenantId: publicUser.tenantId
        },
        process.env.JWT_SECRET,
        { expiresIn: "15m" }
    );
}

async function createRefreshToken(userId) {
    const token = crypto.randomBytes(32).toString("hex");

    await query(
        "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))",
        [userId, token]
    );

    return token;
}

async function authPayload(user) {
    const hydrated = await hydrateShopMeta(user);

    return {
        token: createToken(hydrated),
        refreshToken: await createRefreshToken(hydrated.id),
        user: toPublicUser(hydrated)
    };
}

async function findUserByEmail(email) {
    return query("SELECT * FROM users WHERE email = ?", [email]);
}

async function findStoreUserByLogin(login) {
    const trimmed = String(login || "").trim();
    const username = normalizeUsername(trimmed);

    if (username) {
        const byUsername = await query("SELECT * FROM users WHERE username = ?", [username]);

        if (byUsername.length > 0) {
            return byUsername;
        }
    }

    const normalizedEmail = normalizeEmail(trimmed);

    if (!normalizedEmail) {
        return [];
    }

    return findUserByEmail(normalizedEmail);
}

async function signup({ name, email, password }) {
    const trimmedName = String(name || "").trim();
    const normalizedEmail = normalizeEmail(email || "");

    if (!trimmedName || !normalizedEmail || !password) {
        throw new ServiceError(400, "Name, email and password are required");
    }

    if (!isValidEmail(normalizedEmail)) {
        throw new ServiceError(400, "Enter a valid email address");
    }

    const passwordError = getPasswordError(password);

    if (passwordError) {
        throw new ServiceError(400, passwordError);
    }

    const existing = await findUserByEmail(normalizedEmail);

    if (existing.length > 0) {
        throw new ServiceError(409, "Email already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await query(
        "INSERT INTO users (name, email, password, role, owner_id) VALUES (?, ?, ?, 'owner', NULL)",
        [trimmedName, normalizedEmail, hashedPassword]
    );

    const user = {
        id: result.insertId,
        name: trimmedName,
        email: normalizedEmail,
        role: "owner",
        owner_id: null,
        shop_name: "",
        low_stock_threshold: 3
    };

    return authPayload(user);
}

async function verifyPassword(email, password, expectedRoles, wrongPanelMessage) {
    const normalizedEmail = normalizeEmail(email || "");

    if (!normalizedEmail || !password) {
        throw new ServiceError(400, "Email and password are required");
    }

    const results = await findUserByEmail(normalizedEmail);

    if (results.length === 0) {
        throw new ServiceError(401, "Invalid email or password");
    }

    const user = results[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
        throw new ServiceError(401, "Invalid email or password");
    }

    if (!expectedRoles.includes(user.role)) {
        throw new ServiceError(403, wrongPanelMessage);
    }

    await query("DELETE FROM refresh_tokens WHERE user_id = ? AND expires_at < NOW()", [user.id]);

    return authPayload(user);
}

async function login({ email, username, password }) {
    const loginId = String(username || email || "").trim();

    if (!loginId || !password) {
        throw new ServiceError(400, "Username and password are required");
    }

    const results = await findStoreUserByLogin(loginId);

    if (results.length === 0) {
        throw new ServiceError(401, "Invalid username or password");
    }

    const user = results[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
        throw new ServiceError(401, "Invalid username or password");
    }

    if (isCustomerRole(user.role)) {
        throw new ServiceError(403, "Use the customer login");
    }

    if (user.role === "super_admin") {
        throw new ServiceError(403, "Use the platform admin login");
    }

    if (!["owner", "manager", "cashier"].includes(user.role)) {
        throw new ServiceError(403, "Use the matching login for this account");
    }

    await query("DELETE FROM refresh_tokens WHERE user_id = ? AND expires_at < NOW()", [user.id]);

    return authPayload(user);
}

async function loginSuper({ email, password }) {
    return verifyPassword(email, password, ["super_admin"], "Use the store or customer login");
}

async function signupCustomer({ name, email, password, phone }) {
    const trimmedName = String(name || "").trim();
    const normalizedEmail = normalizeEmail(email || "");
    const trimmedPhone = String(phone || "").trim() || null;

    if (!trimmedName || !normalizedEmail || !password) {
        throw new ServiceError(400, "Name, email and password are required");
    }

    if (!isValidEmail(normalizedEmail)) {
        throw new ServiceError(400, "Enter a valid email address");
    }

    const passwordError = getPasswordError(password);

    if (passwordError) {
        throw new ServiceError(400, passwordError);
    }

    const existing = await findUserByEmail(normalizedEmail);

    if (existing.length > 0) {
        throw new ServiceError(409, "Email already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await query(
        "INSERT INTO users (name, email, password, role, owner_id) VALUES (?, ?, ?, 'customer', NULL)",
        [trimmedName, normalizedEmail, hashedPassword]
    );

    return authPayload({
        id: result.insertId,
        name: trimmedName,
        email: normalizedEmail,
        role: "customer",
        owner_id: null,
        shop_name: "",
        shop_slug: "",
        low_stock_threshold: 3
    });
}

async function loginCustomer({ email, password }) {
    const normalizedEmail = normalizeEmail(email || "");
    const results = await findUserByEmail(normalizedEmail);

    if (results.length > 0 && results[0].role === "shopper") {
        await query("UPDATE users SET role = 'customer', owner_id = NULL WHERE id = ?", [results[0].id]);
        results[0].role = "customer";
        results[0].owner_id = null;
    }

    if (results.length === 0) {
        return verifyPassword(email, password, ["customer"], "Use the customer login");
    }

    const user = results[0];
    const passwordMatch = await bcrypt.compare(password || "", user.password);

    if (!passwordMatch) {
        throw new ServiceError(401, "Invalid email or password");
    }

    if (!isCustomerRole(user.role)) {
        throw new ServiceError(403, "Use the matching login for this account");
    }

    await query("DELETE FROM refresh_tokens WHERE user_id = ? AND expires_at < NOW()", [user.id]);

    return authPayload({ ...user, role: "customer", owner_id: null });
}

async function refresh(refreshToken) {
    const token = String(refreshToken || "").trim();

    if (!token) {
        throw new ServiceError(401, "Invalid or expired token");
    }

    const rows = await query(
        `
        SELECT refresh_tokens.token, users.*
        FROM refresh_tokens
        INNER JOIN users ON users.id = refresh_tokens.user_id
        WHERE refresh_tokens.token = ? AND refresh_tokens.expires_at > NOW()
        `,
        [token]
    );

    if (rows.length === 0) {
        throw new ServiceError(401, "Invalid or expired token");
    }

    await query("DELETE FROM refresh_tokens WHERE token = ?", [token]);

    return authPayload(rows[0]);
}

async function logout(refreshToken) {
    const token = String(refreshToken || "").trim();

    if (token) {
        await query("DELETE FROM refresh_tokens WHERE token = ?", [token]);
    }

    return { message: "Logged out" };
}

module.exports = {
    signup,
    login,
    loginSuper,
    signupCustomer,
    loginCustomer,
    refresh,
    logout,
    createToken,
    toPublicUser,
    authPayload
};
