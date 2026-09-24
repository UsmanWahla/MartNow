const bcrypt = require("bcryptjs");
const { query, withTransaction } = require("../utils/query");
const { ServiceError } = require("../utils/errors");
const {
    isValidEmail,
    getPasswordError,
    normalizeEmail
} = require("../utils/validation");
const { toPublicUser } = require("./authService");

const STAFF_ROLES = ["manager", "cashier"];

async function listStaff(tenantId) {
    return query(
        "SELECT id, name, email, role FROM users WHERE owner_id = ? AND role IN ('manager', 'cashier') ORDER BY id DESC",
        [tenantId]
    );
}

async function createStaff(tenantId, { name, email, password, role }) {
    const trimmedName = String(name || "").trim();
    const normalizedEmail = normalizeEmail(email || "");
    const staffRole = String(role || "").trim();

    if (!trimmedName || !normalizedEmail || !password || !staffRole) {
        throw new ServiceError(400, "Name, email, password and role are required");
    }

    if (!STAFF_ROLES.includes(staffRole)) {
        throw new ServiceError(400, "Role must be manager or cashier");
    }

    if (!isValidEmail(normalizedEmail)) {
        throw new ServiceError(400, "Enter a valid email address");
    }

    const passwordError = getPasswordError(password);

    if (passwordError) {
        throw new ServiceError(400, passwordError);
    }

    const existing = await query("SELECT id FROM users WHERE email = ?", [
        normalizedEmail
    ]);

    if (existing.length > 0) {
        throw new ServiceError(409, "Email already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await query(
        "INSERT INTO users (name, email, password, role, owner_id) VALUES (?, ?, ?, ?, ?)",
        [trimmedName, normalizedEmail, hashedPassword, staffRole, tenantId]
    );

    const user = {
        id: result.insertId,
        name: trimmedName,
        email: normalizedEmail,
        role: staffRole,
        owner_id: tenantId
    };

    return {
        message: "Staff added",
        user: toPublicUser(user)
    };
}

async function deleteStaff(tenantId, staffId) {
    const existing = await query(
        "SELECT id FROM users WHERE id = ? AND owner_id = ? AND role IN ('manager', 'cashier') LIMIT 1",
        [staffId, tenantId]
    );

    if (existing.length === 0) {
        throw new ServiceError(404, "Staff member not found");
    }

    await withTransaction(async () => {
        await query(
            "UPDATE stock_movements SET created_by = ? WHERE created_by = ? AND user_id = ?",
            [tenantId, staffId, tenantId]
        );
        await query(
            "UPDATE expenses SET created_by = ? WHERE created_by = ? AND user_id = ?",
            [tenantId, staffId, tenantId]
        );
        await query("UPDATE customers SET account_user_id = NULL WHERE account_user_id = ?", [
            staffId
        ]);
        await query("DELETE FROM refresh_tokens WHERE user_id = ?", [staffId]);
        await query("DELETE FROM cart_items WHERE user_id = ?", [staffId]);

        const result = await query(
            "DELETE FROM users WHERE id = ? AND owner_id = ? AND role IN ('manager', 'cashier')",
            [staffId, tenantId]
        );

        if (result.affectedRows === 0) {
            throw new ServiceError(404, "Staff member not found");
        }
    });

    return { message: "Staff removed" };
}

module.exports = { listStaff, createStaff, deleteStaff };
