const { query, withTransaction } = require("../utils/query");
const { toMoney, toNumber } = require("../utils/http");
const { parseListOptions, like } = require("../utils/list");
const { ServiceError } = require("../utils/errors");

function balanceSql() {
    return `
        COALESCE(SUM(
            CASE
                WHEN entry_type = 'due' THEN amount
                WHEN entry_type IN ('received', 'reversal') THEN -amount
                ELSE 0
            END
        ), 0)
    `;
}

function mapEntry(row) {
    return {
        id: Number(row.id),
        store_id: Number(row.store_id),
        store_name: row.store_name,
        shop_slug: row.shop_slug,
        shop_order_id: row.shop_order_id == null ? null : Number(row.shop_order_id),
        sale_id: row.sale_id == null ? null : Number(row.sale_id),
        entry_type: row.entry_type,
        amount: toMoney(row.amount),
        note: row.note || "",
        created_by: row.created_by || null,
        created_at: row.created_at
    };
}

async function getCommissionLedgerSummary(options = {}) {
    const { storeId } = parseListOptions(options);
    const where = storeId ? "WHERE store_id = ?" : "";
    const params = storeId ? [storeId] : [];
    const rows = await query(
        `
        SELECT
            COALESCE(SUM(CASE WHEN entry_type = 'due' THEN amount ELSE 0 END), 0) AS due,
            COALESCE(SUM(CASE WHEN entry_type = 'received' THEN amount ELSE 0 END), 0) AS received,
            COALESCE(SUM(CASE WHEN entry_type = 'reversal' THEN amount ELSE 0 END), 0) AS reversed,
            ${balanceSql()} AS outstanding
        FROM platform_commission_ledger
        ${where}
        `,
        params
    );

    return {
        due: toMoney(rows[0].due),
        received: toMoney(rows[0].received),
        reversed: toMoney(rows[0].reversed),
        outstanding: toMoney(rows[0].outstanding)
    };
}

async function listCommissionLedger(options = {}) {
    const { search, limitSql, storeId } = parseListOptions(options);
    const params = [];
    let where = "WHERE 1 = 1";

    if (storeId) {
        where += " AND ledger.store_id = ?";
        params.push(storeId);
    }

    if (search) {
        where += ` AND (
            stores.name LIKE ?
            OR stores.shop_slug LIKE ?
            OR ledger.note LIKE ?
            OR CAST(COALESCE(ledger.sale_id, shop_orders.sale_id) AS CHAR) LIKE ?
        )`;
        params.push(like(search), like(search), like(search), like(search));
    }

    const from = `
        FROM platform_commission_ledger ledger
        INNER JOIN stores ON stores.id = ledger.store_id
        LEFT JOIN shop_orders ON shop_orders.id = ledger.shop_order_id
        LEFT JOIN sales ON sales.id = shop_orders.sale_id
        LEFT JOIN users created_by ON created_by.id = ledger.created_by_user_id
        ${where}
    `;
    const countRows = await query(`SELECT COUNT(*) AS n ${from}`, params);
    const rows = await query(
        `
        SELECT
            ledger.*,
            stores.name AS store_name,
            stores.shop_slug,
            COALESCE(ledger.sale_id, shop_orders.sale_id) AS sale_id,
            created_by.name AS created_by
        ${from}
        ORDER BY ledger.created_at DESC, ledger.id DESC
        ${limitSql}
        `,
        params
    );

    return { rows: rows.map(mapEntry), total: toNumber(countRows[0].n) };
}

async function resolveStoreId(tenantUserId) {
    const stores = await query("SELECT id FROM stores WHERE tenant_user_id = ? LIMIT 1", [tenantUserId]);

    if (stores.length === 0) {
        throw new ServiceError(404, "Store not found for this order");
    }

    return Number(stores[0].id);
}

async function getTenantStore(tenantUserId) {
    const stores = await query(
        `
        SELECT id, name, commission_percent
        FROM stores
        WHERE tenant_user_id = ?
        LIMIT 1
        `,
        [tenantUserId]
    );

    return stores[0] || null;
}

async function getStoreCommissionSummary(tenantUserId) {
    const store = await getTenantStore(tenantUserId);

    if (!store) {
        return {
            store_id: null,
            store_name: "",
            commission_percent: 0,
            due: 0,
            received: 0,
            reversed: 0,
            outstanding: 0
        };
    }

    return {
        store_id: Number(store.id),
        store_name: store.name,
        commission_percent: Number(store.commission_percent || 0),
        ...(await getCommissionLedgerSummary({ storeId: store.id }))
    };
}

