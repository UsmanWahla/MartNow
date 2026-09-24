const { query } = require("./query");
const { isValidUsername, normalizeUsername } = require("./validation");

/** Emails overwritten when usernames were wrongly copied from shop slugs. */
const ORIGINAL_OWNER_EMAILS = {
    1: "usman@gmail.com",
    2: "ahmad@gmail.com",
    16: "ali@gmail.com",
    45: "abeel1@gmail.com",
    46: "punjab@gmail.com",
    47: "arshad@yahoo.com"
};

function usernameFromEmail(email) {
    const value = String(email || "").trim().toLowerCase();

    if (!value) {
        return "";
    }

    const localPart = value.includes("@") ? value.split("@")[0] : value;
    const base = normalizeUsername(localPart).replace(/[^a-z0-9._-]/g, "");

    return isValidUsername(base) ? base : "";
}

async function allocateUsername(base, excludeUserId) {
    let candidate = base;
    let suffix = 1;

    while (true) {
        const taken = await query("SELECT id FROM users WHERE username = ? AND id <> ?", [
            candidate,
            excludeUserId
        ]);

        if (taken.length === 0) {
            return candidate;
        }

        candidate = `${base}${suffix}`;
        suffix += 1;
    }
}

async function ensureUsernameIndex() {
    try {
        await query("CREATE UNIQUE INDEX uq_users_username ON users (username)");
    } catch (error) {
        if (error.code !== "ER_DUP_KEYNAME" && error.errno !== 1061) {
            throw error;
        }
    }
}

function looksLikePlaceholderEmail(email) {
    const value = String(email || "").trim().toLowerCase();
    return value.endsWith("@store.local") || value.endsWith("@ex.com") || value.includes("@example.com");
}

/** Old stores logged in with email. Username = part before @. Shop slug is not used. */
async function backfillOwnerUsernames() {
    for (const [id, email] of Object.entries(ORIGINAL_OWNER_EMAILS)) {
        const rows = await query("SELECT id, email FROM users WHERE id = ? AND role = 'owner'", [id]);

        if (rows.length === 0) {
            continue;
        }

        if (looksLikePlaceholderEmail(rows[0].email)) {
            await query("UPDATE users SET email = ? WHERE id = ?", [email, id]);
        }
    }

    const rows = await query(
        `
        SELECT id, email, username
        FROM users
        WHERE role IN ('owner', 'manager', 'cashier')
        `
    );

    for (const row of rows) {
        const fromEmail = usernameFromEmail(row.email);

        if (!fromEmail) {
            continue;
        }

        if (row.username === fromEmail) {
            continue;
        }

        const username = await allocateUsername(fromEmail, row.id);
        await query("UPDATE users SET username = ? WHERE id = ?", [username, row.id]);
    }

    await ensureUsernameIndex();
}

module.exports = {
    backfillOwnerUsernames,
    usernameFromEmail
};
