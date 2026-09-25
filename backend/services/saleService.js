const { query, withTransaction } = require("../utils/query");
const { toNumber, toMoney } = require("../utils/http");
const { parseListOptions, like } = require("../utils/list");
const { ServiceError } = require("../utils/errors");
const { recordMovement, applyVariantDelta } = require("./stockService");
const { getProduct } = require("./productService");

async function getSaleItems(saleId) {
    return query(
        `
        SELECT
            sale_items.id,
            sale_items.product_id,
            products.name AS product,
            sale_items.quantity,
            sale_items.unit_price,
            sale_items.unit_cost,
            sale_items.total_amount,
            sale_items.cost_amount,
            sale_items.color,
            sale_items.size
        FROM sale_items
        INNER JOIN products ON products.id = sale_items.product_id
        WHERE sale_items.sale_id = ?
        ORDER BY sale_items.id
        `,
        [saleId]
    );
}

function summarizeItems(items) {
    const names = items.map((item) => item.product).filter(Boolean);
    const quantity = items.reduce((sum, item) => sum + toNumber(item.quantity), 0);

    return {
        product: names.join(", ") || "Sale",
        product_id: items[0] ? items[0].product_id : 0,
        quantity
    };
}

async function getSale(tenantId, saleId) {
    const results = await query(
        `
        SELECT
            sales.id,
            sales.customer_id,
            customers.name AS customer,
            sales.total_amount,
            sales.cost_amount,
            sales.paid_amount,
            sales.created_at
        FROM sales
        LEFT JOIN customers ON customers.id = sales.customer_id
        WHERE sales.id = ? AND sales.user_id = ?
        `,
        [saleId, tenantId]
    );

    if (results.length === 0) {
        throw new ServiceError(404, "Sale not found");
    }

    const items = await getSaleItems(saleId);
    const summary = summarizeItems(items);

    return {
        ...results[0],
        ...summary,
        due_amount: toMoney(toMoney(results[0].total_amount) - toMoney(results[0].paid_amount)),
        items
    };
}

async function listSales(tenantId, options = {}) {
    const { search, limitSql, dateFrom, dateTo } = parseListOptions(options);
    const params = [tenantId];
    let where = "WHERE sales.user_id = ?";

    if (search) {
        where += ` AND (
            IFNULL(customers.name, '') LIKE ?
            OR CAST(sales.id AS CHAR) LIKE ?
            OR EXISTS (
                SELECT 1
                FROM sale_items
                INNER JOIN products ON products.id = sale_items.product_id
                WHERE sale_items.sale_id = sales.id
                    AND products.name LIKE ?
            )
        )`;
        params.push(like(search), like(search), like(search));
    }

    if (dateFrom) {
        where += " AND DATE(sales.created_at) >= ?";
        params.push(dateFrom);
    }

    if (dateTo) {
        where += " AND DATE(sales.created_at) <= ?";
        params.push(dateTo);
    }

    const from = `
        FROM sales
        LEFT JOIN customers ON customers.id = sales.customer_id
        ${where}
    `;
    const countRows = await query(`SELECT COUNT(*) AS n ${from}`, params);
    const sales = await query(
        `
        SELECT
            sales.id,
            sales.customer_id,
            customers.name AS customer,
            sales.total_amount,
            sales.cost_amount,
            sales.paid_amount,
            sales.created_at
        ${from}
        ORDER BY sales.id DESC
        ${limitSql}
        `,
        params
    );

    const withItems = [];

    for (const sale of sales) {
        const items = await getSaleItems(sale.id);
        const summary = summarizeItems(items);
        withItems.push({
            ...sale,
            ...summary,
            due_amount: toMoney(toMoney(sale.total_amount) - toMoney(sale.paid_amount)),
            items
        });
    }

    return { rows: withItems, total: Number(countRows[0].n) };
}

async function getOwnedProduct(tenantId, productId) {
    const results = await query(
        "SELECT id, name, price, cost_price, stock FROM products WHERE id = ? AND user_id = ? FOR UPDATE",
        [productId, tenantId]
    );

    if (results.length === 0) {
        throw new ServiceError(404, "Product not found");
    }

    return results[0];
}

function snapshotFromProduct(product, quantity) {
    const unitPrice = toMoney(product.price);
    const unitCost = toMoney(product.cost_price);
    const saleQuantity = toNumber(quantity);

    return {
        unitPrice,
        unitCost,
        totalAmount: toMoney(unitPrice * saleQuantity),
        costAmount: toMoney(unitCost * saleQuantity)
    };
}

function readItems(data) {
    if (Array.isArray(data.items) && data.items.length > 0) {
        return data.items;
    }

    if (data.product_id) {
        return [{ product_id: data.product_id, quantity: data.quantity }];
    }

    return [];
}