async function listStoreCommissionLedger(tenantUserId, options = {}) {
    const store = await getTenantStore(tenantUserId);

    if (!store) {
        return { rows: [], total: 0 };
    }

    return listCommissionLedger({ ...options, storeId: Number(store.id) });
}

async function accrueCommissionDue(order) {
    const fee = toMoney(order.platform_fee);

    if (order.delivery_status !== "delivered" || order.payment_status !== "collected" || fee <= 0) {
        return;
    }

    const storeId = await resolveStoreId(order.user_id);
    await query(
        `
        INSERT INTO platform_commission_ledger (
            store_id, shop_order_id, sale_id, entry_type, amount, note
        ) VALUES (?, ?, ?, 'due', ?, 'Delivered and paid order')
        ON DUPLICATE KEY UPDATE id = id
        `,
        [storeId, order.id, order.sale_id || null, fee]
    );
}

async function reverseCommissionDue(order) {
    const dueRows = await query(
        `
        SELECT store_id, sale_id, amount
        FROM platform_commission_ledger
        WHERE shop_order_id = ? AND entry_type = 'due'
        FOR UPDATE
        `,
        [order.id]
    );

    if (dueRows.length === 0) {
        return;
    }

    await query(
        `
        INSERT INTO platform_commission_ledger (
            store_id, shop_order_id, sale_id, entry_type, amount, note
        ) VALUES (?, ?, ?, 'reversal', ?, 'Order cancelled')
        ON DUPLICATE KEY UPDATE id = id
        `,
        [
            dueRows[0].store_id,
            order.id,
            dueRows[0].sale_id || order.sale_id || null,
            toMoney(dueRows[0].amount)
        ]
    );
}

async function recordCommissionSettlement(data, recordedByUserId) {
    const storeId = Math.max(0, Number(data.store_id) || 0);
    const rawAmount = Number(data.amount);
    const amount = toMoney(rawAmount);
    const note = String(data.note || "").trim().slice(0, 200);

    if (!storeId) {
        throw new ServiceError(400, "Choose a store");
    }

    if (!Number.isFinite(rawAmount) || amount <= 0) {
        throw new ServiceError(400, "Enter a valid settlement amount");
    }

    return withTransaction(async () => {
        const stores = await query("SELECT id FROM stores WHERE id = ? FOR UPDATE", [storeId]);

        if (stores.length === 0) {
            throw new ServiceError(404, "Store not found");
        }

        await query(
            "SELECT id FROM platform_commission_ledger WHERE store_id = ? FOR UPDATE",
            [storeId]
        );
        const balanceRows = await query(
            `SELECT ${balanceSql()} AS outstanding
             FROM platform_commission_ledger
             WHERE store_id = ?`,
            [storeId]
        );
        const outstanding = toMoney(balanceRows[0].outstanding);

        if (outstanding <= 0) {
            throw new ServiceError(400, "This store has no commission outstanding");
        }

        if (amount > outstanding) {
            throw new ServiceError(400, `Settlement cannot exceed the outstanding amount of ${outstanding}`);
        }

        const result = await query(
            `
            INSERT INTO platform_commission_ledger (
                store_id, entry_type, amount, note, created_by_user_id
            ) VALUES (?, 'received', ?, ?, ?)
            `,
            [storeId, amount, note || null, recordedByUserId]
        );
        const entries = await query(
            `
            SELECT
                ledger.*,
                stores.name AS store_name,
                stores.shop_slug,
                ledger.sale_id,
                users.name AS created_by
            FROM platform_commission_ledger ledger
            INNER JOIN stores ON stores.id = ledger.store_id
            LEFT JOIN users ON users.id = ledger.created_by_user_id
            WHERE ledger.id = ?
            `,
            [result.insertId]
        );

        return { message: "Commission payment recorded", entry: mapEntry(entries[0]) };
    });
}

module.exports = {
    accrueCommissionDue,
    reverseCommissionDue,
    getCommissionLedgerSummary,
    getStoreCommissionSummary,
    listCommissionLedger,
    listStoreCommissionLedger,
    recordCommissionSettlement
};
