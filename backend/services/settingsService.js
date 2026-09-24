const { query } = require("../utils/query");
const { toNumber } = require("../utils/http");
const { ServiceError } = require("../utils/errors");
const { toPublicUser } = require("./authService");
const { ensureShopSlug, slugify, allocateSlug } = require("../utils/slug");

async function getStoreRow(tenantId) {
    const rows = await query("SELECT * FROM stores WHERE tenant_user_id = ? LIMIT 1", [tenantId]);
    return rows[0] || null;
}

async function getSettings(tenantId) {
    const results = await query(
        "SELECT name, shop_name, shop_slug, low_stock_threshold FROM users WHERE id = ?",
        [tenantId]
    );

    if (results.length === 0) {
        throw new ServiceError(404, "Shop not found");
    }

    const store = await getStoreRow(tenantId);
    const shopSlug =
        store?.shop_slug ||
        results[0].shop_slug ||
        (await ensureShopSlug(tenantId, results[0].shop_name || results[0].name));

    return {
        shop_name: store?.name || results[0].shop_name || results[0].name || "",
        shop_slug: shopSlug,
        low_stock_threshold: toNumber(results[0].low_stock_threshold) || 3,
        address: store?.address || "",
        logo_path: store?.logo_path || null,
        delivery_enabled: store ? Number(store.delivery_enabled) === 1 : true,
        commission_percent: Number(store?.commission_percent || 0)
    };
}

async function updateSettings(tenantId, { shop_name, low_stock_threshold, shop_slug }) {
    const shopName = String(shop_name || "").trim();
    const threshold = toNumber(low_stock_threshold);

    if (threshold < 1) {
        throw new ServiceError(400, "Low stock threshold must be at least 1");
    }

    const current = await getSettings(tenantId);
    let nextSlug = current.shop_slug;

    if (shop_slug !== undefined) {
        const requested = slugify(shop_slug);

        if (requested !== current.shop_slug) {
            nextSlug = await allocateSlug(requested, tenantId);
        }
    }

    await query(
        "UPDATE users SET shop_name = ?, low_stock_threshold = ?, shop_slug = ? WHERE id = ?",
        [shopName || null, threshold, nextSlug, tenantId]
    );

    const store = await getStoreRow(tenantId);

    if (store) {
        await query("UPDATE stores SET name = ?, shop_slug = ? WHERE tenant_user_id = ?", [
            shopName || store.name,
            nextSlug,
            tenantId
        ]);
    }

    const settings = await getSettings(tenantId);
    const owner = await query(
        "SELECT id, name, email, username, role, owner_id, shop_name, shop_slug, low_stock_threshold FROM users WHERE id = ?",
        [tenantId]
    );

    return {
        message: "Settings saved",
        settings,
        user: owner[0] ? toPublicUser(owner[0]) : undefined
    };
}

module.exports = { getSettings, updateSettings };
