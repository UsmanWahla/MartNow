const bcrypt = require("bcryptjs");
const { query, withTransaction } = require("../utils/query");
const { ServiceError } = require("../utils/errors");
const { getPasswordError, isValidUsername, normalizeUsername } = require("../utils/validation");
const { toPublicUser } = require("./authService");

async function getAccountProfile(userId) {
    const rows = await query(
        "SELECT id, name, email, username, role, owner_id, shop_name, shop_slug, low_stock_threshold, avatar_path FROM users WHERE id = ?",
        [userId]
    );

    if (rows.length === 0) {
        throw new ServiceError(404, "User not found");
    }

    return toPublicUser(rows[0]);
}

async function updateName(userId, email, name) {
    const nextName = String(name || "").trim();

    if (!nextName) {
        throw new ServiceError(400, "Name is required");
    }

    await query("UPDATE users SET name = ? WHERE id = ?", [nextName, userId]);

    const results = await query(
        "SELECT id, name, email, username, role, owner_id, shop_name, low_stock_threshold, avatar_path FROM users WHERE id = ?",
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

    await withTransaction(async () => {
        await query("UPDATE users SET password = ? WHERE id = ?", [
            hashedPassword,
            userId
        ]);
        await query("DELETE FROM refresh_tokens WHERE user_id = ?", [userId]);
    });

    return { message: "Password updated" };
}

async function updateAccountProfile(userId, email, data) {
    const nextName = String(data.name || "").trim();

    if (!nextName) {
        throw new ServiceError(400, "Name is required");
    }

    const results = await query(
        "SELECT id, name, email, username, password, role, owner_id, shop_name, shop_slug, low_stock_threshold, avatar_path FROM users WHERE id = ?",
        [userId]
    );

    if (results.length === 0) {
        throw new ServiceError(404, "User not found");
    }

    const existing = results[0];
    const currentUsername = existing.username || "";
    const requestedUsername = String(data.username ?? currentUsername).trim();
    const nextUsername = normalizeUsername(requestedUsername);
    const usernameChanged = nextUsername !== currentUsername;
    const removeAvatar = data.remove_avatar === true || data.remove_avatar === 1 || data.remove_avatar === "1";
    const uploadedAvatarPath = String(data.avatar_path || "").trim();
    const nextAvatarPath = removeAvatar
        ? null
        : /^\/uploads\/avatars\/[A-Za-z0-9._-]+$/.test(uploadedAvatarPath)
          ? uploadedAvatarPath
          : existing.avatar_path || null;

    if (usernameChanged) {
        if (!nextUsername || !isValidUsername(nextUsername)) {
            throw new ServiceError(
                400,
                "Username must be 3–32 characters and use letters, numbers, dots, dashes or underscores"
            );
        }

        if (!data.current_password) {
            throw new ServiceError(400, "Enter your current password to change your username");
        }

        const passwordMatch = await bcrypt.compare(data.current_password, existing.password);

        if (!passwordMatch) {
            throw new ServiceError(401, "Current password is incorrect");
        }

        const duplicate = await query("SELECT id FROM users WHERE username = ? AND id <> ?", [
            nextUsername,
            userId
        ]);

        if (duplicate.length > 0) {
            throw new ServiceError(409, "Username already exists");
        }
    }

    await query("UPDATE users SET name = ?, username = ?, avatar_path = ? WHERE id = ?", [
        nextName,
        nextUsername || null,
        nextAvatarPath,
        userId
    ]);

    const user = {
        ...existing,
        name: nextName,
        username: nextUsername || "",
        avatar_path: nextAvatarPath,
        email: existing.email || email
    };

    return { message: "Profile saved", user: toPublicUser(user) };
}

module.exports = {
    getAccountProfile,
    updateName,
    updatePassword,
    updateAccountProfile
};