async function applyItems(tenantId, actorId, saleId, rawItems, note) {
    let totalAmount = 0;
    let costAmount = 0;
    let firstProduct = null;

    for (const raw of rawItems) {
        const productId = toNumber(raw.product_id);
        const quantity = toNumber(raw.quantity);
        const colorName = String(raw.color || "").trim();
        const sizeName = String(raw.size || "").trim();

        if (!productId || quantity <= 0) {
            throw new ServiceError(400, "Each line needs a product and quantity");
        }

        const product = await getOwnedProduct(tenantId, productId);
        await applyVariantDelta(productId, colorName, sizeName, -quantity, product.name);

        const snapshot = snapshotFromProduct(product, quantity);
        totalAmount = toMoney(totalAmount + snapshot.totalAmount);
        costAmount = toMoney(costAmount + snapshot.costAmount);

        await query(
            `
            INSERT INTO sale_items
                (sale_id, product_id, quantity, unit_price, unit_cost, total_amount, cost_amount, color, size)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                saleId,
                productId,
                quantity,
                snapshot.unitPrice,
                snapshot.unitCost,
                snapshot.totalAmount,
                snapshot.costAmount,
                colorName,
                sizeName
            ]
        );

        await recordMovement(
            tenantId,
            actorId,
            productId,
            "sale",
            quantity,
            `${note} ${product.name}`,
            null,
            colorName,
            sizeName
        );

        if (!firstProduct) {
            firstProduct = {
                productId,
                quantity,
                snapshot
            };
        }
    }

    return { totalAmount, costAmount, firstProduct };
}

async function restoreItems(tenantId, actorId, saleId, note) {
    const items = await query(
        "SELECT product_id, quantity, color, size FROM sale_items WHERE sale_id = ?",
        [saleId]
    );

    for (const item of items) {
        const products = await query("SELECT name FROM products WHERE id = ?", [item.product_id]);
        await applyVariantDelta(
            item.product_id,
            item.color,
            item.size,
            item.quantity,
            products[0] ? products[0].name : ""
        );

        await recordMovement(
            tenantId,
            actorId,
            item.product_id,
            "sale_return",
            item.quantity,
            note,
            null,
            item.color,
            item.size
        );
    }

    await query("DELETE FROM sale_items WHERE sale_id = ?", [saleId]);
}

async function shiftCustomerBalance(tenantId, customerId, delta) {
    if (!customerId || !delta) {
        return;
    }

    const rows = await query(
        "SELECT id FROM customers WHERE id = ? AND user_id = ? FOR UPDATE",
        [customerId, tenantId]
    );

    if (rows.length === 0) {
        throw new ServiceError(404, "Customer not found");
    }

    await query(
        "UPDATE customers SET balance = GREATEST(0, balance + ?) WHERE id = ? AND user_id = ?",
        [delta, customerId, tenantId]
    );
}

async function addSale(tenantId, data, actorId = tenantId) {
    const items = readItems(data);

    if (items.length === 0) {
        throw new ServiceError(400, "Add at least one product");
    }

    const customerId = toNumber(data.customer_id) || null;
    let saleId = 0;
    const touched = new Set();

    await withTransaction(async () => {
        const insertResult = await query(
            `
            INSERT INTO sales
                (user_id, product_id, customer_id, quantity, unit_price, unit_cost, total_amount, cost_amount, paid_amount)
            VALUES (?, NULL, ?, 0, 0, 0, 0, 0, 0)
            `,
            [tenantId, customerId]
        );

        saleId = insertResult.insertId;
        const applied = await applyItems(
            tenantId,
            actorId,
            saleId,
            items,
            `Sale #${saleId}`
        );

        const paidAmount =
            data.paid_amount === undefined || data.paid_amount === null || data.paid_amount === ""
                ? applied.totalAmount
                : toMoney(data.paid_amount);

        if (paidAmount < 0 || paidAmount > applied.totalAmount) {
            throw new ServiceError(400, "Paid amount is invalid");
        }

        const due = toMoney(applied.totalAmount - paidAmount);

        if (due > 0 && !customerId) {
            throw new ServiceError(400, "Choose a customer for udhaar");
        }

        const first = applied.firstProduct;

        await query(
            `
            UPDATE sales
            SET product_id = NULL, quantity = ?, unit_price = ?, unit_cost = ?, total_amount = ?, cost_amount = ?, paid_amount = ?
            WHERE id = ? AND user_id = ?
            `,
            [
                first.quantity,
                first.snapshot.unitPrice,
                first.snapshot.unitCost,
                applied.totalAmount,
                applied.costAmount,
                paidAmount,
                saleId,
                tenantId
            ]
        );

        await shiftCustomerBalance(tenantId, customerId, due);

        for (const item of items) {
            touched.add(toNumber(item.product_id));
        }
    });

    const products = [];

    for (const productId of touched) {
        products.push(await getProduct(tenantId, productId));
    }

    return {
        message: "Sale added",
        sale: await getSale(tenantId, saleId),
        product: products[0],
        products
    };
}

