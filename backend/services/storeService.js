const bcrypt = require("bcryptjs");
const { query, withTransaction } = require("../utils/query");
const { toNumber, toMoney } = require("../utils/http");
const { parseListOptions, like } = require("../utils/list");
const { ServiceError } = require("../utils/errors");
const {
    getPasswordError,
    isValidUsername,
    normalizeUsername
} = require("../utils/validation");
const { usernameFromEmail } = require("../utils/ownerUsernames");
const { allocateSlug, slugify } = require("../utils/slug");
const { mapShop } = require("./shopCore");
const { mapOrderMoney } = require("../utils/orderMap");
const { periodClause, normalizePeriod } = require("./dashboardService");

function parseCoord(value, label, min, max) {
    if (value === "" || value == null) {
        return null;
    }

    const amount = Number(value);

    if (!Number.isFinite(amount) || amount < min || amount > max) {
        throw new ServiceError(400, `${label} must be between ${min} and ${max}`);
    }

    return amount;
}

function readStoreInput(data, { requirePassword = true } = {}) {
    const name = String(data.name || data.shop_name || "").trim();
    const address = String(data.address || "").trim();
    const contactName = String(data.contact_name || "").trim();
    const contactPhone = String(data.contact_phone || "").trim();
    const username = normalizeUsername(
        data.username || data.login_username || data.email || data.login_email || ""
    );
    const password = String(data.password || "");
    const latitude = parseCoord(data.latitude, "Latitude", -90, 90);
    const longitude = parseCoord(data.longitude, "Longitude", -180, 180);
    const deliveryEnabled =
        data.delivery_enabled === false ||
        data.delivery_enabled === "0" ||
        data.delivery_enabled === 0
            ? 0
            : 1;
    const commission = Math.max(0, Math.min(100, Number(data.commission_percent) || 0));
    const slugHint = String(data.shop_slug || name).trim();
    const logoPath = String(data.logo_path || "").trim() || null;

    if (!name || !address || !contactName || !contactPhone || !username) {
        throw new ServiceError(
            400,
            "Store name, address, contact name, contact phone and login username are required"
        );
    }

    if (!isValidUsername(username)) {
        throw new ServiceError(
            400,
            "Username must be 3–32 characters and use letters, numbers, dots, dashes or underscores"
        );
    }

    if (requirePassword) {
        const passwordError = getPasswordError(password);

        if (passwordError) {
            throw new ServiceError(400, passwordError);
        }
    } else if (password) {
        const passwordError = getPasswordError(password);

        if (passwordError) {
            throw new ServiceError(400, passwordError);
        }
    }

    return {
        name,
        address,
        contactName,
        contactPhone,
        username,
        password,
        latitude,
        longitude,
        deliveryEnabled,
        commission,
        slugHint,
        logoPath
    };
}

function resolveStoreUsername(row) {
    if (row.username) {
        return row.username;
    }

    return usernameFromEmail(row.email);
}

function toStoreRow(row) {
    return {
        id: row.id,
        tenant_user_id: row.tenant_user_id,
        name: row.name,
        address: row.address || "",
        latitude: row.latitude == null ? null : Number(row.latitude),
        longitude: row.longitude == null ? null : Number(row.longitude),
        contact_name: row.contact_name || "",
        contact_phone: row.contact_phone || "",
        username: resolveStoreUsername(row),
        logo_path: row.logo_path || null,
        delivery_enabled: Number(row.delivery_enabled) === 1,
        commission_percent: Number(row.commission_percent || 0),
        shop_slug: row.shop_slug,
        status: row.status,
        created_at: row.created_at,
        orders: toNumber(row.orders),
        revenue: toMoney(row.revenue),
        commission: toMoney(row.commission)
    };
}

