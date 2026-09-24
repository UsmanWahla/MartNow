const { query, withTransaction } = require("../utils/query");
const { toMoney } = require("../utils/http");
const { parseListOptions, like } = require("../utils/list");
const { ServiceError } = require("../utils/errors");
const { mapOrderMoney } = require("../utils/orderMap");
const { deleteSale } = require("./saleService");

async function getOrderRow(tenantId, orderId) {
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
        WHERE shop_orders.id = ? AND shop_orders.user_id = ?
        `,
        [orderId, tenantId]
    );

    if (rows.length === 0) {
        throw new ServiceError(404, "Order not found");
    }

    return rows[0];
}

async function withItems(order) {
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

    return {
        id: order.id,
        sale_id: order.sale_id,
        customer_id: order.customer_id,
        customer: order.customer,
        email: order.email,
        phone: order.phone,
        address: order.address,
        city: order.city,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        delivery_status: order.delivery_status,
        ...mapOrderMoney(order),
        created_at: order.created_at,
        items
    };
}

async function listOrders(tenantId, options = {}) {
    const { search, limitSql } = parseListOptions(options);
    const params = [tenantId];
    let where = "WHERE shop_orders.user_id = ?";

    if (search) {
        where += ` AND (
            IFNULL(customers.name, '') LIKE ?
            OR IFNULL(shop_orders.city, '') LIKE ?
            OR IFNULL(shop_orders.email, '') LIKE ?
        )`;
        params.push(like(search), like(search), like(search));
    }

    const countRows = await query(
        `
        SELECT COUNT(*) AS n
        FROM shop_orders
        INNER JOIN customers ON customers.id = shop_orders.customer_id
        ${where}
        `,
        params
    );

    const rows = await query(
        `
        SELECT
            shop_orders.id,
            shop_orders.sale_id,
            shop_orders.customer_id,
            customers.name AS customer,
            shop_orders.email,
            shop_orders.phone,
            shop_orders.address,
            shop_orders.city,
            shop_orders.payment_method,
            shop_orders.payment_status,
            shop_orders.delivery_status,
            shop_orders.delivery_by,
            shop_orders.delivery_fee,
            sales.total_amount,
            sales.paid_amount,
            shop_orders.created_at
        FROM shop_orders
        LEFT JOIN sales ON sales.id = shop_orders.sale_id
        INNER JOIN customers ON customers.id = shop_orders.customer_id
        ${where}
        ORDER BY shop_orders.id DESC
        ${limitSql}
        `,
        params
    );

    return {
        rows: rows.map((row) => ({
            ...row,
            ...mapOrderMoney(row)
        })),
        total: Number(countRows[0].n)
    };
}

async function getOrder(tenantId, orderId) {
    return withItems(await getOrderRow(tenantId, orderId));
}

async function collectOrderPayment(tenantId, order) {
    if (order.payment_status === "collected") {
        return;
    }

    if (!order.sale_id) {
        throw new ServiceError(400, "This order has no sale to collect");
    }

    const sales = await query(
        "SELECT id, total_amount, paid_amount, customer_id FROM sales WHERE id = ? AND user_id = ? FOR UPDATE",
        [order.sale_id, tenantId]
    );

    if (sales.length === 0) {
        throw new ServiceError(404, "Sale not found");
    }

    const due = toMoney(toMoney(sales[0].total_amount) - toMoney(sales[0].paid_amount));

    if (due > 0) {
        await query(
            "UPDATE sales SET paid_amount = total_amount WHERE id = ? AND user_id = ?",
            [order.sale_id, tenantId]
        );
        await query(
            "UPDATE customers SET balance = GREATEST(0, balance - ?) WHERE id = ? AND user_id = ?",
            [due, sales[0].customer_id, tenantId]
        );
    }

    await query(
        "UPDATE shop_orders SET payment_status = 'collected' WHERE id = ? AND user_id = ?",
        [order.id, tenantId]
    );
}

async function collectOrder(tenantId, orderId) {
    await withTransaction(async () => {
        const order = await getOrderRow(tenantId, orderId);

        if (order.delivery_status === "cancelled") {
            throw new ServiceError(400, "Cancelled orders cannot be collected");
        }

        await collectOrderPayment(tenantId, order);
    });

    return { message: "Payment collected", order: await getOrder(tenantId, orderId) };
}

async function updateOrderStatus(tenantId, orderId, deliveryStatus, options = {}) {
    const status = String(deliveryStatus || "").trim().toLowerCase();

    if (!["pending", "processing", "dispatched", "delivered", "cancelled"].includes(status)) {
        throw new ServiceError(400, "Invalid delivery status");
    }

    await withTransaction(async () => {
        const order = await getOrderRow(tenantId, orderId);

        if (order.delivery_status === "cancelled" && status !== "cancelled") {
            throw new ServiceError(400, "Cancelled orders cannot be updated");
        }

        if (status === "cancelled" && order.delivery_status !== "cancelled") {
            await query(
                "UPDATE shop_orders SET delivery_status = 'cancelled', platform_fee = 0, delivery_fee = 0 WHERE id = ? AND user_id = ?",
                [orderId, tenantId]
            );

            if (order.sale_id) {
                await deleteSale(tenantId, order.sale_id);
            }

            return;
        }

        const isPlatformDelivery = String(order.delivery_by || "") === "platform";

        if (status === "delivered" && isPlatformDelivery && !options.allowPlatformDeliver) {
            throw new ServiceError(
                400,
                "Platform deliveries can only be marked delivered by super admin"
            );
        }

        const result = await query(
            "UPDATE shop_orders SET delivery_status = ? WHERE id = ? AND user_id = ?",
            [status, orderId, tenantId]
        );

        if (result.affectedRows === 0) {
            throw new ServiceError(404, "Order not found");
        }

        if (status === "delivered") {
            await collectOrderPayment(tenantId, { ...order, delivery_status: status });
        }
    });

    if (status === "cancelled") {
        return { message: "Order cancelled", order: await getOrder(tenantId, orderId) };
    }

    if (status === "delivered") {
        return { message: "Order delivered and paid", order: await getOrder(tenantId, orderId) };
    }

    return { message: "Order updated", order: await getOrder(tenantId, orderId) };
}

module.exports = { listOrders, getOrder, collectOrder, updateOrderStatus };