async function updateSale(tenantId, saleId, data, actorId = tenantId) {
    const items = readItems(data);
    const hasItems = items.length > 0;
    const hasDate = Boolean(data.created_at);
    const hasPaid = data.paid_amount !== undefined && data.paid_amount !== null && data.paid_amount !== "";
    const hasCustomer =
        data.customer_id !== undefined && data.customer_id !== null && data.customer_id !== "";

    if (!hasItems && !hasDate && !hasPaid && !hasCustomer) {
        throw new ServiceError(400, "Nothing to update");
    }

    const touched = new Set();

    await withTransaction(async () => {
        const sales = await query(
            "SELECT id, customer_id, total_amount, paid_amount FROM sales WHERE id = ? AND user_id = ? FOR UPDATE",
            [saleId, tenantId]
        );

        if (sales.length === 0) {
            throw new ServiceError(404, "Sale not found");
        }

        const current = sales[0];
        const oldDue = toMoney(toMoney(current.total_amount) - toMoney(current.paid_amount));
        await shiftCustomerBalance(tenantId, current.customer_id, -oldDue);

        if (hasItems) {
            const oldItems = await query(
                "SELECT product_id FROM sale_items WHERE sale_id = ?",
                [saleId]
            );
            oldItems.forEach((item) => touched.add(toNumber(item.product_id)));
            await restoreItems(tenantId, actorId, saleId, `Sale #${saleId} updated`);
            const applied = await applyItems(
                tenantId,
                actorId,
                saleId,
                items,
                `Sale #${saleId}`
            );
            const first = applied.firstProduct;
            const customerId = hasCustomer ? toNumber(data.customer_id) || null : current.customer_id;
            const paidAmount = hasPaid ? toMoney(data.paid_amount) : applied.totalAmount;

            if (paidAmount < 0 || paidAmount > applied.totalAmount) {
                throw new ServiceError(400, "Paid amount is invalid");
            }

            const due = toMoney(applied.totalAmount - paidAmount);

            if (due > 0 && !customerId) {
                throw new ServiceError(400, "Choose a customer for udhaar");
            }

            await query(
                `
                UPDATE sales
                SET product_id = NULL, customer_id = ?, quantity = ?, unit_price = ?, unit_cost = ?, total_amount = ?, cost_amount = ?, paid_amount = ?
                WHERE id = ? AND user_id = ?
                `,
                [
                    customerId,
                    first.quantity,
                    first.snapshot.unitPrice,
                    first.snapshot.unitCost,
                    applied.totalAmount,
                    applied.costAmount,
                    paidAmount,
                    saleId,
                    tenantId
                ]
            );

            await shiftCustomerBalance(tenantId, customerId, due);
            items.forEach((item) => touched.add(toNumber(item.product_id)));
        } else {
            const fields = [];
            const params = [];
            const customerId = hasCustomer ? toNumber(data.customer_id) || null : current.customer_id;
            const paidAmount = hasPaid ? toMoney(data.paid_amount) : toMoney(current.paid_amount);

            if (paidAmount < 0 || paidAmount > toMoney(current.total_amount)) {
                throw new ServiceError(400, "Paid amount is invalid");
            }

            const due = toMoney(toMoney(current.total_amount) - paidAmount);

            if (due > 0 && !customerId) {
                throw new ServiceError(400, "Choose a customer for udhaar");
            }

            fields.push("customer_id = ?", "paid_amount = ?");
            params.push(customerId, paidAmount);

            if (hasDate) {
                const dateValue = String(data.created_at).trim();

                if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
                    throw new ServiceError(400, "Date is required");
                }

                fields.push("created_at = ?");
                params.push(dateValue);
            }

            params.push(saleId, tenantId);
            await query(
                `UPDATE sales SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`,
                params
            );
            await shiftCustomerBalance(tenantId, customerId, due);
        }
    });

    const sale = await getSale(tenantId, saleId);
    const products = [];

    for (const productId of touched) {
        products.push(await getProduct(tenantId, productId));
    }

    return {
        message: "Sale updated",
        sale,
        product: products[0],
        products,
        previous_product: products[1]
    };
}

async function deleteSale(tenantId, saleId, actorId = tenantId) {
    const touched = new Set();

    await withTransaction(async () => {
        const sales = await query(
            "SELECT id, customer_id, total_amount, paid_amount FROM sales WHERE id = ? AND user_id = ? FOR UPDATE",
            [saleId, tenantId]
        );

        if (sales.length === 0) {
            throw new ServiceError(404, "Sale not found");
        }

        const current = sales[0];
        const items = await query(
            "SELECT product_id FROM sale_items WHERE sale_id = ?",
            [saleId]
        );
        items.forEach((item) => touched.add(toNumber(item.product_id)));

        const due = toMoney(toMoney(current.total_amount) - toMoney(current.paid_amount));
        await shiftCustomerBalance(tenantId, current.customer_id, -due);
        await restoreItems(tenantId, actorId, saleId, `Sale #${saleId} deleted`);
        await query("DELETE FROM sales WHERE id = ? AND user_id = ?", [
            saleId,
            tenantId
        ]);
    });

    const products = [];

    for (const productId of touched) {
        products.push(await getProduct(tenantId, productId));
    }

    return {
        message: "Sale deleted",
        product: products[0],
        products
    };
}

module.exports = {
    listSales,
    addSale,
    updateSale,
    deleteSale,
    getSale
};