async function getStore(storeId) {
    const rows = await query(
        `
        SELECT
            stores.*,
            users.email,
            users.username,
            (
                SELECT COUNT(*) FROM shop_orders
                WHERE shop_orders.user_id = stores.tenant_user_id
                  AND shop_orders.delivery_status <> 'cancelled'
            ) AS orders,
            (
                SELECT COALESCE(SUM(sales.total_amount), 0)
                FROM shop_orders
                LEFT JOIN sales ON sales.id = shop_orders.sale_id
                WHERE shop_orders.user_id = stores.tenant_user_id
                  AND shop_orders.delivery_status <> 'cancelled'
            ) AS revenue,
            (
                SELECT COALESCE(SUM(shop_orders.platform_fee), 0)
                FROM shop_orders
                WHERE shop_orders.user_id = stores.tenant_user_id
                  AND shop_orders.delivery_status <> 'cancelled'
            ) AS commission
        FROM stores
        INNER JOIN users ON users.id = stores.tenant_user_id
        WHERE stores.id = ?
        `,
        [storeId]
    );

    if (rows.length === 0) {
        throw new ServiceError(404, "Store not found");
    }

    return toStoreRow(rows[0]);
}

async function listStores(options = {}) {
    const { search, limitSql } = parseListOptions(options);
    const params = [];
    let where = "WHERE 1 = 1";

    if (search) {
        where +=
            " AND (stores.name LIKE ? OR stores.shop_slug LIKE ? OR users.username LIKE ? OR users.email LIKE ? OR stores.address LIKE ?)";
        params.push(like(search), like(search), like(search), like(search), like(search));
    }

    const from = `
        FROM stores
        INNER JOIN users ON users.id = stores.tenant_user_id
        ${where}
    `;
    const countRows = await query(`SELECT COUNT(*) AS n ${from}`, params);
    const rows = await query(
        `
        SELECT
            stores.*,
            users.email,
            users.username,
            (
                SELECT COUNT(*) FROM shop_orders
                WHERE shop_orders.user_id = stores.tenant_user_id
                  AND shop_orders.delivery_status <> 'cancelled'
            ) AS orders,
            (
                SELECT COALESCE(SUM(sales.total_amount), 0)
                FROM shop_orders
                LEFT JOIN sales ON sales.id = shop_orders.sale_id
                WHERE shop_orders.user_id = stores.tenant_user_id
                  AND shop_orders.delivery_status <> 'cancelled'
            ) AS revenue,
            (
                SELECT COALESCE(SUM(shop_orders.platform_fee), 0)
                FROM shop_orders
                WHERE shop_orders.user_id = stores.tenant_user_id
                  AND shop_orders.delivery_status <> 'cancelled'
            ) AS commission
        ${from}
        ORDER BY stores.id DESC
        ${limitSql}
        `,
        params
    );

    return { rows: rows.map(toStoreRow), total: Number(countRows[0].n) };
}

async function listPublicStores() {
    const rows = await query(
        `
        SELECT
            stores.id,
            stores.name,
            stores.address,
            stores.latitude,
            stores.longitude,
            stores.logo_path,
            stores.delivery_enabled,
            stores.shop_slug
        FROM stores
        WHERE stores.status = 'active'
        ORDER BY stores.name
        `
    );

    return {
        rows: rows.map((row) => ({
            id: row.id,
            name: row.name,
            address: row.address || "",
            latitude: row.latitude == null ? null : Number(row.latitude),
            longitude: row.longitude == null ? null : Number(row.longitude),
            logo_path: row.logo_path || null,
            delivery_enabled: Number(row.delivery_enabled) === 1,
            shop_slug: row.shop_slug
        }))
    };
}

async function createStore(data) {
    const input = readStoreInput(data, { requirePassword: true });
    const existing = await query("SELECT id FROM users WHERE username = ?", [input.username]);

    if (existing.length > 0) {
        throw new ServiceError(409, "Username already exists");
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);
    let storeId = 0;

    await withTransaction(async () => {
        const userInsert = await query(
            "INSERT INTO users (name, email, username, password, role, owner_id, shop_name) VALUES (?, ?, ?, ?, 'owner', NULL, ?)",
            [input.contactName, `${input.username}@store.local`, input.username, hashedPassword, input.name]
        );
        const slug = await allocateSlug(input.slugHint, userInsert.insertId);

        await query("UPDATE users SET shop_slug = ? WHERE id = ?", [slug, userInsert.insertId]);

        const storeInsert = await query(
            `
            INSERT INTO stores (
                tenant_user_id, name, address, latitude, longitude,
                contact_name, contact_phone, logo_path, delivery_enabled,
                commission_percent, shop_slug, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
            `,
            [
                userInsert.insertId,
                input.name,
                input.address,
                input.latitude,
                input.longitude,
                input.contactName,
                input.contactPhone,
                input.logoPath,
                input.deliveryEnabled,
                input.commission,
                slug
            ]
        );

        storeId = storeInsert.insertId;
    });

    return { message: "Store created", store: await getStore(storeId) };
}

