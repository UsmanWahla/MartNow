const { query, withTransaction } = require("../utils/query");
const { parseListOptions } = require("../utils/list");
const { parseLatitude, parseLongitude } = require("../utils/coordinates");
const { mapOrderMoney } = require("../utils/orderMap");
const { ServiceError } = require("../utils/errors");
const profileService = require("./profileService");
const { toPublicUser } = require("./authService");

const ORDER_STATUSES = new Set([
    "pending",
    "processing",
    "dispatched",
    "delivered",
    "cancelled"
]);

function text(value, maxLength) {
    return String(value || "").trim().slice(0, maxLength);
}

function readDefault(value) {
    return value === true || value === 1 || value === "1" || value === "true";
}

function mapAddress(row) {
    return {
        id: Number(row.id),
        label: row.label,
        recipient_name: row.recipient_name,
        phone: row.phone,
        address: row.address,
        city: row.city,
        latitude: row.latitude == null ? null : Number(row.latitude),
        longitude: row.longitude == null ? null : Number(row.longitude),
        is_default: Number(row.is_default) === 1,
        created_at: row.created_at,
        updated_at: row.updated_at
    };
}

function readAddress(data) {
    const latitude = parseLatitude(data.latitude);
    const longitude = parseLongitude(data.longitude);
    const address = {
        label: text(data.label, 40) || "Home",
        recipientName: text(data.recipient_name, 100),
        phone: text(data.phone, 30),
        address: text(data.address, 250),
        city: text(data.city, 80),
        latitude,
        longitude,
        isDefault: readDefault(data.is_default)
    };

    if (!address.recipientName || !address.phone || !address.address || !address.city) {
        throw new ServiceError(
            400,
            "Recipient name, phone, address and city are required"
        );
    }

    if ((latitude == null) !== (longitude == null)) {
        throw new ServiceError(400, "Select both latitude and longitude");
    }

    return address;
}

async function lockCustomerAccount(userId) {
    const rows = await query("SELECT id FROM users WHERE id = ? FOR UPDATE", [userId]);

    if (rows.length === 0) {
        throw new ServiceError(404, "Customer account not found");
    }
}

async function getProfile(userId) {
    const rows = await query(
        `
        SELECT id, name, email, phone, username, role, owner_id, shop_name, shop_slug,
               low_stock_threshold, avatar_path
        FROM users
        WHERE id = ?
        `,
        [userId]
    );

    if (rows.length === 0) {
        throw new ServiceError(404, "Customer account not found");
    }

    return {
        name: rows[0].name,
        email: rows[0].email,
        phone: rows[0].phone || ""
    };
}

async function updateProfile(userId, data) {
    const name = text(data.name, 100);
    const phone = text(data.phone, 30);

    if (!name) {
        throw new ServiceError(400, "Name is required");
    }

    return withTransaction(async () => {
        const rows = await query(
            `
            SELECT id, name, email, phone, username, role, owner_id, shop_name, shop_slug,
                   low_stock_threshold, avatar_path
            FROM users
            WHERE id = ?
            FOR UPDATE
            `,
            [userId]
        );

        if (rows.length === 0) {
            throw new ServiceError(404, "Customer account not found");
        }

        await query("UPDATE users SET name = ?, phone = ? WHERE id = ?", [
            name,
            phone || null,
            userId
        ]);
        await query(
            `
            UPDATE customers
            SET name = ?, phone = ?, email = ?
            WHERE account_user_id = ?
            `,
            [name, phone || null, rows[0].email, userId]
        );

        const user = {
            ...rows[0],
            name,
            phone: phone || null
        };

        return {
            message: "Profile saved",
            profile: { name, email: rows[0].email, phone },
            user: toPublicUser(user)
        };
    });
}

function updatePassword(userId, data) {
    return profileService.updatePassword(userId, data);
}

async function listAddresses(userId) {
    const rows = await query(
        `
        SELECT *
        FROM customer_addresses
        WHERE shopper_user_id = ?
        ORDER BY is_default DESC, updated_at DESC, id DESC
        `,
        [userId]
    );

    return { rows: rows.map(mapAddress) };
}

async function getAddress(userId, addressId, lock = false) {
    const rows = await query(
        `
        SELECT *
        FROM customer_addresses
        WHERE id = ? AND shopper_user_id = ?
        ${lock ? "FOR UPDATE" : ""}
        `,
        [addressId, userId]
    );

    if (rows.length === 0) {
        throw new ServiceError(404, "Address not found");
    }

    return mapAddress(rows[0]);
}

