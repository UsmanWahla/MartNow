const { query, withTransaction } = require("../utils/query");
const { toNumber } = require("../utils/http");
const { parseListOptions, like } = require("../utils/list");
const { ServiceError } = require("../utils/errors");

const POST_TYPES = ["in", "damage", "adjust"];

function stockDirection(type) {
    if (type === "opening" || type === "in" || type === "sale_return") {
        return 1;
    }

    if (type === "sale" || type === "damage" || type === "adjust") {
        return -1;
    }

    throw new ServiceError(400, "Invalid stock type");
}

function normalizeOption(value) {
    return String(value || "").trim();
}

function variantKey(color, size) {
    return `${normalizeOption(color)}|${normalizeOption(size)}`;
}

function variantCombos(colors, sizes) {
    const colorNames = colors.length > 0 ? colors.map(normalizeOption).filter(Boolean) : [""];
    const sizeNames = sizes.length > 0 ? sizes.map(normalizeOption).filter(Boolean) : [""];
    const rows = [];

    for (const color of colorNames) {
        for (const size of sizeNames) {
            rows.push({ color, size });
        }
    }

    return rows;
}

function variantLabel(color, size) {
    return [normalizeOption(color), normalizeOption(size)].filter(Boolean).join(" / ");
}

async function syncProductStock(productId) {
    const rows = await query(
        "SELECT COALESCE(SUM(stock), 0) AS n FROM product_variants WHERE product_id = ?",
        [productId]
    );

    await query("UPDATE products SET stock = ? WHERE id = ?", [toNumber(rows[0].n), productId]);
}

async function listVariants(productId) {
    return query(
        "SELECT color, size, stock FROM product_variants WHERE product_id = ? ORDER BY id",
        [productId]
    );
}

async function ensureVariants(productId, colors, sizes, opening) {
    const wanted = variantCombos(colors, sizes);
    const existing = await query(
        "SELECT id, color, size, stock FROM product_variants WHERE product_id = ?",
        [productId]
    );
    const openingMap = new Map();

    if (Array.isArray(opening)) {
        for (const row of opening) {
            openingMap.set(variantKey(row.color, row.size), Math.max(0, toNumber(row.stock)));
        }
    }

    const wantedKeys = new Set(wanted.map((row) => variantKey(row.color, row.size)));
    const existingByKey = new Map(existing.map((row) => [variantKey(row.color, row.size), row]));
    const wantedIsBlank = wanted.length === 1 && !wanted[0].color && !wanted[0].size;
    const existingIsBlank =
        existing.length === 1 && !existing[0].color && !existing[0].size;

    if (existing.length === 0) {
        const blankOpening = openingMap.has("|") ? openingMap.get("|") : 0;
        let assignedBlank = false;

        for (const row of wanted) {
            const key = variantKey(row.color, row.size);
            let stock = openingMap.has(key) ? openingMap.get(key) : 0;

            if (!stock && !assignedBlank && blankOpening && key !== "|") {
                stock = blankOpening;
                assignedBlank = true;
            }

            await query(
                "INSERT INTO product_variants (product_id, color, size, stock) VALUES (?, ?, ?, ?)",
                [productId, row.color, row.size, stock]
            );
        }

        await syncProductStock(productId);
        return;
    }

    if (wantedIsBlank && !existingIsBlank) {
        const total = existing.reduce((sum, row) => sum + toNumber(row.stock), 0);
        await query("DELETE FROM product_variants WHERE product_id = ?", [productId]);
        await query(
            "INSERT INTO product_variants (product_id, color, size, stock) VALUES (?, '', '', ?)",
            [productId, openingMap.has("|") ? openingMap.get("|") : total]
        );
        await syncProductStock(productId);
        return;
    }

    if (existingIsBlank && !wantedIsBlank) {
        const carry = toNumber(existing[0].stock);
        await query("DELETE FROM product_variants WHERE product_id = ?", [productId]);
        let first = true;

        for (const row of wanted) {
            const fromOpening = openingMap.get(variantKey(row.color, row.size));
            const stock = fromOpening !== undefined ? fromOpening : first ? carry : 0;
            first = false;
            await query(
                "INSERT INTO product_variants (product_id, color, size, stock) VALUES (?, ?, ?, ?)",
                [productId, row.color, row.size, stock]
            );
        }

        await syncProductStock(productId);
        return;
    }

    for (const row of existing) {
        const key = variantKey(row.color, row.size);

        if (!wantedKeys.has(key)) {
            if (toNumber(row.stock) > 0) {
                throw new ServiceError(
                    400,
                    `${variantLabel(row.color, row.size) || "This option"} still has ${row.stock} in stock. Stock it out first.`
                );
            }

            await query("DELETE FROM product_variants WHERE id = ?", [row.id]);
        }
    }

    for (const row of wanted) {
        const key = variantKey(row.color, row.size);

        if (!existingByKey.has(key)) {
            await query(
                "INSERT INTO product_variants (product_id, color, size, stock) VALUES (?, ?, ?, ?)",
                [productId, row.color, row.size, openingMap.has(key) ? openingMap.get(key) : 0]
            );
        }
    }

    await syncProductStock(productId);
}