async function updateStore(storeId, data) {
    const existing = await getStore(storeId);
    const input = readStoreInput(
        {
            name: data.name ?? existing.name,
            address: data.address ?? existing.address,
            latitude: data.latitude ?? existing.latitude,
            longitude: data.longitude ?? existing.longitude,
            contact_name: data.contact_name ?? existing.contact_name,
            contact_phone: data.contact_phone ?? existing.contact_phone,
            username: data.username ?? existing.username,
            password: data.password ?? "",
            shop_slug: data.shop_slug ?? existing.shop_slug,
            delivery_enabled: data.delivery_enabled ?? existing.delivery_enabled,
            commission_percent: data.commission_percent ?? existing.commission_percent,
            logo_path: data.logo_path ?? existing.logo_path
        },
        { requirePassword: false }
    );

    const ownerId = existing.tenant_user_id;
    const usernameTaken = await query("SELECT id FROM users WHERE username = ? AND id <> ?", [
        input.username,
        ownerId
    ]);

    if (usernameTaken.length > 0) {
        throw new ServiceError(409, "Username already exists");
    }

    let nextSlug = existing.shop_slug;
    const requested = slugify(input.slugHint);

    if (requested && requested !== existing.shop_slug) {
        nextSlug = await allocateSlug(requested, ownerId);
    }

    await withTransaction(async () => {
        const userFields = [input.contactName, input.username, input.name, nextSlug];
        let userSql = "UPDATE users SET name = ?, username = ?, shop_name = ?, shop_slug = ?";

        if (input.password) {
            userSql += ", password = ?";
            userFields.push(await bcrypt.hash(input.password, 10));
        }

        userSql += " WHERE id = ?";
        userFields.push(ownerId);
        await query(userSql, userFields);

        await query(
            `
            UPDATE stores
            SET name = ?, address = ?, latitude = ?, longitude = ?,
                contact_name = ?, contact_phone = ?, logo_path = ?,
                delivery_enabled = ?, commission_percent = ?, shop_slug = ?
            WHERE id = ?
            `,
            [
                input.name,
                input.address,
                input.latitude,
                input.longitude,
                input.contactName,
                input.contactPhone,
                input.logoPath || existing.logo_path,
                input.deliveryEnabled,
                input.commission,
                nextSlug,
                storeId
            ]
        );
    });

    return { message: "Store updated", store: await getStore(storeId) };
}

async function deactivateStore(storeId) {
    await getStore(storeId);
    await query("UPDATE stores SET status = 'inactive' WHERE id = ?", [storeId]);
    return { message: "Store deactivated" };
}

async function deleteInactiveStore(storeId) {
    const store = await getStore(storeId);

    if (store.status !== "inactive") {
        throw new ServiceError(400, "Deactivate the store before deleting it");
    }

    const { deleteTenantData } = require("../utils/tenantCleanup");
    await deleteTenantData(store.tenant_user_id, { storeId });

    return { message: "Store deleted" };
}

