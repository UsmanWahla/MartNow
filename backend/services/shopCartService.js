const { query, withTransaction } = require("../utils/query");
const { toNumber, toMoney } = require("../utils/http");
const { platformDeliveryFee } = require("../utils/platform");
const { mapOrderMoney } = require("../utils/orderMap");
const { ServiceError } = require("../utils/errors");
const { isValidEmail, normalizeEmail } = require("../utils/validation");
const { parseLatitude, parseLongitude } = require("../utils/coordinates");
const { addSale } = require("./saleService");
const { getShopBySlug, getShopperCustomer, assertShopper } = require("./shopCore");
const profileService = require("./profileService");
const customerAccountService = require("./customerAccountService");
const {
    assertSaleQuantity,
    toBaseQuantity,
    toSaleQuantity,
    roundQuantity
} = require("../utils/productUnits");

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
            products.inventory_type,
            products.base_unit,
            products.sale_unit,
            products.quantity_step,
            products.units_per_sale_unit,
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
        stock: toSaleQuantity(row.stock, row.units_per_sale_unit),
        base_stock: toNumber(row.stock),
        inventory_type: row.inventory_type,
        base_unit: row.base_unit,
        sale_unit: row.sale_unit,
        quantity_step: toNumber(row.quantity_step),
        units_per_sale_unit: toNumber(row.units_per_sale_unit),
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
    const requestedQty = roundQuantity(quantity) || 1;
    const colorName = String(color || "").trim();
    const sizeName = String(size || "").trim();

    if (productId <= 0 || requestedQty <= 0) {
        throw new ServiceError(400, "Product and quantity are required");
    }

    const products = await query(
        `
        SELECT id, stock, quantity_step, units_per_sale_unit
        FROM products
        WHERE id = ? AND user_id = ?
        `,
        [productId, shop.tenantId]
    );

    if (products.length === 0) {
        throw new ServiceError(404, "Product not found");
    }

    const qty = assertSaleQuantity(requestedQty, products[0].quantity_step);

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

    const nextQty = assertSaleQuantity(
        existing.length > 0 ? toNumber(existing[0].quantity) + qty : qty,
        products[0].quantity_step
    );
    const variants = await query(
        "SELECT stock FROM product_variants WHERE product_id = ? AND color = ? AND size = ?",
        [productId, colorName, sizeName]
    );
    const available = variants.length > 0 ? toNumber(variants[0].stock) : toNumber(products[0].stock);

    if (toBaseQuantity(nextQty, products[0].units_per_sale_unit) > available) {
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

    const requestedQty = roundQuantity(quantity);
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

    if (requestedQty <= 0) {
        await query("DELETE FROM cart_items WHERE id = ? AND user_id = ?", [itemId, auth.id]);
        return listCart(slug, auth);
    }

    const productRows = await query(
        `
        SELECT stock, quantity_step, units_per_sale_unit
        FROM products
        WHERE id = ? AND user_id = ?
        `,
        [items[0].product_id, shop.tenantId]
    );
    const qty = assertSaleQuantity(requestedQty, productRows[0].quantity_step);

    const variants = await query(
        "SELECT stock FROM product_variants WHERE product_id = ? AND color = ? AND size = ?",
        [items[0].product_id, items[0].color || "", items[0].size || ""]
    );
    const available =
        variants.length > 0
            ? toNumber(variants[0].stock)
            : toNumber(productRows[0].stock);

    if (toBaseQuantity(qty, productRows[0].units_per_sale_unit) > available) {
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
    const latitude = parseLatitude(data.latitude);
    const longitude = parseLongitude(data.longitude);

    if (!email || !name || !phone || !address || !city) {
        throw new ServiceError(400, "Name, email, phone, address and city are required");
    }

    if (!isValidEmail(email)) {
        throw new ServiceError(400, "Enter a valid email address");
    }

    if ((latitude == null) !== (longitude == null)) {
        throw new ServiceError(400, "Select both latitude and longitude");
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

    return {
        email,
        name,
        phone,
        address,
        city,
        latitude,
        longitude,
        paymentMethod,
        deliveryBy,
        deliveryFee,
        saveAddress:
            data.save_address === true ||
            data.save_address === 1 ||
            data.save_address === "1" ||
            data.save_address === "true",
        addressLabel: String(data.address_label || "Home").trim().slice(0, 40) || "Home"
    };
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
                sale_items.sale_unit,
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
        customer_address_id: order.customer_address_id == null
            ? null
            : Number(order.customer_address_id),
        latitude: order.latitude == null ? null : Number(order.latitude),
        longitude: order.longitude == null ? null : Number(order.longitude),
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

    return withTransaction(async () => {
        const requestedAddressId = toNumber(data.address_id);
        let selectedAddress = null;

        if (requestedAddressId > 0) {
            selectedAddress = await customerAccountService.getAddress(
                auth.id,
                requestedAddressId,
                true
            );
        }

        const details = readCheckout(
            selectedAddress
                ? {
                    ...data,
                    name: selectedAddress.recipient_name,
                    phone: selectedAddress.phone,
                    address: selectedAddress.address,
                    city: selectedAddress.city,
                    latitude: selectedAddress.latitude,
                    longitude: selectedAddress.longitude
                }
                : data,
            shop
        );
        let customerAddressId = selectedAddress?.id || null;

        if (!customerAddressId && details.saveAddress) {
            const saved = await customerAccountService.createAddress(auth.id, {
                label: details.addressLabel,
                recipient_name: details.name,
                phone: details.phone,
                address: details.address,
                city: details.city,
                latitude: details.latitude,
                longitude: details.longitude,
                is_default: false
            });
            customerAddressId = saved.address.id;
        }

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
                user_id, sale_id, customer_id, shopper_user_id, customer_address_id,
                email, phone, address, city, latitude, longitude,
                payment_method, payment_status, delivery_status,
                delivery_by, delivery_fee, commission_percent, platform_fee
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cod', 'pending', 'pending', ?, ?, ?, ?)
            `,
            [
                shop.tenantId,
                saleResult.sale.id,
                customer.id,
                auth.id,
                customerAddressId,
                details.email,
                details.phone,
                details.address,
                details.city,
                details.latitude,
                details.longitude,
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
    const [customer, profile, addressResult] = await Promise.all([
        getShopperCustomer(shop.tenantId, auth.id),
        customerAccountService.getProfile(auth.id),
        customerAccountService.listAddresses(auth.id)
    ]);
    const defaultAddress =
        addressResult.rows.find((address) => address.is_default) || addressResult.rows[0] || null;

    return {
        name: profile.name || customer.name,
        email: profile.email || customer.email || auth.email || "",
        phone: defaultAddress?.phone || profile.phone || customer.phone || "",
        address: defaultAddress?.address || customer.address || "",
        city: defaultAddress?.city || customer.city || "",
        address_id: defaultAddress?.id || null,
        latitude: defaultAddress?.latitude ?? null,
        longitude: defaultAddress?.longitude ?? null,
        addresses: addressResult.rows
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

    const profileResult = await customerAccountService.updateProfile(auth.id, details);
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

    return {
        message: "Profile saved",
        user: profileResult.user,
        profile: await checkoutProfile(slug, auth)
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
