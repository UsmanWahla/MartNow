const { query, withTransaction } = require("../utils/query");
const { toNumber, toMoney } = require("../utils/http");
const { platformDeliveryFee } = require("../utils/platform");
const { mapOrderMoney } = require("../utils/orderMap");
const { ServiceError } = require("../utils/errors");
const { isValidEmail, normalizeEmail } = require("../utils/validation");
const { hydrateShopMeta } = require("../utils/slug");
const { addSale } = require("./saleService");
const { toPublicUser } = require("./authService");
const { getShopBySlug, getShopperCustomer, assertShopper } = require("./shopCore");
const profileService = require("./profileService");

async function listCart(slug, auth) {
    const shop = await getShopBySlug(slug);
    assertShopper(auth, shop);

    const rows = await query(
        `
        SELECT
            cart_items.id,
            cart_items.product_id,
            cart_items.quantity,
            cart_items.color,
            cart_items.size,
            products.name,
            products.price,
            COALESCE(product_variants.stock, products.stock) AS stock,
            products.image_path
        FROM cart_items
        INNER JOIN products ON products.id = cart_items.product_id
        LEFT JOIN product_variants
            ON product_variants.product_id = cart_items.product_id
            AND product_variants.color = cart_items.color
            AND product_variants.size = cart_items.size
        WHERE cart_items.user_id = ? AND products.user_id = ?
        ORDER BY cart_items.id DESC
        `,
        [auth.id, shop.tenantId]
    );

    const items = rows.map((row) => ({
        id: row.id,
        product_id: row.product_id,
        name: row.name,
        quantity: toNumber(row.quantity),
        color: row.color || "",
        size: row.size || "",
        price: row.price,
        stock: toNumber(row.stock),
        image_path: row.image_path || null,
        line_total: toMoney(toNumber(row.quantity) * toMoney(row.price))
    }));

    const total = toMoney(items.reduce((sum, item) => sum + item.line_total, 0));

    return { items, total, shop_name: shop.shop_name };
}

async function addToCart(slug, auth, { product_id, quantity, color, size }) {
    const shop = await getShopBySlug(slug);
    assertShopper(auth, shop);

    const productId = toNumber(product_id);
    const qty = toNumber(quantity) || 1;
    const colorName = String(color || "").trim();
    const sizeName = String(size || "").trim();

    if (productId <= 0 || qty <= 0) {
        throw new ServiceError(400, "Product and quantity are required");
    }

    const products = await query(
        "SELECT id, stock FROM products WHERE id = ? AND user_id = ?",
        [productId, shop.tenantId]
    );

    if (products.length === 0) {
        throw new ServiceError(404, "Product not found");
    }

    const [colors, sizes] = await Promise.all([
        query("SELECT name FROM product_colors WHERE product_id = ?", [productId]),
        query("SELECT name FROM product_sizes WHERE product_id = ?", [productId])
    ]);

    if (colors.length > 0 && !colors.some((row) => row.name === colorName)) {
        throw new ServiceError(400, "Choose a color");
    }

    if (sizes.length > 0 && !sizes.some((row) => row.name === sizeName)) {
        throw new ServiceError(400, "Choose a size");
    }

    await query(
        `
        DELETE cart_items FROM cart_items
        INNER JOIN products ON products.id = cart_items.product_id
        WHERE cart_items.user_id = ? AND products.user_id <> ?
        `,
        [auth.id, shop.tenantId]
    );

    const existing = await query(
        `
        SELECT id, quantity FROM cart_items
        WHERE user_id = ? AND product_id = ? AND color = ? AND size = ?
        `,
        [auth.id, productId, colorName, sizeName]
    );

    const nextQty = existing.length > 0 ? toNumber(existing[0].quantity) + qty : qty;
    const variants = await query(
        "SELECT stock FROM product_variants WHERE product_id = ? AND color = ? AND size = ?",
        [productId, colorName, sizeName]
    );
    const available = variants.length > 0 ? toNumber(variants[0].stock) : toNumber(products[0].stock);

    if (nextQty > available) {
        throw new ServiceError(400, "Not enough stock for this option");
    }

    if (existing.length > 0) {
        await query("UPDATE cart_items SET quantity = ? WHERE id = ?", [nextQty, existing[0].id]);
    } else {
        await query(
            "INSERT INTO cart_items (user_id, product_id, quantity, color, size) VALUES (?, ?, ?, ?, ?)",
            [auth.id, productId, nextQty, colorName, sizeName]
        );
    }

    return listCart(slug, auth);
}