async function getPlatformStats(period = "month") {
    const selectedPeriod = normalizePeriod(period);
    const orderFilter = periodClause("shop_orders.created_at", selectedPeriod);
    const [counts, money, top] = await Promise.all([
        query(
            `
            SELECT
                (SELECT COUNT(*) FROM stores) AS totalStores,
                (SELECT COUNT(*) FROM stores WHERE status = 'active') AS activeStores,
                (SELECT COUNT(*) FROM users WHERE role IN ('customer', 'shopper')) AS customers
            `
        ),
        query(
            `
            SELECT
                COUNT(shop_orders.id) AS orders,
                COALESCE(SUM(sales.total_amount), 0) AS revenue,
                COALESCE(SUM(shop_orders.platform_fee), 0) AS commission,
                COALESCE(SUM(
                    CASE
                        WHEN shop_orders.delivery_by = 'platform'
                        THEN shop_orders.delivery_fee
                        ELSE 0
                    END
                ), 0) AS deliveryFees,
                COALESCE(SUM(
                    CASE
                        WHEN shop_orders.delivery_by = 'platform'
                        THEN 1
                        ELSE 0
                    END
                ), 0) AS deliveryOrders
            FROM shop_orders
            LEFT JOIN sales ON sales.id = shop_orders.sale_id
            WHERE ${orderFilter}
              AND shop_orders.delivery_status <> 'cancelled'
            `
        ),
        query(
            `
            SELECT
                stores.id,
                stores.name,
                stores.shop_slug,
                COUNT(shop_orders.id) AS orders,
                COALESCE(SUM(sales.total_amount), 0) AS revenue,
                COALESCE(SUM(shop_orders.platform_fee), 0) AS commission
            FROM stores
            LEFT JOIN shop_orders
                ON shop_orders.user_id = stores.tenant_user_id
                AND ${orderFilter}
                AND shop_orders.delivery_status <> 'cancelled'
            LEFT JOIN sales ON sales.id = shop_orders.sale_id
            WHERE stores.status = 'active'
            GROUP BY stores.id, stores.name, stores.shop_slug
            ORDER BY revenue DESC
            LIMIT 8
            `
        )
    ]);

    const commission = toMoney(money[0].commission);
    const deliveryFees = toMoney(money[0].deliveryFees);

    return {
        period: selectedPeriod,
        totalStores: toNumber(counts[0].totalStores),
        activeStores: toNumber(counts[0].activeStores),
        customers: toNumber(counts[0].customers),
        orders: toNumber(money[0].orders),
        revenue: toMoney(money[0].revenue),
        commission,
        deliveryFees,
        deliveryOrders: toNumber(money[0].deliveryOrders),
        platformEarnings: toMoney(commission + deliveryFees),
        topStores: top.map((row) => ({
            id: row.id,
            name: row.name,
            shop_slug: row.shop_slug,
            orders: toNumber(row.orders),
            revenue: toMoney(row.revenue),
            commission: toMoney(row.commission)
        }))
    };
}

function buildOnlineOrdersWhere(search, storeId, date, deliveryBy) {
    const params = [];
    let where = "WHERE 1 = 1";

    if (search) {
        where += ` AND (
            stores.name LIKE ?
            OR stores.shop_slug LIKE ?
            OR IFNULL(customers.name, '') LIKE ?
            OR IFNULL(shop_orders.city, '') LIKE ?
            OR IFNULL(shop_orders.email, '') LIKE ?
            OR CAST(shop_orders.id AS CHAR) LIKE ?
        )`;
        params.push(like(search), like(search), like(search), like(search), like(search), like(search));
    }

    if (storeId) {
        where += " AND stores.id = ?";
        params.push(storeId);
    }

    if (date) {
        where += " AND DATE(shop_orders.created_at) = ?";
        params.push(date);
    }

    if (deliveryBy) {
        where += " AND shop_orders.delivery_by = ?";
        params.push(deliveryBy);
    }

    return { where, params };
}

function buildWalkInSalesWhere(search, storeId, date) {
    const params = [];
    let where = `
        WHERE NOT EXISTS (
            SELECT 1 FROM shop_orders so WHERE so.sale_id = sales.id
        )
    `;

    if (search) {
        where += ` AND (
            stores.name LIKE ?
            OR stores.shop_slug LIKE ?
            OR IFNULL(customers.name, '') LIKE ?
            OR CAST(sales.id AS CHAR) LIKE ?
            OR EXISTS (
                SELECT 1
                FROM sale_items
                INNER JOIN products ON products.id = sale_items.product_id
                WHERE sale_items.sale_id = sales.id
                  AND products.name LIKE ?
            )
        )`;
        params.push(like(search), like(search), like(search), like(search), like(search));
    }

    if (storeId) {
        where += " AND stores.id = ?";
        params.push(storeId);
    }

    if (date) {
        where += " AND DATE(sales.created_at) = ?";
        params.push(date);
    }

    return { where, params };
}

