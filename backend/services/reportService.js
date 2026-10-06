const { query } = require("../utils/query");
const { toMoney, toNumber } = require("../utils/http");
const { ServiceError } = require("../utils/errors");
const { getSettings } = require("./settingsService");
const {
    getCommissionLedgerSummary,
    getStoreCommissionSummary
} = require("./commissionLedgerService");

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizeRange(options = {}) {
    const dateFrom = DATE_PATTERN.test(String(options.dateFrom || ""))
        ? String(options.dateFrom)
        : "";
    const dateTo = DATE_PATTERN.test(String(options.dateTo || ""))
        ? String(options.dateTo)
        : "";

    if (dateFrom && dateTo && dateFrom > dateTo) {
        throw new ServiceError(400, "Start date cannot be after end date");
    }

    return { dateFrom, dateTo };
}

function dateFilter(column, range) {
    const clauses = [];
    const params = [];

    if (range.dateFrom) {
        clauses.push(`DATE(${column}) >= ?`);
        params.push(range.dateFrom);
    }

    if (range.dateTo) {
        clauses.push(`DATE(${column}) <= ?`);
        params.push(range.dateTo);
    }

    return {
        sql: clauses.length > 0 ? ` AND ${clauses.join(" AND ")}` : "",
        params
    };
}

function recognizedSaleCondition(alias = "sales") {
    return `
        AND (
            NOT EXISTS (SELECT 1 FROM shop_orders report_orders WHERE report_orders.sale_id = ${alias}.id)
            OR EXISTS (
                SELECT 1
                FROM shop_orders report_orders
                WHERE report_orders.sale_id = ${alias}.id
                  AND report_orders.delivery_status = 'delivered'
            )
        )
    `;
}

function marginPercent(revenue, profit) {
    const amount = toMoney(revenue);
    return amount > 0 ? Math.round((toMoney(profit) / amount) * 10000) / 100 : 0;
}

function mapVariants(rows) {
    const variants = new Map();

    rows.forEach((row) => {
        const productId = Number(row.product_id);
        const current = variants.get(productId) || [];
        current.push({
            color: row.color || "",
            size: row.size || "",
            stock: toNumber(row.stock)
        });
        variants.set(productId, current);
    });

    return variants;
}

