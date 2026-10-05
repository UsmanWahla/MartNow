const { query } = require("../utils/query");
const { toNumber } = require("../utils/http");
const { ServiceError } = require("../utils/errors");
const { slugify } = require("../utils/slug");
const { isCustomerRole } = require("../utils/roles");

function toShopProduct(row) {
    return {
        id: row.id,
        name: row.name,
        sku: row.sku,
        price: row.price,
        stock: row.stock,
        inventory_type: row.inventory_type || "unit",
        base_unit: row.base_unit || "piece",
        sale_unit: row.sale_unit || "piece",
        quantity_step: toNumber(row.quantity_step) || 1,
        units_per_sale_unit: toNumber(row.units_per_sale_unit) || 1,
        image_path: row.image_path || null,
        description: row.description || null,
        category: row.category || null,
        featured: Number(row.featured) === 1,
        images: row.images || [],
        colors: row.colors || [],
        sizes: row.sizes || [],
        variants: row.variants || []
    };
}

function mapShop(row) {
    return {
        id: row.store_id || row.id || null,
        tenantId: row.tenant_user_id || row.tenantId,
        shop_name: row.shop_name || row.name || "Shop",
        shop_slug: row.shop_slug,
        low_stock_threshold: toNumber(row.low_stock_threshold) || 3,
        address: row.address || "",
        latitude: row.latitude == null ? null : Number(row.latitude),
        longitude: row.longitude == null ? null : Number(row.longitude),
        contact_name: row.contact_name || "",
        contact_phone: row.contact_phone || "",
        logo_path: row.logo_path || null,
        store_type_id: row.store_type_id == null ? null : Number(row.store_type_id),
        store_type: row.store_type_name || row.store_type || "Mart / General Store",
        store_description: row.store_description || "",
        business_hours: row.business_hours || "",
        delivery_note: row.delivery_note || "",
        delivery_enabled: Number(row.delivery_enabled) === 1,
        commission_percent: Number(row.commission_percent || 0),
        status: row.status || "active"
    };
}

async function getShopBySlug(slug) {
    const shopSlug = slugify(slug);
    const stores = await query(
        `
        SELECT
            stores.id AS store_id,
            stores.tenant_user_id,
            stores.name AS shop_name,
            stores.shop_slug,
            stores.address,
            stores.latitude,
            stores.longitude,
            stores.contact_name,
            stores.contact_phone,
            stores.logo_path,
            stores.store_type_id,
            store_types.name AS store_type_name,
            stores.store_description,
            stores.business_hours,
            stores.delivery_note,
            stores.delivery_enabled,
            stores.commission_percent,
            stores.status,
            users.low_stock_threshold
        FROM stores
        INNER JOIN users ON users.id = stores.tenant_user_id
        INNER JOIN store_types ON store_types.id = stores.store_type_id
        WHERE stores.shop_slug = ? AND stores.status = 'active'
        LIMIT 1
        `,
        [shopSlug]
    );

    if (stores.length > 0) {
        return mapShop(stores[0]);
    }

    const rows = await query(
        `
        SELECT id, name, shop_name, shop_slug, low_stock_threshold
        FROM users
        WHERE shop_slug = ? AND role = 'owner' AND owner_id IS NULL
        LIMIT 1
        `,
        [shopSlug]
    );

    if (rows.length === 0) {
        throw new ServiceError(404, "Shop not found");
    }

    const shop = rows[0];

    return mapShop({
        tenant_user_id: shop.id,
        shop_name: shop.shop_name || shop.name || "Shop",
        shop_slug: shop.shop_slug,
        low_stock_threshold: shop.low_stock_threshold,
        delivery_enabled: 1,
        commission_percent: 0,
        status: "active"
    });
}

async function getShopperCustomer(tenantId, shopperId) {
    const rows = await query(
        `
        SELECT id, name, phone, email, address, city, balance, account_user_id
        FROM customers
        WHERE user_id = ? AND account_user_id = ?
        LIMIT 1
        `,
        [tenantId, shopperId]
    );

    if (rows.length > 0) {
        return rows[0];
    }

    const users = await query("SELECT id, name, email, phone FROM users WHERE id = ?", [shopperId]);

    if (users.length === 0) {
        throw new ServiceError(400, "Customer profile not found");
    }

    const insert = await query(
        `
        INSERT INTO customers (user_id, name, phone, email, account_user_id)
        VALUES (?, ?, ?, ?, ?)
        `,
        [tenantId, users[0].name, users[0].phone || null, users[0].email, shopperId]
    );

    const created = await query(
        `
        SELECT id, name, phone, email, address, city, balance, account_user_id
        FROM customers
        WHERE id = ?
        `,
        [insert.insertId]
    );

    return created[0];
}

function assertShopper(auth) {
    if (!isCustomerRole(auth.role)) {
        throw new ServiceError(403, "Shop login required");
    }
}

module.exports = {
    toShopProduct,
    getShopBySlug,
    getShopperCustomer,
    assertShopper,
    mapShop
};