async function listPlatformOrders(options = {}) {
    const { search, limitSql, storeId, date, deliveryBy } = parseListOptions(options);
    const onlineWhere = buildOnlineOrdersWhere(search, storeId, date, deliveryBy);
    const onlineFrom = `
        FROM shop_orders
        INNER JOIN stores ON stores.tenant_user_id = shop_orders.user_id
        INNER JOIN customers ON customers.id = shop_orders.customer_id
        LEFT JOIN sales ON sales.id = shop_orders.sale_id
        ${onlineWhere.where}
    `;

    if (deliveryBy) {
        const countRows = await query(`SELECT COUNT(*) AS n ${onlineFrom}`, onlineWhere.params);
        const rows = await query(
            `
            SELECT
                'online' AS order_kind,
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
                shop_orders.commission_percent,
                shop_orders.platform_fee,
                sales.total_amount,
                sales.paid_amount,
                shop_orders.created_at,
                stores.id AS store_id,
                stores.name AS store_name,
                stores.shop_slug
            ${onlineFrom}
            ORDER BY shop_orders.created_at DESC
            ${limitSql}
            `,
            onlineWhere.params
        );

        return {
            rows: rows.map((row) => mapPlatformOrderRow(row)),
            total: Number(countRows[0].n)
        };
    }

    const walkInWhere = buildWalkInSalesWhere(search, storeId, date);
    const walkInFrom = `
        FROM sales
        INNER JOIN stores ON stores.tenant_user_id = sales.user_id
        LEFT JOIN customers ON customers.id = sales.customer_id
        ${walkInWhere.where}
    `;
    const countRows = await query(
        `
        SELECT COUNT(*) AS n FROM (
            SELECT shop_orders.id ${onlineFrom}
            UNION ALL
            SELECT sales.id ${walkInFrom}
        ) combined
        `,
        [...onlineWhere.params, ...walkInWhere.params]
    );
    const rows = await query(
        `
        SELECT * FROM (
            SELECT
                'online' AS order_kind,
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
                shop_orders.commission_percent,
                shop_orders.platform_fee,
                sales.total_amount,
                sales.paid_amount,
                shop_orders.created_at,
                stores.id AS store_id,
                stores.name AS store_name,
                stores.shop_slug
            ${onlineFrom}
            UNION ALL
            SELECT
                'walkin' AS order_kind,
                sales.id AS id,
                sales.id AS sale_id,
                sales.customer_id,
                customers.name AS customer,
                '' AS email,
                IFNULL(customers.phone, '') AS phone,
                '' AS address,
                '' AS city,
                'counter' AS payment_method,
                CASE
                    WHEN sales.paid_amount >= sales.total_amount THEN 'collected'
                    ELSE 'pending'
                END AS payment_status,
                'delivered' AS delivery_status,
                NULL AS delivery_by,
                0 AS delivery_fee,
                0 AS commission_percent,
                0 AS platform_fee,
                sales.total_amount,
                sales.paid_amount,
                sales.created_at,
                stores.id AS store_id,
                stores.name AS store_name,
                stores.shop_slug
            ${walkInFrom}
        ) combined
        ORDER BY created_at DESC
        ${limitSql}
        `,
        [...onlineWhere.params, ...walkInWhere.params]
    );

    return {
        rows: rows.map((row) => mapPlatformOrderRow(row)),
        total: Number(countRows[0].n)
    };
}

function mapPlatformOrderRow(row, items) {
    const money = mapOrderMoney(row);
    const orderKind = row.order_kind === "walkin" ? "walkin" : "online";

    return {
        order_kind: orderKind,
        id: row.id,
        sale_id: row.sale_id,
        store_id: row.store_id,
        store_name: row.store_name,
        shop_slug: row.shop_slug,
        customer_id: row.customer_id,
        customer: row.customer,
        email: row.email,
        phone: row.phone,
        address: row.address || "",
        city: row.city || "",
        payment_method: row.payment_method,
        payment_status: row.payment_status,
        delivery_status: row.delivery_status,
        ...money,
        commission_percent: Number(row.commission_percent || 0),
        platform_fee: toMoney(row.platform_fee),
        created_at: row.created_at,
        ...(items ? { items } : {})
    };
}