async function applyVariantDelta(productId, color, size, delta, productName) {
    const colorName = normalizeOption(color);
    const sizeName = normalizeOption(size);
    const rows = await query(
        `
        SELECT id, stock, color, size
        FROM product_variants
        WHERE product_id = ? AND color = ? AND size = ?
        FOR UPDATE
        `,
        [productId, colorName, sizeName]
    );

    if (rows.length === 0) {
        const [colors, sizes] = await Promise.all([
            query("SELECT id FROM product_colors WHERE product_id = ? LIMIT 1", [productId]),
            query("SELECT id FROM product_sizes WHERE product_id = ? LIMIT 1", [productId])
        ]);

        if (colors.length > 0 && !colorName) {
            throw new ServiceError(400, "Choose a color");
        }

        if (sizes.length > 0 && !sizeName) {
            throw new ServiceError(400, "Choose a size");
        }

        throw new ServiceError(
            400,
            `No stock for that color/size${productName ? ` on ${productName}` : ""}`
        );
    }

    const next = toNumber(rows[0].stock) + toNumber(delta);

    if (next < 0) {
        const label = variantLabel(rows[0].color, rows[0].size);
        throw new ServiceError(
            400,
            label
                ? `Not enough stock for ${productName || "this product"} (${label})`
                : `Not enough stock for ${productName || "this product"}`
        );
    }

    await query("UPDATE product_variants SET stock = ? WHERE id = ?", [next, rows[0].id]);
    await syncProductStock(productId);
    return next;
}

