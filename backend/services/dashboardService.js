const { query } = require("../utils/query");
const { toNumber, toMoney } = require("../utils/http");
const { getSettings } = require("./settingsService");
const { settleClearedCustomers } = require("./customerService");

function periodClause(column, period) {
    if (period === "today") {
        return `${column} >= CURDATE() AND ${column} < CURDATE() + INTERVAL 1 DAY`;
    }

    if (period === "week") {
        return `${column} >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)`;
    }

    if (period === "all") {
        return "1 = 1";
    }

    return `${column} >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`;
}

function normalizePeriod(period) {
    if (["today", "week", "month", "all"].includes(period)) {
        return period;
    }

    return "month";
}

async function getStats(tenantId, period = "month") {
    const selectedPeriod = normalizePeriod(period);
    const salesFilter = `user_id = ? AND ${periodClause("created_at", selectedPeriod)}`;
    const settings = await getSettings(tenantId);
    const lowStockLimit = settings.low_stock_threshold || 3;
    await settleClearedCustomers(tenantId);

    const [counts, money, expenses, outstanding, debtors, lowStock, missingCost, pendingOrders, platformFees] =
        await Promise.all([
        query(
            `
            SELECT
                (SELECT COUNT(*) FROM products WHERE user_id = ?) AS totalProducts,
                (SELECT COALESCE(SUM(stock), 0) FROM products WHERE user_id = ?) AS totalStock
            `,
            [tenantId, tenantId]
        ),
        query(
            `
            SELECT
                COALESCE(SUM(total_amount), 0) AS billed,
                COALESCE(SUM(LEAST(paid_amount, total_amount)), 0) AS collected,
                COALESCE(SUM(cost_amount), 0) AS cost
            FROM sales
            WHERE ${salesFilter}
                AND (
                    NOT EXISTS (
                        SELECT 1 FROM shop_orders WHERE shop_orders.sale_id = sales.id
                    )
                    OR EXISTS (
                        SELECT 1
                        FROM shop_orders
                        WHERE shop_orders.sale_id = sales.id
                          AND shop_orders.delivery_status = 'delivered'
                    )
                )
            `,
            [tenantId]
        ),
        query(
            `
            SELECT COALESCE(SUM(amount), 0) AS expenses
            FROM expenses
            WHERE ${salesFilter}
            `,
            [tenantId]
        ),
        query(
            `
            SELECT COALESCE(SUM(balance), 0) AS udhaar
            FROM customers
            WHERE user_id = ?
            `,
            [tenantId]
        ),
        query(
            `
            SELECT id, name, balance
            FROM customers
            WHERE user_id = ? AND balance > 0
            ORDER BY balance DESC, name ASC
            `,
            [tenantId]
        ),
        query(
            `
            SELECT products.id, products.name, products.stock
            FROM products
            WHERE products.user_id = ?
                AND (
                    products.stock / NULLIF(products.units_per_sale_unit, 0) < ?
                    OR EXISTS (
                        SELECT 1
                        FROM product_variants
                        WHERE product_variants.product_id = products.id
                            AND product_variants.stock / NULLIF(products.units_per_sale_unit, 0) < ?
                    )
                )
            ORDER BY products.stock ASC, products.name ASC
            `,
            [tenantId, lowStockLimit, lowStockLimit]
        ),
        query(
            `
            SELECT id, name, cost_price
            FROM products
            WHERE user_id = ? AND cost_price <= 0
            ORDER BY name ASC
            `,
            [tenantId]
        ),
        query(
            `
            SELECT COUNT(*) AS n
            FROM shop_orders
            WHERE user_id = ?
                AND delivery_status IN ('pending', 'processing', 'dispatched')
            `,
            [tenantId]
        ),
        query(
            `
            SELECT COALESCE(SUM(
                CASE
                    WHEN ledger.entry_type = 'due' THEN ledger.amount
                    WHEN ledger.entry_type = 'reversal' THEN -ledger.amount
                    ELSE 0
                END
            ), 0) AS platform_fee
            FROM platform_commission_ledger ledger
            INNER JOIN stores ON stores.id = ledger.store_id
            WHERE stores.tenant_user_id = ?
                AND ledger.entry_type IN ('due', 'reversal')
                AND ${periodClause("ledger.created_at", selectedPeriod)}
            `,
            [tenantId]
        )
    ]);

    const billed = toMoney(money[0].billed);
    const collected = toMoney(money[0].collected);
    const cost = toMoney(money[0].cost);
    const udhaar = toMoney(outstanding[0].udhaar);
    const expenseTotal = toMoney(expenses[0].expenses);
    const platformFeeTotal = toMoney(platformFees[0].platform_fee);
    const profit = toMoney(billed - cost);

    return {
        totalProducts: toNumber(counts[0].totalProducts),
        totalStock: toNumber(counts[0].totalStock),
        billed,
        collected,
        revenue: billed,
        cost,
        udhaar,
        expenses: expenseTotal,
        profit,
        netProfit: toMoney(profit - expenseTotal - platformFeeTotal),
        totalSales: billed,
        debtors: debtors.map((row) => ({
            id: row.id,
            name: row.name,
            balance: toMoney(row.balance)
        })),
        lowStockCount: lowStock.length,
        lowStock,
        missingCostCount: missingCost.length,
        missingCost,
        shopName: settings.shop_name,
        lowStockThreshold: lowStockLimit,
        pendingOnlineOrders: toNumber(pendingOrders[0].n),
        period: selectedPeriod
    };
}

module.exports = { getStats, periodClause, normalizePeriod };
