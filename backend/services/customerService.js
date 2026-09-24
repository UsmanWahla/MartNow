const { query, withTransaction } = require("../utils/query");
const { toMoney } = require("../utils/http");
const { parseListOptions, like } = require("../utils/list");
const { ServiceError } = require("../utils/errors");

async function settleClearedCustomers(tenantId) {
    await query(
        `
        UPDATE sales
        INNER JOIN customers
            ON customers.id = sales.customer_id
            AND customers.user_id = sales.user_id
        SET sales.paid_amount = sales.total_amount
        WHERE sales.user_id = ?
            AND customers.balance <= 0
            AND sales.paid_amount < sales.total_amount
        `,
        [tenantId]
    );
}

async function listCustomers(tenantId, options = {}) {
    const { search, limitSql } = parseListOptions(options);
    const params = [tenantId];
    let where = "WHERE user_id = ?";

    if (search) {
        where += " AND (name LIKE ? OR IFNULL(phone, '') LIKE ? OR IFNULL(email, '') LIKE ?)";
        params.push(like(search), like(search), like(search));
    }

    const countRows = await query(
        `SELECT COUNT(*) AS n FROM customers ${where}`,
        params
    );
    const rows = await query(
        `SELECT id, name, phone, email, balance FROM customers ${where} ORDER BY id DESC ${limitSql}`,
        params
    );

    return { rows, total: Number(countRows[0].n) };
}

async function addCustomer(tenantId, { name, phone }) {
    const customerName = String(name || "").trim();

    if (!customerName) {
        throw new ServiceError(400, "Customer name is required");
    }

    const result = await query(
        "INSERT INTO customers (user_id, name, phone) VALUES (?, ?, ?)",
        [tenantId, customerName, String(phone || "").trim() || null]
    );

    const rows = await query(
        "SELECT id, name, phone, email, balance FROM customers WHERE id = ? AND user_id = ?",
        [result.insertId, tenantId]
    );

    return { message: "Customer added", customer: rows[0] };
}

async function updateCustomer(tenantId, customerId, { name, phone }) {
    const customerName = String(name || "").trim();

    if (!customerName) {
        throw new ServiceError(400, "Customer name is required");
    }

    const result = await query(
        "UPDATE customers SET name = ?, phone = ? WHERE id = ? AND user_id = ?",
        [customerName, String(phone || "").trim() || null, customerId, tenantId]
    );

    if (result.affectedRows === 0) {
        throw new ServiceError(404, "Customer not found");
    }

    const rows = await query(
        "SELECT id, name, phone, email, balance FROM customers WHERE id = ? AND user_id = ?",
        [customerId, tenantId]
    );

    return { message: "Customer updated", customer: rows[0] };
}

async function payCustomer(tenantId, customerId, amount) {
    const payAmount = toMoney(amount);

    if (payAmount <= 0) {
        throw new ServiceError(400, "Payment amount is required");
    }

    await withTransaction(async () => {
        const rows = await query(
            "SELECT id, balance FROM customers WHERE id = ? AND user_id = ? FOR UPDATE",
            [customerId, tenantId]
        );

        if (rows.length === 0) {
            throw new ServiceError(404, "Customer not found");
        }

        let remaining = payAmount;
        const sales = await query(
            `
            SELECT id, total_amount, paid_amount
            FROM sales
            WHERE user_id = ? AND customer_id = ? AND paid_amount < total_amount
            ORDER BY created_at ASC, id ASC
            FOR UPDATE
            `,
            [tenantId, customerId]
        );

        for (const sale of sales) {
            if (remaining <= 0) {
                break;
            }

            const due = toMoney(toMoney(sale.total_amount) - toMoney(sale.paid_amount));
            const apply = toMoney(Math.min(remaining, due));

            if (apply <= 0) {
                continue;
            }

            await query(
                "UPDATE sales SET paid_amount = paid_amount + ? WHERE id = ? AND user_id = ?",
                [apply, sale.id, tenantId]
            );
            remaining = toMoney(remaining - apply);
        }

        const nextBalance = Math.max(0, toMoney(rows[0].balance) - payAmount);

        await query(
            "UPDATE customers SET balance = ? WHERE id = ? AND user_id = ?",
            [nextBalance, customerId, tenantId]
        );

        if (nextBalance <= 0) {
            await query(
                `
                UPDATE sales
                SET paid_amount = total_amount
                WHERE user_id = ? AND customer_id = ? AND paid_amount < total_amount
                `,
                [tenantId, customerId]
            );
        }
    });

    const updated = await query(
        "SELECT id, name, phone, email, balance FROM customers WHERE id = ? AND user_id = ?",
        [customerId, tenantId]
    );

    return { message: "Payment recorded", customer: updated[0] };
}

async function deleteCustomer(tenantId, customerId) {
    await withTransaction(async () => {
        const rows = await query(
            "SELECT id, balance FROM customers WHERE id = ? AND user_id = ? FOR UPDATE",
            [customerId, tenantId]
        );

        if (rows.length === 0) {
            throw new ServiceError(404, "Customer not found");
        }

        if (toMoney(rows[0].balance) > 0) {
            throw new ServiceError(
                400,
                "Pay remaining udhaar before deleting this customer"
            );
        }

        await query(
            "UPDATE sales SET customer_id = NULL WHERE customer_id = ? AND user_id = ?",
            [customerId, tenantId]
        );

        const result = await query(
            "DELETE FROM customers WHERE id = ? AND user_id = ?",
            [customerId, tenantId]
        );

        if (result.affectedRows === 0) {
            throw new ServiceError(404, "Customer not found");
        }
    });

    return { message: "Customer deleted" };
}

module.exports = {
    listCustomers,
    addCustomer,
    updateCustomer,
    payCustomer,
    deleteCustomer,
    settleClearedCustomers
};
