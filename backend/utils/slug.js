const { query } = require("./query");

function slugify(text) {
    const base = String(text || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);

    return base || "shop";
}

async function slugTaken(candidate, excludeTenantId = 0) {
    const storeRows = await query(
        "SELECT id FROM stores WHERE shop_slug = ? AND tenant_user_id <> ? LIMIT 1",
        [candidate, excludeTenantId]
    );

    if (storeRows.length > 0) {
        return true;
    }

    const userRows = await query(
        "SELECT id FROM users WHERE shop_slug = ? AND id <> ? LIMIT 1",
        [candidate, excludeTenantId]
    );

    return userRows.length > 0;
}

async function allocateSlug(base, excludeId = 0) {
    const root = slugify(base);

    for (let index = 0; index < 80; index += 1) {
        const candidate = index === 0 ? root : `${root}-${index + 1}`;

        if (!(await slugTaken(candidate, excludeId))) {
            return candidate;
        }
    }

    return `${root}-${Date.now()}`;
}

async function ensureShopSlug(userId, name) {
    const store = await query("SELECT shop_slug FROM stores WHERE tenant_user_id = ?", [userId]);

    if (store[0]?.shop_slug) {
        return store[0].shop_slug;
    }

    const rows = await query(
        "SELECT id, name, shop_name, shop_slug FROM users WHERE id = ?",
        [userId]
    );

    if (rows.length === 0) {
        return slugify(name || "shop");
    }

    if (rows[0].shop_slug) {
        return rows[0].shop_slug;
    }

    const slug = await allocateSlug(rows[0].shop_name || rows[0].name || name || "shop", userId);
    await query("UPDATE users SET shop_slug = ? WHERE id = ?", [slug, userId]);
    return slug;
}

async function hydrateShopMeta(user) {
    if (!user) {
        return user;
    }

    if (user.role === "super_admin" || user.role === "customer" || user.role === "shopper") {
        return {
            ...user,
            shop_name: user.shop_name || "",
            shop_slug: user.shop_slug || "",
            low_stock_threshold: Number(user.low_stock_threshold || 3)
        };
    }

    const tenantId = user.owner_id || user.id;
    const store = await query(
        "SELECT name, shop_slug FROM stores WHERE tenant_user_id = ? LIMIT 1",
        [tenantId]
    );

    if (store[0]) {
        return {
            ...user,
            shop_name: store[0].name || user.shop_name || user.name || "",
            shop_slug: store[0].shop_slug,
            low_stock_threshold: Number(user.low_stock_threshold || 3)
        };
    }

    if (!user.owner_id) {
        const slug = user.shop_slug || (await ensureShopSlug(user.id, user.shop_name || user.name));
        return { ...user, shop_slug: slug };
    }

    const owner = await query(
        "SELECT shop_name, shop_slug, low_stock_threshold, name FROM users WHERE id = ?",
        [user.owner_id]
    );

    if (owner[0]) {
        const slug =
            owner[0].shop_slug || (await ensureShopSlug(user.owner_id, owner[0].shop_name || owner[0].name));
        return {
            ...user,
            shop_name: user.shop_name || owner[0].shop_name || owner[0].name || "",
            shop_slug: slug,
            low_stock_threshold: Number(user.low_stock_threshold || owner[0].low_stock_threshold || 3)
        };
    }

    return user;
}

module.exports = { slugify, allocateSlug, ensureShopSlug, hydrateShopMeta };