async function getPlatformOrder(orderId) {
    const rows = await query(
        `
        SELECT
            shop_orders.*,
            customers.name AS customer,
            sales.total_amount,
            sales.paid_amount,
            stores.id AS store_id,
            stores.name AS store_name,
            stores.shop_slug
        FROM shop_orders
        INNER JOIN stores ON stores.tenant_user_id = shop_orders.user_id
        INNER JOIN customers ON customers.id = shop_orders.customer_id
        LEFT JOIN sales ON sales.id = shop_orders.sale_id
        WHERE shop_orders.id = ?
        LIMIT 1
        `,
        [orderId]
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

    return mapPlatformOrderRow(
        { ...order, order_kind: "online" },
        items.map((item) => ({
            product_id: item.product_id,
            product: item.product,
            quantity: item.quantity,
            unit_price: toMoney(item.unit_price),
            total_amount: toMoney(item.total_amount),
            color: item.color || "",
            size: item.size || ""
        }))
    );
}

async function getPlatformWalkInSale(saleId) {
    const rows = await query(
        `
        SELECT
            sales.id,
            sales.id AS sale_id,
            sales.customer_id,
            customers.name AS customer,
            IFNULL(customers.phone, '') AS phone,
            sales.total_amount,
            sales.paid_amount,
            sales.created_at,
            stores.id AS store_id,
            stores.name AS store_name,
            stores.shop_slug
        FROM sales
        INNER JOIN stores ON stores.tenant_user_id = sales.user_id
        LEFT JOIN customers ON customers.id = sales.customer_id
        WHERE sales.id = ?
          AND NOT EXISTS (SELECT 1 FROM shop_orders so WHERE so.sale_id = sales.id)
        LIMIT 1
        `,
        [saleId]
    );

    if (rows.length === 0) {
        throw new ServiceError(404, "Sale not found");
    }

    const sale = rows[0];
    const items = await query(
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
        [saleId]
    );

    const row = {
        order_kind: "walkin",
        id: sale.id,
        sale_id: sale.sale_id,
        customer_id: sale.customer_id,
        customer: sale.customer,
        email: "",
        phone: sale.phone,
        address: "",
        city: "",
        payment_method: "counter",
        payment_status:
            toMoney(sale.paid_amount) >= toMoney(sale.total_amount) ? "collected" : "pending",
        delivery_status: "delivered",
        delivery_by: null,
        delivery_fee: 0,
        commission_percent: 0,
        platform_fee: 0,
        total_amount: sale.total_amount,
        paid_amount: sale.paid_amount,
        created_at: sale.created_at,
        store_id: sale.store_id,
        store_name: sale.store_name,
        shop_slug: sale.shop_slug
    };

    return mapPlatformOrderRow(
        row,
        items.map((item) => ({
            product_id: item.product_id,
            product: item.product,
            quantity: item.quantity,
            unit_price: toMoney(item.unit_price),
            total_amount: toMoney(item.total_amount),
            color: item.color || "",
            size: item.size || ""
        }))
    );
}

async function updatePlatformOrderStatus(orderId, deliveryStatus) {
    const status = String(deliveryStatus || "").trim().toLowerCase();

    if (status !== "delivered") {
        throw new ServiceError(400, "Platform deliveries can only be marked as delivered");
    }

    const rows = await query(
        "SELECT id, user_id, delivery_by, delivery_status FROM shop_orders WHERE id = ? LIMIT 1",
        [orderId]
    );

    if (rows.length === 0) {
        throw new ServiceError(404, "Order not found");
    }

    if (String(rows[0].delivery_by || "") !== "platform") {
        throw new ServiceError(400, "Only platform deliveries can be updated here");
    }

    if (rows[0].delivery_status === "cancelled") {
        throw new ServiceError(400, "Cancelled orders cannot be marked delivered");
    }

    if (rows[0].delivery_status === "delivered") {
        throw new ServiceError(400, "Order is already delivered");
    }

    if (rows[0].delivery_status !== "dispatched") {
        throw new ServiceError(400, "Wait until the shop marks this order as dispatched");
    }

    const orderService = require("./orderService");
    const result = await orderService.updateOrderStatus(rows[0].user_id, orderId, "delivered", {
        allowPlatformDeliver: true
    });

    return {
        message: result.message,
        order: await getPlatformOrder(orderId)
    };
}

module.exports = {
    listStores,
    listPublicStores,
    getStore,
    createStore,
    updateStore,
    deactivateStore,
    deleteInactiveStore,
    getPlatformStats,
    listPlatformOrders,
    getPlatformOrder,
    getPlatformWalkInSale,
    updatePlatformOrderStatus,
    toStoreRow,
    mapShop
};
