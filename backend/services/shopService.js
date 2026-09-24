const { query } = require("../utils/query");
const { parseListOptions, like } = require("../utils/list");
const { ServiceError } = require("../utils/errors");
const { signupCustomer, loginCustomer } = require("./authService");
const { attachCatalog } = require("./productService");
const { toShopProduct, getShopBySlug } = require("./shopCore");
const { platformDeliveryFee } = require("../utils/platform");
const shopCartService = require("./shopCartService");

async function getShopMeta(slug) {
    const shop = await getShopBySlug(slug);

    return {
        shop_name: shop.shop_name,
        shop_slug: shop.shop_slug,
        address: shop.address || "",
        logo_path: shop.logo_path || null,
        delivery_enabled: Boolean(shop.delivery_enabled),
        platform_delivery_fee: platformDeliveryFee(),
        latitude: shop.latitude,
        longitude: shop.longitude
    };
}

async function listShopProducts(slug, options = {}) {
    const shop = await getShopBySlug(slug);
    const { search, limitSql } = parseListOptions(options);
    const params = [shop.tenantId];
    let where = "WHERE user_id = ?";

    if (search) {
        where += " AND (name LIKE ? OR IFNULL(sku, '') LIKE ?)";
        params.push(like(search), like(search));
    }

    const countRows = await query(`SELECT COUNT(*) AS n FROM products ${where}`, params);
    const rows = await query(
        `SELECT id, name, sku, price, stock, image_path, description FROM products ${where} ORDER BY id DESC ${limitSql}`,
        params
    );

    const decorated = await attachCatalog(rows);

    return {
        shop_name: shop.shop_name,
        shop_slug: shop.shop_slug,
        rows: decorated.map(toShopProduct),
        total: Number(countRows[0].n)
    };
}

async function getShopProduct(slug, productId) {
    const shop = await getShopBySlug(slug);
    const rows = await query(
        `
        SELECT id, name, sku, price, stock, image_path, description
        FROM products
        WHERE id = ? AND user_id = ?
        `,
        [productId, shop.tenantId]
    );

    if (rows.length === 0) {
        throw new ServiceError(404, "Product not found");
    }

    return {
        shop_name: shop.shop_name,
        shop_slug: shop.shop_slug,
        product: toShopProduct(await attachCatalog(rows[0]))
    };
}

async function signupShopper(slug, payload) {
    await getShopBySlug(slug);
    return signupCustomer(payload);
}

async function loginShopper(slug, payload) {
    await getShopBySlug(slug);
    return loginCustomer(payload);
}

module.exports = {
    getShopBySlug,
    getShopMeta,
    listShopProducts,
    getShopProduct,
    signupShopper,
    loginShopper,
    ...shopCartService
};