async function recordMovement(
    tenantId,
    actorId,
    productId,
    type,
    quantity,
    note,
    supplierId = null,
    color = "",
    size = ""
) {
    const movementQty = toNumber(quantity);

    if (movementQty <= 0) {
        return;
    }

    stockDirection(type);

    await query(
        `
        INSERT INTO stock_movements
            (user_id, product_id, supplier_id, type, quantity, note, created_by, color, size)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
            tenantId,
            productId,
            supplierId || null,
            type,
            movementQty,
            note || null,
            actorId,
            normalizeOption(color),
            normalizeOption(size)
        ]
    );
}

async function listMovements(tenantId, options = {}) {
    const { search, limitSql, productId } = parseListOptions(options);
    const params = [tenantId];
    let where = "WHERE stock_movements.user_id = ?";

    if (productId) {
        where += " AND stock_movements.product_id = ?";
        params.push(productId);
    }

    if (search) {
        where += ` AND (
            products.name LIKE ?
            OR stock_movements.type LIKE ?
            OR IFNULL(stock_movements.note, '') LIKE ?
            OR stock_movements.color LIKE ?
            OR stock_movements.size LIKE ?
        )`;
        params.push(like(search), like(search), like(search), like(search), like(search));
    }

    const from = `
        FROM stock_movements
        INNER JOIN products ON products.id = stock_movements.product_id
        LEFT JOIN suppliers ON suppliers.id = stock_movements.supplier_id
        ${where}
    `;
    const countRows = await query(`SELECT COUNT(*) AS n ${from}`, params);
    const rows = await query(
        `
        SELECT
            stock_movements.id,
            stock_movements.product_id,
            products.name AS product,
            stock_movements.supplier_id,
            suppliers.name AS supplier,
            stock_movements.type,
            stock_movements.quantity,
            stock_movements.note,
            stock_movements.color,
            stock_movements.size,
            stock_movements.created_at
        ${from}
        ORDER BY stock_movements.id DESC
        ${limitSql}
        `,
        params
    );

    return { rows, total: Number(countRows[0].n) };
}

async function addMovement(
    tenantId,
    actorId,
    { product_id, type, quantity, note, supplier_id, color, size }
) {
    const productId = toNumber(product_id);
    const movementType = String(type || "").trim();
    const movementQty = toNumber(quantity);
    const movementNote = String(note || "").trim() || null;
    const supplierId = toNumber(supplier_id) || null;
    const colorName = normalizeOption(color);
    const sizeName = normalizeOption(size);

    if (!POST_TYPES.includes(movementType)) {
        throw new ServiceError(400, "Type must be in, damage, or adjust");
    }

    if (!productId || movementQty <= 0) {
        throw new ServiceError(400, "Product and quantity are required");
    }

    const direction = stockDirection(movementType);
    let product = null;

    await withTransaction(async () => {
        const products = await query(
            "SELECT id, name, sku, price, cost_price, stock FROM products WHERE id = ? AND user_id = ? FOR UPDATE",
            [productId, tenantId]
        );

        if (products.length === 0) {
            throw new ServiceError(404, "Product not found");
        }

        if (supplierId) {
            const suppliers = await query(
                "SELECT id FROM suppliers WHERE id = ? AND user_id = ? FOR UPDATE",
                [supplierId, tenantId]
            );

            if (suppliers.length === 0) {
                throw new ServiceError(404, "Supplier not found");
            }
        }

        await applyVariantDelta(
            productId,
            colorName,
            sizeName,
            direction * movementQty,
            products[0].name
        );

        await recordMovement(
            tenantId,
            actorId,
            productId,
            movementType,
            movementQty,
            movementNote,
            movementType === "in" ? supplierId : null,
            colorName,
            sizeName
        );

        const refreshed = await query("SELECT stock FROM products WHERE id = ?", [productId]);
        const [variants, colors, sizes] = await Promise.all([
            listVariants(productId),
            query("SELECT name, hex FROM product_colors WHERE product_id = ? ORDER BY id", [productId]),
            query(
                "SELECT name FROM product_sizes WHERE product_id = ? ORDER BY sort_order, id",
                [productId]
            )
        ]);
        product = {
            ...products[0],
            stock: toNumber(refreshed[0].stock),
            variants,
            colors,
            sizes: sizes.map((row) => ({ name: row.name }))
        };
    });

    return {
        message: "Stock updated",
        product
    };
}

const MOVEMENT_SELECT = `
    stock_movements.id,
    stock_movements.product_id,
    products.name AS product,
    stock_movements.supplier_id,
    suppliers.name AS supplier,
    stock_movements.type,
    stock_movements.quantity,
    stock_movements.note,
    stock_movements.color,
    stock_movements.size,
    stock_movements.created_at
`;

async function getMovement(tenantId, movementId) {
    const rows = await query(
        `
        SELECT ${MOVEMENT_SELECT}
        FROM stock_movements
        INNER JOIN products ON products.id = stock_movements.product_id
        LEFT JOIN suppliers ON suppliers.id = stock_movements.supplier_id
        WHERE stock_movements.id = ? AND stock_movements.user_id = ?
        `,
        [movementId, tenantId]
    );

    if (rows.length === 0) {
        throw new ServiceError(404, "Stock movement not found");
    }

    return rows[0];
}

async function loadProductSnapshot(productId) {
    const products = await query(
        "SELECT id, name, sku, price, cost_price, stock FROM products WHERE id = ?",
        [productId]
    );

    if (products.length === 0) {
        throw new ServiceError(404, "Product not found");
    }

    const [variants, colors, sizes] = await Promise.all([
        listVariants(productId),
        query("SELECT name, hex FROM product_colors WHERE product_id = ? ORDER BY id", [productId]),
        query(
            "SELECT name FROM product_sizes WHERE product_id = ? ORDER BY sort_order, id",
            [productId]
        )
    ]);

    return {
        ...products[0],
        variants,
        colors,
        sizes: sizes.map((row) => ({ name: row.name }))
    };
}

function movementDelta(type, quantity) {
    return stockDirection(type) * toNumber(quantity);
}

async function updateMovement(
    tenantId,
    actorId,
    movementId,
    { product_id, type, quantity, note, supplier_id, color, size }
) {
    const existing = await getMovement(tenantId, movementId);

    if (!POST_TYPES.includes(existing.type)) {
        throw new ServiceError(400, "This movement cannot be edited");
    }

    const productId = toNumber(product_id) || toNumber(existing.product_id);
    const movementType = String(type || existing.type).trim();
    const movementQty =
        quantity == null || quantity === "" ? toNumber(existing.quantity) : toNumber(quantity);
    const movementNote = String(note || "").trim() || null;
    const supplierId = toNumber(supplier_id) || null;
    const colorName = normalizeOption(color ?? existing.color);
    const sizeName = normalizeOption(size ?? existing.size);

    if (!POST_TYPES.includes(movementType)) {
        throw new ServiceError(400, "Type must be in, damage, or adjust");
    }

    if (!productId || movementQty <= 0) {
        throw new ServiceError(400, "Product and quantity are required");
    }

    const stockChanged =
        Number(productId) !== Number(existing.product_id) ||
        movementType !== existing.type ||
        movementQty !== toNumber(existing.quantity) ||
        colorName !== normalizeOption(existing.color) ||
        sizeName !== normalizeOption(existing.size);

    let product = null;

    await withTransaction(async () => {
        const products = await query(
            "SELECT id, name FROM products WHERE id = ? AND user_id = ? FOR UPDATE",
            [productId, tenantId]
        );

        if (products.length === 0) {
            throw new ServiceError(404, "Product not found");
        }

        if (supplierId) {
            const suppliers = await query(
                "SELECT id FROM suppliers WHERE id = ? AND user_id = ? FOR UPDATE",
                [supplierId, tenantId]
            );

            if (suppliers.length === 0) {
                throw new ServiceError(404, "Supplier not found");
            }
        }

        if (stockChanged) {
            if (Number(productId) !== Number(existing.product_id)) {
                const previous = await query(
                    "SELECT id, name FROM products WHERE id = ? AND user_id = ? FOR UPDATE",
                    [existing.product_id, tenantId]
                );

                if (previous.length === 0) {
                    throw new ServiceError(404, "Product not found");
                }

                await applyVariantDelta(
                    existing.product_id,
                    existing.color,
                    existing.size,
                    -movementDelta(existing.type, existing.quantity),
                    previous[0].name
                );
            } else {
                await applyVariantDelta(
                    existing.product_id,
                    existing.color,
                    existing.size,
                    -movementDelta(existing.type, existing.quantity),
                    products[0].name
                );
            }

            await applyVariantDelta(
                productId,
                colorName,
                sizeName,
                movementDelta(movementType, movementQty),
                products[0].name
            );
        }

        await query(
            `
            UPDATE stock_movements
            SET product_id = ?, supplier_id = ?, type = ?, quantity = ?, note = ?, color = ?, size = ?
            WHERE id = ? AND user_id = ?
            `,
            [
                productId,
                movementType === "in" ? supplierId : null,
                movementType,
                movementQty,
                movementNote,
                colorName,
                sizeName,
                movementId,
                tenantId
            ]
        );

        product = await loadProductSnapshot(productId);
    });

    return {
        message: "Stock updated",
        product,
        movement: await getMovement(tenantId, movementId)
    };
}

async function deleteMovement(tenantId, actorId, movementId) {
    const existing = await getMovement(tenantId, movementId);

    if (!POST_TYPES.includes(existing.type)) {
        throw new ServiceError(400, "This movement cannot be deleted");
    }

    let product = null;

    await withTransaction(async () => {
        const products = await query(
            "SELECT id, name FROM products WHERE id = ? AND user_id = ? FOR UPDATE",
            [existing.product_id, tenantId]
        );

        if (products.length === 0) {
            throw new ServiceError(404, "Product not found");
        }

        await applyVariantDelta(
            existing.product_id,
            existing.color,
            existing.size,
            -movementDelta(existing.type, existing.quantity),
            products[0].name
        );

        await query("DELETE FROM stock_movements WHERE id = ? AND user_id = ?", [
            movementId,
            tenantId
        ]);

        product = await loadProductSnapshot(existing.product_id);
    });

    return {
        message: "Stock movement deleted",
        product
    };
}

module.exports = {
    listMovements,
    addMovement,
    updateMovement,
    deleteMovement,
    recordMovement,
    stockDirection,
    ensureVariants,
    applyVariantDelta,
    listVariants,
    syncProductStock
};