async function updateCartItem(slug, auth, itemId, quantity) {
    const shop = await getShopBySlug(slug);
    assertShopper(auth, shop);

    const qty = toNumber(quantity);
    const items = await query(
        `
        SELECT cart_items.id, cart_items.product_id, cart_items.quantity, cart_items.color, cart_items.size
        FROM cart_items
        INNER JOIN products ON products.id = cart_items.product_id
        WHERE cart_items.id = ? AND cart_items.user_id = ? AND products.user_id = ?
        `,
        [itemId, auth.id, shop.tenantId]
    );

    if (items.length === 0) {
        throw new ServiceError(404, "Cart item not found");
    }

    if (qty <= 0) {
        await query("DELETE FROM cart_items WHERE id = ? AND user_id = ?", [itemId, auth.id]);
        return listCart(slug, auth);
    }

    const variants = await query(
        "SELECT stock FROM product_variants WHERE product_id = ? AND color = ? AND size = ?",
        [items[0].product_id, items[0].color || "", items[0].size || ""]
    );
    const available =
        variants.length > 0
            ? toNumber(variants[0].stock)
            : toNumber(
                  (
                      await query("SELECT stock FROM products WHERE id = ? AND user_id = ?", [
                          items[0].product_id,
                          shop.tenantId
                      ])
                  )[0].stock
              );

    if (qty > available) {
        throw new ServiceError(400, "Not enough stock for this option");
    }

    await query("UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?", [
        qty,
        itemId,
        auth.id
    ]);

    return listCart(slug, auth);
}

async function removeCartItem(slug, auth, itemId) {
    const shop = await getShopBySlug(slug);
    assertShopper(auth, shop);

    await query(
        `
        DELETE cart_items FROM cart_items
        INNER JOIN products ON products.id = cart_items.product_id
        WHERE cart_items.id = ? AND cart_items.user_id = ? AND products.user_id = ?
        `,
        [itemId, auth.id, shop.tenantId]
    );

    return listCart(slug, auth);
}

function readCheckout(data, shop) {
    const email = normalizeEmail(data.email || "");
    const name = String(data.name || "").trim();
    const phone = String(data.phone || "").trim();
    const address = String(data.address || "").trim();
    const city = String(data.city || "").trim();
    const paymentMethod = String(data.payment_method || "cod").trim().toLowerCase();
    const requestedBy = String(data.delivery_by || "").trim().toLowerCase();

    if (!email || !name || !phone || !address || !city) {
        throw new ServiceError(400, "Name, email, phone, address and city are required");
    }

    if (!isValidEmail(email)) {
        throw new ServiceError(400, "Enter a valid email address");
    }

    if (paymentMethod !== "cod") {
        throw new ServiceError(400, "Only cash on delivery is available");
    }

    let deliveryBy = "platform";

    if (shop.delivery_enabled) {
        if (requestedBy !== "store" && requestedBy !== "platform") {
            throw new ServiceError(400, "Choose store or platform delivery");
        }

        deliveryBy = requestedBy;
    } else if (requestedBy && requestedBy !== "platform") {
        throw new ServiceError(400, "This store does not offer its own delivery");
    }

    const deliveryFee = deliveryBy === "platform" ? platformDeliveryFee() : 0;

    return { email, name, phone, address, city, paymentMethod, deliveryBy, deliveryFee };
}

async function getShopperOrder(slug, auth, orderId) {
    const shop = await getShopBySlug(slug);
    assertShopper(auth, shop);

    const rows = await query(
        `
        SELECT
            shop_orders.*,
            sales.total_amount,
            sales.paid_amount,
            customers.name AS customer
        FROM shop_orders
        LEFT JOIN sales ON sales.id = shop_orders.sale_id
        INNER JOIN customers ON customers.id = shop_orders.customer_id
        WHERE shop_orders.id = ? AND shop_orders.user_id = ? AND shop_orders.shopper_user_id = ?
        `,
        [orderId, shop.tenantId, auth.id]
    );

    if (rows.length === 0) {
        throw new ServiceError(404, "Order not found");
    }

    const order = rows[0];
    let items = [];

    if (order.sale_id) {
        items = await query(
            `
            SELECT
                sale_items.product_id,
                products.name AS product,
                sale_items.quantity,
                sale_items.unit_price,
                sale_items.total_amount,
                sale_items.color,
                sale_items.size
            FROM sale_items
            INNER JOIN products ON products.id = sale_items.product_id
            WHERE sale_items.sale_id = ?
            ORDER BY sale_items.id
            `,
            [order.sale_id]
        );
    }

    const money = mapOrderMoney(order);

    return {
        id: order.id,
        shop_name: shop.shop_name,
        shop_slug: shop.shop_slug,
        email: order.email,
        phone: order.phone,
        address: order.address,
        city: order.city,
        customer: order.customer,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        delivery_status: order.delivery_status,
        ...money,
        created_at: order.created_at,
        items
    };
}