async function getStoreReport(tenantId, options = {}) {
    const range = normalizeRange(options);
    const salesDate = dateFilter("sales.created_at", range);
    const movementDate = dateFilter("stock_movements.created_at", range);
    const orderDate = dateFilter("shop_orders.created_at", range);
    const ledgerDate = dateFilter("ledger.created_at", range);

    const [
        settings,
        currentCommission,
        financialRows,
        unitRows,
        trendRows,
        productRows,
        inventoryRows,
        variantRows,
        customerRows,
        expenseRows,
        commissionRows,
        operationRows,
        posRows
    ] = await Promise.all([
        getSettings(tenantId),
        getStoreCommissionSummary(tenantId),
        query(
            `
            SELECT
                COUNT(sales.id) AS orders,
                COALESCE(SUM(sales.total_amount), 0) AS billed,
                COALESCE(SUM(LEAST(sales.paid_amount, sales.total_amount)), 0) AS collected,
                COALESCE(SUM(sales.cost_amount), 0) AS cost
            FROM sales
            WHERE sales.user_id = ?
              ${salesDate.sql}
              ${recognizedSaleCondition("sales")}
            `,
            [tenantId, ...salesDate.params]
        ),
        query(
            `
            SELECT COALESCE(SUM(sale_items.quantity), 0) AS units_sold
            FROM sale_items
            INNER JOIN sales ON sales.id = sale_items.sale_id
            WHERE sales.user_id = ?
              ${salesDate.sql}
              ${recognizedSaleCondition("sales")}
            `,
            [tenantId, ...salesDate.params]
        ),
        query(
            `
            SELECT
                DATE(sales.created_at) AS report_date,
                COUNT(sales.id) AS orders,
                COALESCE(SUM(sales.total_amount), 0) AS sales,
                COALESCE(SUM(sales.cost_amount), 0) AS cost
            FROM sales
            WHERE sales.user_id = ?
              ${salesDate.sql}
              ${recognizedSaleCondition("sales")}
            GROUP BY DATE(sales.created_at)
            ORDER BY report_date ASC
            `,
            [tenantId, ...salesDate.params]
        ),
        query(
            `
            SELECT
                products.id,
                products.name,
                products.sku,
                products.category,
                products.inventory_type,
                products.base_unit,
                products.sale_unit,
                products.units_per_sale_unit,
                products.stock,
                COALESCE(performance.quantity_sold, 0) AS quantity_sold,
                COALESCE(performance.revenue, 0) AS revenue,
                COALESCE(performance.cost, 0) AS cost,
                performance.last_sale_at
            FROM products
            LEFT JOIN (
                SELECT
                    sale_items.product_id,
                    SUM(sale_items.quantity) AS quantity_sold,
                    SUM(sale_items.total_amount) AS revenue,
                    SUM(sale_items.cost_amount) AS cost,
                    MAX(sales.created_at) AS last_sale_at
                FROM sale_items
                INNER JOIN sales ON sales.id = sale_items.sale_id
                WHERE sales.user_id = ?
                  ${salesDate.sql}
                  ${recognizedSaleCondition("sales")}
                GROUP BY sale_items.product_id
            ) performance ON performance.product_id = products.id
            WHERE products.user_id = ?
            ORDER BY revenue DESC, quantity_sold DESC, products.name ASC
            `,
            [tenantId, ...salesDate.params, tenantId]
        ),
        query(
            `
            SELECT
                products.id,
                products.name,
                products.sku,
                products.category,
                products.inventory_type,
                products.base_unit,
                products.sale_unit,
                products.units_per_sale_unit,
                products.stock,
                COALESCE(batches.stock_value, 0) AS stock_value,
                batches.oldest_received_at,
                COALESCE(movements.damage_quantity, 0) AS damage_quantity,
                COALESCE(movements.adjustment_quantity, 0) AS adjustment_quantity
            FROM products
            LEFT JOIN (
                SELECT
                    product_id,
                    SUM(remaining_quantity * unit_cost) AS stock_value,
                    MIN(received_at) AS oldest_received_at
                FROM inventory_batches
                WHERE remaining_quantity > 0
                GROUP BY product_id
            ) batches ON batches.product_id = products.id
            LEFT JOIN (
                SELECT
                    stock_movements.product_id,
                    SUM(CASE WHEN stock_movements.type = 'damage' THEN stock_movements.quantity ELSE 0 END) AS damage_quantity,
                    SUM(CASE WHEN stock_movements.type = 'adjust' THEN stock_movements.quantity ELSE 0 END) AS adjustment_quantity
                FROM stock_movements
                WHERE stock_movements.user_id = ?
                  ${movementDate.sql}
                GROUP BY stock_movements.product_id
            ) movements ON movements.product_id = products.id
            WHERE products.user_id = ?
            ORDER BY products.stock ASC, products.name ASC
            `,
            [tenantId, ...movementDate.params, tenantId]
        ),
        query(
            `
            SELECT product_variants.product_id, product_variants.color, product_variants.size, product_variants.stock
            FROM product_variants
            INNER JOIN products ON products.id = product_variants.product_id
            WHERE products.user_id = ?
            ORDER BY product_variants.product_id, product_variants.id
            `,
            [tenantId]
        ),
        query(
            `
            SELECT
                customers.id,
                customers.name,
                customers.phone,
                customers.email,
                customers.balance,
                COUNT(sales.id) AS orders,
                COALESCE(SUM(sales.total_amount), 0) AS revenue,
                COALESCE(SUM(LEAST(sales.paid_amount, sales.total_amount)), 0) AS paid,
                MAX(sales.created_at) AS last_purchase_at
            FROM customers
            LEFT JOIN sales
              ON sales.customer_id = customers.id
             AND sales.user_id = ?
             ${salesDate.sql}
             ${recognizedSaleCondition("sales")}
            WHERE customers.user_id = ?
            GROUP BY customers.id, customers.name, customers.phone, customers.email, customers.balance
            ORDER BY revenue DESC, customers.balance DESC, customers.name ASC
            `,
            [tenantId, ...salesDate.params, tenantId]
        ),
        query(
            `
            SELECT COALESCE(SUM(expenses.amount), 0) AS expenses
            FROM expenses
            WHERE expenses.user_id = ?
              ${dateFilter("expenses.created_at", range).sql}
            `,
            [tenantId, ...dateFilter("expenses.created_at", range).params]
        ),
        query(
            `
            SELECT
                COALESCE(SUM(CASE WHEN ledger.entry_type = 'due' THEN ledger.amount ELSE 0 END), 0) AS due,
                COALESCE(SUM(CASE WHEN ledger.entry_type = 'received' THEN ledger.amount ELSE 0 END), 0) AS received,
                COALESCE(SUM(CASE WHEN ledger.entry_type = 'reversal' THEN ledger.amount ELSE 0 END), 0) AS reversed
            FROM platform_commission_ledger ledger
            INNER JOIN stores ON stores.id = ledger.store_id
            WHERE stores.tenant_user_id = ?
              ${ledgerDate.sql}
            `,
            [tenantId, ...ledgerDate.params]
        ),
        query(
            `
            SELECT
                COUNT(shop_orders.id) AS online_orders,
                SUM(CASE WHEN shop_orders.delivery_status = 'pending' THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN shop_orders.delivery_status = 'processing' THEN 1 ELSE 0 END) AS processing,
                SUM(CASE WHEN shop_orders.delivery_status = 'dispatched' THEN 1 ELSE 0 END) AS dispatched,
                SUM(CASE WHEN shop_orders.delivery_status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
                SUM(CASE WHEN shop_orders.delivery_status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
                SUM(CASE WHEN shop_orders.delivery_by = 'store' THEN 1 ELSE 0 END) AS store_delivery,
                SUM(CASE WHEN shop_orders.delivery_by = 'platform' THEN 1 ELSE 0 END) AS platform_delivery
            FROM shop_orders
            WHERE shop_orders.user_id = ?
              ${orderDate.sql}
            `,
            [tenantId, ...orderDate.params]
        ),
        query(
            `
            SELECT COUNT(sales.id) AS pos_sales
            FROM sales
            WHERE sales.user_id = ?
              ${salesDate.sql}
              AND NOT EXISTS (SELECT 1 FROM shop_orders WHERE shop_orders.sale_id = sales.id)
            `,
            [tenantId, ...salesDate.params]
        )
    ]);

    const variants = mapVariants(variantRows);
    const finances = financialRows[0] || {};
    const billed = toMoney(finances.billed);
    const collected = toMoney(finances.collected);
    const cost = toMoney(finances.cost);
    const grossProfit = toMoney(billed - cost);
    const expenses = toMoney(expenseRows[0]?.expenses);
    const commissionDue = toMoney(commissionRows[0]?.due);
    const commissionReversed = toMoney(commissionRows[0]?.reversed);
    const recognizedCommission = toMoney(commissionDue - commissionReversed);
    const threshold = toNumber(settings.low_stock_threshold) || 3;

    const inventory = inventoryRows.map((row) => {
        const stock = toNumber(row.stock);
        const conversion = toNumber(row.units_per_sale_unit) || 1;
        const saleStock = stock / conversion;
        const status = saleStock <= 0 ? "out" : saleStock < threshold ? "low" : "healthy";

        return {
            product_id: Number(row.id),
            product: row.name,
            sku: row.sku || "",
            category: row.category || "",
            inventory_type: row.inventory_type || "unit",
            base_unit: row.base_unit || "piece",
            sale_unit: row.sale_unit || "piece",
            units_per_sale_unit: conversion,
            stock,
            sale_stock: Math.round(saleStock * 1000) / 1000,
            stock_value: toMoney(row.stock_value),
            oldest_received_at: row.oldest_received_at || null,
            damage_quantity: toNumber(row.damage_quantity),
            adjustment_quantity: toNumber(row.adjustment_quantity),
            status,
            variants: variants.get(Number(row.id)) || []
        };
    });

    const products = productRows.map((row) => {
        const revenue = toMoney(row.revenue);
        const productCost = toMoney(row.cost);
        const profit = toMoney(revenue - productCost);

        return {
            product_id: Number(row.id),
            product: row.name,
            sku: row.sku || "",
            category: row.category || "",
            inventory_type: row.inventory_type || "unit",
            base_unit: row.base_unit || "piece",
            sale_unit: row.sale_unit || "piece",
            units_per_sale_unit: toNumber(row.units_per_sale_unit) || 1,
            stock: toNumber(row.stock),
            quantity_sold: toNumber(row.quantity_sold),
            revenue,
            cost: productCost,
            profit,
            margin_percent: marginPercent(revenue, profit),
            last_sale_at: row.last_sale_at || null,
            variants: variants.get(Number(row.id)) || []
        };
    });

    return {
        range: { from: range.dateFrom, to: range.dateTo },
        summary: {
            orders: toNumber(finances.orders),
            units_sold: toNumber(unitRows[0]?.units_sold),
            billed,
            collected,
            outstanding: toMoney(billed - collected),
            cost,
            gross_profit: grossProfit,
            expenses,
            commission: recognizedCommission,
            net_profit: toMoney(grossProfit - expenses - recognizedCommission),
            inventory_value: toMoney(inventory.reduce((sum, row) => sum + row.stock_value, 0)),
            low_stock: inventory.filter((row) => row.status === "low").length,
            out_of_stock: inventory.filter((row) => row.status === "out").length
        },
        sales_trend: trendRows.map((row) => ({
            date: row.report_date,
            orders: toNumber(row.orders),
            sales: toMoney(row.sales),
            cost: toMoney(row.cost),
            profit: toMoney(toMoney(row.sales) - toMoney(row.cost))
        })),
        products,
        inventory,
        customers: customerRows.map((row) => ({
            customer_id: Number(row.id),
            customer: row.name,
            phone: row.phone || "",
            email: row.email || "",
            orders: toNumber(row.orders),
            revenue: toMoney(row.revenue),
            paid: toMoney(row.paid),
            period_due: toMoney(toMoney(row.revenue) - toMoney(row.paid)),
            current_balance: toMoney(row.balance),
            last_purchase_at: row.last_purchase_at || null
        })),
        commission: {
            rate: toNumber(currentCommission.commission_percent),
            charged: commissionDue,
            paid: toMoney(commissionRows[0]?.received),
            reversed: commissionReversed,
            recognized: recognizedCommission,
            outstanding: toMoney(currentCommission.outstanding)
        },
        operations: {
            pos_sales: toNumber(posRows[0]?.pos_sales),
            online_orders: toNumber(operationRows[0]?.online_orders),
            pending: toNumber(operationRows[0]?.pending),
            processing: toNumber(operationRows[0]?.processing),
            dispatched: toNumber(operationRows[0]?.dispatched),
            delivered: toNumber(operationRows[0]?.delivered),
            cancelled: toNumber(operationRows[0]?.cancelled),
            store_delivery: toNumber(operationRows[0]?.store_delivery),
            platform_delivery: toNumber(operationRows[0]?.platform_delivery)
        }
    };
}

