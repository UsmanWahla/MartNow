const bcrypt = require("bcryptjs");
const { query } = require("../utils/query");
const { ServiceError } = require("../utils/errors");
const { getPasswordError } = require("../utils/validation");
const { toPublicUser } = require("./authService");

async function updateName(userId, email, name) {
    const nextName = String(name || "").trim();

    if (!nextName) {
        throw new ServiceError(400, "Name is required");
    }

    await query("UPDATE users SET name = ? WHERE id = ?", [nextName, userId]);

    const results = await query(
        "SELECT id, name, email, role, owner_id, shop_name, low_stock_threshold FROM users WHERE id = ?",
        [userId]
    );

    const row = results[0] || {
        id: userId,
        name: nextName,
        email,
        role: "owner",
        owner_id: null
    };

    return {
        message: "Name updated",
        user: toPublicUser(row)
    };
}

async function updatePassword(userId, { currentPassword, newPassword }) {
    if (!currentPassword || !newPassword) {
        throw new ServiceError(
            400,
            "Current password and new password are required"
        );
    }

    const passwordError = getPasswordError(newPassword);

    if (passwordError) {
        throw new ServiceError(400, passwordError);
    }

    const results = await query("SELECT password FROM users WHERE id = ?", [
        userId
    ]);

    if (results.length === 0) {
        throw new ServiceError(404, "User not found");
    }

    const passwordMatch = await bcrypt.compare(
        currentPassword,
        results[0].password
    );

    if (!passwordMatch) {
        throw new ServiceError(401, "Current password is incorrect");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await query("UPDATE users SET password = ? WHERE id = ?", [
        hashedPassword,
        userId
    ]);

    return { message: "Password updated" };
}

module.exports = {
    updateName,
    updatePassword
};
