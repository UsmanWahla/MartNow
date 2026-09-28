const { query, withTransaction } = require("../utils/query");
const { toNumber } = require("../utils/http");
const { ServiceError } = require("../utils/errors");
const { toPublicUser } = require("./authService");
const { ensureShopSlug, slugify, allocateSlug } = require("../utils/slug");
const { readStoreType, categoryForStoreType } = require("../utils/storeCategory");
const { readStorefrontText } = require("../utils/storefront");
const { parseLatitude, parseLongitude } = require("../utils/coordinates");

async function getStoreRow(tenantId) {
    const rows = await query("SELECT * FROM stores WHERE tenant_user_id = ? LIMIT 1", [tenantId]);
    return rows[0] || null;
}

async function getSettings(tenantId) {
    const results = await query(
        "SELECT name, username, shop_name, shop_slug, low_stock_threshold, avatar_path FROM users WHERE id = ?",
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
        latitude: store?.latitude == null ? null : Number(store.latitude),
        longitude: store?.longitude == null ? null : Number(store.longitude),
        contact_name: store?.contact_name || results[0].name || "",
        contact_phone: store?.contact_phone || "",
        store_type: store?.store_type || "Other",
        logo_path: store?.logo_path || null,
        store_description: store?.store_description || "",
        business_hours: store?.business_hours || "",
        delivery_note: store?.delivery_note || "",
        avatar_path: results[0].avatar_path || null,
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
        "SELECT id, name, email, username, role, owner_id, shop_name, shop_slug, low_stock_threshold, avatar_path FROM users WHERE id = ?",
        [tenantId]
    );

    return {
        message: "Settings saved",
        settings,
        user: owner[0] ? toPublicUser(owner[0]) : undefined
    };
}

async function updateShopProfile(tenantId, data) {
    const store = await getStoreRow(tenantId);

    if (!store) {
        throw new ServiceError(404, "Store profile not found");
    }

    const shopName = String(data.shop_name ?? data.name ?? store.name ?? "").trim();
    const contactName = String(data.contact_name ?? store.contact_name ?? "").trim();
    const contactPhone = String(data.contact_phone ?? store.contact_phone ?? "").trim();
    const address = String(data.address ?? store.address ?? "").trim();
    const latitude = parseLatitude(data.latitude ?? store.latitude);
    const longitude = parseLongitude(data.longitude ?? store.longitude);
    const storeDescription = readStorefrontText(
        data.store_description ?? store.store_description,
        "Store description",
        500
    );
    const businessHours = readStorefrontText(
        data.business_hours ?? store.business_hours,
        "Business hours",
        160
    );
    const deliveryNote = readStorefrontText(
        data.delivery_note ?? store.delivery_note,
        "Delivery note",
        250
    );
    const threshold = toNumber(data.low_stock_threshold);
    let storeType;

    try {
        const existingCategory = categoryForStoreType(store.store_type || "Other");
        storeType = readStoreType(
            data.store_category ?? existingCategory,
            data.custom_store_type ??
                (existingCategory === "other" && store.store_type !== "Other"
                    ? store.store_type
                    : ""),
            { requireCustom: Object.hasOwn(data, "store_category") }
        ).storeType;
    } catch (error) {
        throw new ServiceError(400, error.message);
    }

    if (!shopName || !contactName || !contactPhone) {
        throw new ServiceError(400, "Store name, contact name and contact phone are required");
    }

    if (threshold < 1) {
        throw new ServiceError(400, "Low stock threshold must be at least 1");
    }

    let nextSlug = store.shop_slug;

    if (data.shop_slug !== undefined) {
        const requested = slugify(data.shop_slug);

        if (requested !== store.shop_slug) {
            nextSlug = await allocateSlug(requested, tenantId);
        }
    }

    await withTransaction(async () => {
        await query(
            "UPDATE users SET name = ?, shop_name = ?, shop_slug = ?, low_stock_threshold = ? WHERE id = ?",
            [contactName, shopName, nextSlug, threshold, tenantId]
        );
        await query(
            `
            UPDATE stores
            SET name = ?, address = ?, latitude = ?, longitude = ?, contact_name = ?, contact_phone = ?,
                logo_path = ?, store_description = ?, business_hours = ?,
                delivery_note = ?, store_type = ?, shop_slug = ?
            WHERE tenant_user_id = ?
            `,
            [
                shopName,
                address || null,
                latitude,
                longitude,
                contactName,
                contactPhone,
                data.logo_path || store.logo_path || null,
                storeDescription,
                businessHours,
                deliveryNote,
                storeType,
                nextSlug,
                tenantId
            ]
        );
    });

    const settings = await getSettings(tenantId);
    const owner = await query(
        "SELECT id, name, email, username, role, owner_id, shop_name, shop_slug, low_stock_threshold, avatar_path FROM users WHERE id = ?",
        [tenantId]
    );

    return {
        message: "Shop profile saved",
        settings,
        user: owner[0] ? toPublicUser(owner[0]) : undefined
    };
}

module.exports = { getSettings, updateSettings, updateShopProfile };