async function checkout(slug, auth, data) {
    const shop = await getShopBySlug(slug);
    assertShopper(auth, shop);
    const details = readCheckout(data, shop);

    return withTransaction(async () => {
        const cart = await query(
            `
            SELECT cart_items.product_id, cart_items.quantity, cart_items.color, cart_items.size
            FROM cart_items
            INNER JOIN products ON products.id = cart_items.product_id
            WHERE cart_items.user_id = ? AND products.user_id = ?
            `,
            [auth.id, shop.tenantId]
        );

        if (cart.length === 0) {
            throw new ServiceError(400, "Your cart is empty");
        }

        const customer = await getShopperCustomer(shop.tenantId, auth.id);

        await query(
            `
            UPDATE customers
            SET name = ?, phone = ?, email = ?, address = ?, city = ?
            WHERE id = ? AND user_id = ?
            `,
            [
                details.name,
                details.phone,
                details.email,
                details.address,
                details.city,
                customer.id,
                shop.tenantId
            ]
        );

        const saleResult = await addSale(
            shop.tenantId,
            {
                items: cart.map((item) => ({
                    product_id: item.product_id,
                    quantity: item.quantity,
                    color: item.color,
                    size: item.size
                })),
                customer_id: customer.id,
                paid_amount: 0
            },
            auth.id
        );

        const commissionPercent = Number(shop.commission_percent || 0);
        const platformFee = toMoney((toMoney(saleResult.sale.total_amount) * commissionPercent) / 100);

        const orderInsert = await query(
            `
            INSERT INTO shop_orders (
                user_id, sale_id, customer_id, shopper_user_id,
                email, phone, address, city, payment_method, payment_status, delivery_status,
                delivery_by, delivery_fee, commission_percent, platform_fee
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'cod', 'pending', 'pending', ?, ?, ?, ?)
            `,
            [
                shop.tenantId,
                saleResult.sale.id,
                customer.id,
                auth.id,
                details.email,
                details.phone,
                details.address,
                details.city,
                details.deliveryBy,
                details.deliveryFee,
                commissionPercent,
                platformFee
            ]
        );

        await query("DELETE FROM cart_items WHERE user_id = ?", [auth.id]);

        return getShopperOrder(slug, auth, orderInsert.insertId);
    });
}

async function checkoutProfile(slug, auth) {
    const shop = await getShopBySlug(slug);
    assertShopper(auth, shop);
    const customer = await getShopperCustomer(shop.tenantId, auth.id);

    return {
        name: customer.name,
        email: customer.email || auth.email || "",
        phone: customer.phone || "",
        address: customer.address || "",
        city: customer.city || ""
    };
}

async function updateShopperProfile(slug, auth, data) {
    const shop = await getShopBySlug(slug);
    assertShopper(auth, shop);
    const details = {
        name: String(data.name || "").trim(),
        phone: String(data.phone || "").trim(),
        address: String(data.address || "").trim(),
        city: String(data.city || "").trim()
    };

    if (!details.name) {
        throw new ServiceError(400, "Name is required");
    }

    const customer = await getShopperCustomer(shop.tenantId, auth.id);

    await query("UPDATE users SET name = ? WHERE id = ?", [details.name, auth.id]);
    await query(
        `
        UPDATE customers
        SET name = ?, phone = ?, address = ?, city = ?
        WHERE id = ? AND user_id = ?
        `,
        [
            details.name,
            details.phone || null,
            details.address || null,
            details.city || null,
            customer.id,
            shop.tenantId
        ]
    );

    const rows = await query(
        "SELECT id, name, email, role, owner_id, shop_name, shop_slug, low_stock_threshold FROM users WHERE id = ?",
        [auth.id]
    );

    return {
        message: "Profile saved",
        user: toPublicUser(await hydrateShopMeta(rows[0])),
        profile: await checkoutProfile(slug, { ...auth, email: rows[0].email })
    };
}

async function updateShopperPassword(slug, auth, data) {
    const shop = await getShopBySlug(slug);
    assertShopper(auth, shop);
    return profileService.updatePassword(auth.id, data);
}

async function listShopperOrders(slug, auth) {
    const shop = await getShopBySlug(slug);
    assertShopper(auth, shop);

    const rows = await query(
        `
        SELECT
            shop_orders.id,
            shop_orders.city,
            shop_orders.payment_status,
            shop_orders.delivery_status,
            shop_orders.created_at,
            sales.total_amount
        FROM shop_orders
        LEFT JOIN sales ON sales.id = shop_orders.sale_id
        WHERE shop_orders.user_id = ? AND shop_orders.shopper_user_id = ?
        ORDER BY shop_orders.id DESC
        `,
        [shop.tenantId, auth.id]
    );

    return { rows, shop_name: shop.shop_name };
}

module.exports = {
    listCart,
    addToCart,
    updateCartItem,
    removeCartItem,
    checkout,
    getShopperOrder,
    checkoutProfile,
    updateShopperProfile,
    updateShopperPassword,
    listShopperOrders
};