function rowsByKey(rows, key) {
    return new Map(rows.map((row) => [Number(row[key]), row]));
}

async function getPlatformReport(options = {}) {
    const range = normalizeRange(options);
    const salesDate = dateFilter("sales.created_at", range);
    const orderDate = dateFilter("shop_orders.created_at", range);
    const storeDate = dateFilter("stores.created_at", range);
    const ledgerDate = dateFilter("ledger.created_at", range);

    const [
        storeCountRows,
        salesRows,
        orderRows,
        commissionRows,
        currentCommission,
        trendRows,
        stores,
        storeSales,
        storeOrders,
        storeCatalog,
        storeCommission,
        storeCommissionPeriod,
        lastActivityRows
    ] = await Promise.all([
        query(
            `
            SELECT
                COUNT(stores.id) AS total_stores,
                SUM(CASE WHEN stores.status = 'active' THEN 1 ELSE 0 END) AS active_stores,
                SUM(CASE WHEN 1 = 1 ${storeDate.sql} THEN 1 ELSE 0 END) AS new_stores,
                (SELECT COUNT(*) FROM users WHERE role IN ('shopper', 'customer')) AS customers
            FROM stores
            `,
            storeDate.params
        ),
        query(
            `
            SELECT
                COUNT(sales.id) AS sales,
                COALESCE(SUM(sales.total_amount), 0) AS revenue
            FROM sales
            WHERE 1 = 1
              ${salesDate.sql}
              ${recognizedSaleCondition("sales")}
            `,
            salesDate.params
        ),
        query(
            `
            SELECT
                COUNT(shop_orders.id) AS online_orders,
                SUM(CASE WHEN shop_orders.delivery_status = 'pending' THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN shop_orders.delivery_status = 'processing' THEN 1 ELSE 0 END) AS processing,
                SUM(CASE WHEN shop_orders.delivery_status = 'dispatched' THEN 1 ELSE 0 END) AS dispatched,
                SUM(CASE WHEN shop_orders.delivery_status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
                SUM(CASE WHEN shop_orders.delivery_status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
                SUM(CASE WHEN shop_orders.delivery_by = 'store' THEN 1 ELSE 0 END) AS store_delivery,
                SUM(CASE WHEN shop_orders.delivery_by = 'platform' THEN 1 ELSE 0 END) AS platform_delivery,
                COALESCE(SUM(CASE WHEN shop_orders.delivery_status = 'delivered' THEN sales.total_amount ELSE 0 END), 0) AS online_gmv,
                COALESCE(SUM(CASE WHEN shop_orders.delivery_status = 'delivered' AND shop_orders.delivery_by = 'platform' THEN shop_orders.delivery_fee ELSE 0 END), 0) AS delivery_fees
            FROM shop_orders
            LEFT JOIN sales ON sales.id = shop_orders.sale_id
            WHERE 1 = 1
              ${orderDate.sql}
            `,
            orderDate.params
        ),
        query(
            `
            SELECT
                COALESCE(SUM(CASE WHEN ledger.entry_type = 'due' THEN ledger.amount ELSE 0 END), 0) AS due,
                COALESCE(SUM(CASE WHEN ledger.entry_type = 'received' THEN ledger.amount ELSE 0 END), 0) AS received,
                COALESCE(SUM(CASE WHEN ledger.entry_type = 'reversal' THEN ledger.amount ELSE 0 END), 0) AS reversed
            FROM platform_commission_ledger ledger
            WHERE 1 = 1
              ${ledgerDate.sql}
            `,
            ledgerDate.params
        ),
        getCommissionLedgerSummary(),
        query(
            `
            SELECT
                DATE(shop_orders.created_at) AS report_date,
                COUNT(shop_orders.id) AS orders,
                COALESCE(SUM(CASE WHEN shop_orders.delivery_status = 'delivered' THEN sales.total_amount ELSE 0 END), 0) AS gmv,
                COALESCE(SUM(CASE WHEN shop_orders.delivery_status = 'delivered' THEN shop_orders.platform_fee ELSE 0 END), 0) AS commission,
                COALESCE(SUM(CASE WHEN shop_orders.delivery_status = 'delivered' AND shop_orders.delivery_by = 'platform' THEN shop_orders.delivery_fee ELSE 0 END), 0) AS delivery_fees
            FROM shop_orders
            LEFT JOIN sales ON sales.id = shop_orders.sale_id
            WHERE 1 = 1
              ${orderDate.sql}
            GROUP BY DATE(shop_orders.created_at)
            ORDER BY report_date ASC
            `,
            orderDate.params
        ),
        query(
            `
            SELECT
                stores.id,
                stores.tenant_user_id,
                stores.name,
                stores.shop_slug,
                stores.status,
                stores.created_at,
                store_types.name AS store_type
            FROM stores
            INNER JOIN store_types ON store_types.id = stores.store_type_id
            ORDER BY stores.name ASC
            `
        ),
        query(
            `
            SELECT
                sales.user_id,
                COUNT(sales.id) AS sales,
                COALESCE(SUM(sales.total_amount), 0) AS revenue
            FROM sales
            WHERE 1 = 1
              ${salesDate.sql}
              ${recognizedSaleCondition("sales")}
            GROUP BY sales.user_id
            `,
            salesDate.params
        ),
        query(
            `
            SELECT
                shop_orders.user_id,
                COUNT(shop_orders.id) AS online_orders,
                SUM(CASE WHEN shop_orders.delivery_status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
                SUM(CASE WHEN shop_orders.delivery_status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled,
                COALESCE(SUM(CASE WHEN shop_orders.delivery_status = 'delivered' THEN sales.total_amount ELSE 0 END), 0) AS online_gmv,
                COALESCE(SUM(CASE WHEN shop_orders.delivery_status = 'delivered' AND shop_orders.delivery_by = 'platform' THEN shop_orders.delivery_fee ELSE 0 END), 0) AS delivery_fees
            FROM shop_orders
            LEFT JOIN sales ON sales.id = shop_orders.sale_id
            WHERE 1 = 1
              ${orderDate.sql}
            GROUP BY shop_orders.user_id
            `,
            orderDate.params
        ),
        query(
            `
            SELECT
                products.user_id,
                COUNT(products.id) AS products,
                SUM(CASE WHEN products.stock <= 0 THEN 1 ELSE 0 END) AS out_of_stock,
                COALESCE(SUM(products.stock), 0) AS stock
            FROM products
            GROUP BY products.user_id
            `
        ),
        query(
            `
            SELECT
                ledger.store_id,
                COALESCE(SUM(CASE WHEN ledger.entry_type = 'due' THEN ledger.amount WHEN ledger.entry_type IN ('received', 'reversal') THEN -ledger.amount ELSE 0 END), 0) AS outstanding
            FROM platform_commission_ledger ledger
            GROUP BY ledger.store_id
            `
        ),
        query(
            `
            SELECT
                ledger.store_id,
                COALESCE(SUM(CASE WHEN ledger.entry_type = 'due' THEN ledger.amount WHEN ledger.entry_type = 'reversal' THEN -ledger.amount ELSE 0 END), 0) AS commission
            FROM platform_commission_ledger ledger
            WHERE 1 = 1
              ${ledgerDate.sql}
            GROUP BY ledger.store_id
            `,
            ledgerDate.params
        ),
        query(
            `
            SELECT sales.user_id, MAX(sales.created_at) AS last_sale_at
            FROM sales
            GROUP BY sales.user_id
            `
        )
    ]);

    const salesByStore = rowsByKey(storeSales, "user_id");
    const ordersByStore = rowsByKey(storeOrders, "user_id");
    const catalogByStore = rowsByKey(storeCatalog, "user_id");
    const commissionByStore = rowsByKey(storeCommission, "store_id");
    const periodCommissionByStore = rowsByKey(storeCommissionPeriod, "store_id");
    const activityByStore = rowsByKey(lastActivityRows, "user_id");
    const now = Date.now();

    const storePerformance = stores.map((store) => {
        const storeId = Number(store.id);
        const tenantUserId = Number(store.tenant_user_id);
        const sale = salesByStore.get(tenantUserId) || {};
        const order = ordersByStore.get(tenantUserId) || {};
        const catalog = catalogByStore.get(tenantUserId) || {};
        const lastSaleAt = activityByStore.get(tenantUserId)?.last_sale_at || null;
        const daysSinceSale = lastSaleAt
            ? Math.max(0, Math.floor((now - new Date(lastSaleAt).getTime()) / 86400000))
            : null;
        const products = toNumber(catalog.products);
        const totalStock = toNumber(catalog.stock);
        let health = "healthy";
        let healthLabel = "Healthy";

        if (store.status !== "active") {
            health = "inactive";
            healthLabel = "Store inactive";
        } else if (products === 0) {
            health = "setup_required";
            healthLabel = "No products";
        } else if (totalStock <= 0) {
            health = "out_of_stock";
            healthLabel = "No stock available";
        } else if (daysSinceSale == null) {
            health = "no_sales";
            healthLabel = "No sales yet";
        } else if (daysSinceSale > 30) {
            health = "inactive_sales";
            healthLabel = `No sale for ${daysSinceSale} days`;
        }

        return {
            store_id: storeId,
            store: store.name,
            shop_slug: store.shop_slug,
            store_type: store.store_type,
            status: store.status,
            created_at: store.created_at,
            sales: toNumber(sale.sales),
            revenue: toMoney(sale.revenue),
            online_orders: toNumber(order.online_orders),
            delivered: toNumber(order.delivered),
            cancelled: toNumber(order.cancelled),
            online_gmv: toMoney(order.online_gmv),
            delivery_fees: toMoney(order.delivery_fees),
            commission: toMoney(periodCommissionByStore.get(storeId)?.commission),
            commission_outstanding: toMoney(commissionByStore.get(storeId)?.outstanding),
            products,
            out_of_stock: toNumber(catalog.out_of_stock),
            stock: totalStock,
            last_sale_at: lastSaleAt,
            health,
            health_label: healthLabel
        };
    }).sort((left, right) => right.revenue - left.revenue || right.online_gmv - left.online_gmv);

    const storeTypes = new Map();
    storePerformance.forEach((store) => {
        const current = storeTypes.get(store.store_type) || {
            store_type: store.store_type,
            stores: 0,
            active_stores: 0,
            sales: 0,
            revenue: 0,
            online_orders: 0,
            online_gmv: 0,
            commission: 0
        };
        current.stores += 1;
        current.active_stores += store.status === "active" ? 1 : 0;
        current.sales += store.sales;
        current.revenue = toMoney(current.revenue + store.revenue);
        current.online_orders += store.online_orders;
        current.online_gmv = toMoney(current.online_gmv + store.online_gmv);
        current.commission = toMoney(current.commission + store.commission);
        storeTypes.set(store.store_type, current);
    });

    const commissionDue = toMoney(commissionRows[0]?.due);
    const commissionReversed = toMoney(commissionRows[0]?.reversed);
    const recognizedCommission = toMoney(commissionDue - commissionReversed);
    const deliveryFees = toMoney(orderRows[0]?.delivery_fees);

    return {
        range: { from: range.dateFrom, to: range.dateTo },
        summary: {
            total_stores: toNumber(storeCountRows[0]?.total_stores),
            active_stores: toNumber(storeCountRows[0]?.active_stores),
            new_stores: toNumber(storeCountRows[0]?.new_stores),
            customers: toNumber(storeCountRows[0]?.customers),
            sales: toNumber(salesRows[0]?.sales),
            store_sales: toMoney(salesRows[0]?.revenue),
            online_orders: toNumber(orderRows[0]?.online_orders),
            online_gmv: toMoney(orderRows[0]?.online_gmv),
            commission: recognizedCommission,
            commission_received: toMoney(commissionRows[0]?.received),
            commission_outstanding: toMoney(currentCommission.outstanding),
            delivery_fees: deliveryFees,
            platform_earnings: toMoney(recognizedCommission + deliveryFees)
        },
        marketplace_trend: trendRows.map((row) => ({
            date: row.report_date,
            orders: toNumber(row.orders),
            gmv: toMoney(row.gmv),
            commission: toMoney(row.commission),
            delivery_fees: toMoney(row.delivery_fees)
        })),
        stores: storePerformance,
        store_types: [...storeTypes.values()].sort((left, right) => right.revenue - left.revenue),
        delivery: {
            online_orders: toNumber(orderRows[0]?.online_orders),
            pending: toNumber(orderRows[0]?.pending),
            processing: toNumber(orderRows[0]?.processing),
            dispatched: toNumber(orderRows[0]?.dispatched),
            delivered: toNumber(orderRows[0]?.delivered),
            cancelled: toNumber(orderRows[0]?.cancelled),
            store_delivery: toNumber(orderRows[0]?.store_delivery),
            platform_delivery: toNumber(orderRows[0]?.platform_delivery),
            delivery_fees: deliveryFees
        }
    };
}

module.exports = {
    getStoreReport,
    getPlatformReport,
    normalizeRange
};