async function createAddress(userId, data) {
    const address = readAddress(data);

    return withTransaction(async () => {
        await lockCustomerAccount(userId);
        const counts = await query(
            "SELECT COUNT(*) AS n FROM customer_addresses WHERE shopper_user_id = ? FOR UPDATE",
            [userId]
        );
        const makeDefault = address.isDefault || Number(counts[0].n) === 0;

        if (makeDefault) {
            await query(
                "UPDATE customer_addresses SET is_default = 0 WHERE shopper_user_id = ?",
                [userId]
            );
        }

        const result = await query(
            `
            INSERT INTO customer_addresses (
                shopper_user_id, label, recipient_name, phone, address, city,
                latitude, longitude, is_default
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                userId,
                address.label,
                address.recipientName,
                address.phone,
                address.address,
                address.city,
                address.latitude,
                address.longitude,
                makeDefault ? 1 : 0
            ]
        );

        return {
            message: "Address saved",
            address: await getAddress(userId, result.insertId)
        };
    });
}

async function updateAddress(userId, addressId, data) {
    return withTransaction(async () => {
        await lockCustomerAccount(userId);
        const existing = await getAddress(userId, addressId, true);
        const address = readAddress({ ...existing, ...data });
        const makeDefault = existing.is_default || address.isDefault;

        if (address.isDefault) {
            await query(
                "UPDATE customer_addresses SET is_default = 0 WHERE shopper_user_id = ?",
                [userId]
            );
        }

        await query(
            `
            UPDATE customer_addresses
            SET label = ?, recipient_name = ?, phone = ?, address = ?, city = ?,
                latitude = ?, longitude = ?, is_default = ?
            WHERE id = ? AND shopper_user_id = ?
            `,
            [
                address.label,
                address.recipientName,
                address.phone,
                address.address,
                address.city,
                address.latitude,
                address.longitude,
                makeDefault ? 1 : 0,
                addressId,
                userId
            ]
        );

        return {
            message: "Address updated",
            address: await getAddress(userId, addressId)
        };
    });
}

async function setDefaultAddress(userId, addressId) {
    return withTransaction(async () => {
        await lockCustomerAccount(userId);
        await getAddress(userId, addressId, true);
        await query(
            "UPDATE customer_addresses SET is_default = 0 WHERE shopper_user_id = ?",
            [userId]
        );
        await query(
            "UPDATE customer_addresses SET is_default = 1 WHERE id = ? AND shopper_user_id = ?",
            [addressId, userId]
        );

        return {
            message: "Default address updated",
            address: await getAddress(userId, addressId)
        };
    });
}

async function deleteAddress(userId, addressId) {
    return withTransaction(async () => {
        await lockCustomerAccount(userId);
        const existing = await getAddress(userId, addressId, true);
        await query(
            "DELETE FROM customer_addresses WHERE id = ? AND shopper_user_id = ?",
            [addressId, userId]
        );

        if (existing.is_default) {
            const replacements = await query(
                `
                SELECT id
                FROM customer_addresses
                WHERE shopper_user_id = ?
                ORDER BY updated_at DESC, id DESC
                LIMIT 1
                FOR UPDATE
                `,
                [userId]
            );

            if (replacements.length > 0) {
                await query(
                    "UPDATE customer_addresses SET is_default = 1 WHERE id = ? AND shopper_user_id = ?",
                    [replacements[0].id, userId]
                );
            }
        }

        return { message: "Address deleted" };
    });
}

function mapCustomerOrder(row) {
    return {
        id: Number(row.id),
        sale_id: row.sale_id == null ? null : Number(row.sale_id),
        shop_name: row.shop_name || "Store",
        shop_slug: row.shop_slug || "",
        logo_path: row.logo_path || null,
        customer_address_id: row.customer_address_id == null
            ? null
            : Number(row.customer_address_id),
        customer: row.customer || "",
        email: row.email,
        phone: row.phone || "",
        address: row.address,
        city: row.city,
        latitude: row.latitude == null ? null : Number(row.latitude),
        longitude: row.longitude == null ? null : Number(row.longitude),
        payment_method: row.payment_method,
        payment_status: row.payment_status,
        delivery_status: row.delivery_status,
        ...mapOrderMoney(row),
        created_at: row.created_at
    };
}

async function listOrders(userId, options = {}) {
    const { limitSql } = parseListOptions(options);
    const requestedStatus = String(options.status || "").trim().toLowerCase();
    const status = ORDER_STATUSES.has(requestedStatus) ? requestedStatus : "";
    const params = [userId];
    let where = "WHERE shop_orders.shopper_user_id = ?";

    if (status) {
        where += " AND shop_orders.delivery_status = ?";
        params.push(status);
    }

    const counts = await query(`SELECT COUNT(*) AS n FROM shop_orders ${where}`, params);
    const rows = await query(
        `
        SELECT
            shop_orders.*,
            sales.total_amount,
            sales.paid_amount,
            customers.name AS customer,
            COALESCE(stores.name, store_users.shop_name, store_users.name) AS shop_name,
            COALESCE(stores.shop_slug, store_users.shop_slug) AS shop_slug,
            stores.logo_path
        FROM shop_orders
        LEFT JOIN sales ON sales.id = shop_orders.sale_id
        INNER JOIN customers ON customers.id = shop_orders.customer_id
        INNER JOIN users store_users ON store_users.id = shop_orders.user_id
        LEFT JOIN stores ON stores.tenant_user_id = shop_orders.user_id
        ${where}
        ORDER BY shop_orders.created_at DESC, shop_orders.id DESC
        ${limitSql}
        `,
        params
    );

    return { rows: rows.map(mapCustomerOrder), total: Number(counts[0].n) };
}

async function getOrder(userId, orderId) {
    const rows = await query(
        `
        SELECT
            shop_orders.*,
            sales.total_amount,
            sales.paid_amount,
            customers.name AS customer,
            COALESCE(stores.name, store_users.shop_name, store_users.name) AS shop_name,
            COALESCE(stores.shop_slug, store_users.shop_slug) AS shop_slug,
            stores.logo_path
        FROM shop_orders
        LEFT JOIN sales ON sales.id = shop_orders.sale_id
        INNER JOIN customers ON customers.id = shop_orders.customer_id
        INNER JOIN users store_users ON store_users.id = shop_orders.user_id
        LEFT JOIN stores ON stores.tenant_user_id = shop_orders.user_id
        WHERE shop_orders.id = ? AND shop_orders.shopper_user_id = ?
        `,
        [orderId, userId]
    );

    if (rows.length === 0) {
        throw new ServiceError(404, "Order not found");
    }

    const order = mapCustomerOrder(rows[0]);
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

    return { ...order, items };
}

module.exports = {
    getProfile,
    updateProfile,
    updatePassword,
    listAddresses,
    getAddress,
    createAddress,
    updateAddress,
    setDefaultAddress,
    deleteAddress,
    listOrders,
    getOrder
};
