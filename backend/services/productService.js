const { query, withTransaction } = require("../utils/query");
const { toNumber, toMoney } = require("../utils/http");
const { parseListOptions, like } = require("../utils/list");
const { ServiceError } = require("../utils/errors");
const { recordMovement, stockDirection, ensureVariants, listVariants } = require("./stockService");
const { readProductCategory, readFeatured } = require("../utils/productCatalog");
const { createBatch } = require("./inventoryBatchService");
const {
    readProductUnits,
    roundQuantity,
    roundUnitCost
} = require("../utils/productUnits");

const PRODUCT_COLUMNS = `
    id, name, sku, price, cost_price, stock, image_path, description, category, featured,
    inventory_type, base_unit, sale_unit, quantity_step, units_per_sale_unit
`;

async function getProduct(tenantId, productId) {
    const results = await query(
        `SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = ? AND user_id = ?`,
        [productId, tenantId]
    );

    if (results.length === 0) {
        throw new ServiceError(404, "Product not found");
    }

    return attachCatalog(results[0]);
}

function parseJson(value, fallback) {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }

    if (Array.isArray(value)) {
        return value;
    }

    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

function groupByProduct(rows) {
    const map = new Map();

    for (const row of rows) {
        const bucket = map.get(row.product_id) || [];
        bucket.push(row);
        map.set(row.product_id, bucket);
    }

    return map;
}

async function attachCatalog(products) {
    const list = Array.isArray(products) ? products : [products];

    if (list.length === 0) {
        return products;
    }

    const ids = list.map((product) => product.id);
    const placeholders = ids.map(() => "?").join(",");
    const [images, colors, sizes, variants] = await Promise.all([
        query(
            `SELECT id, product_id, path FROM product_images WHERE product_id IN (${placeholders}) ORDER BY sort_order, id`,
            ids
        ),
        query(
            `SELECT id, product_id, name, hex FROM product_colors WHERE product_id IN (${placeholders}) ORDER BY id`,
            ids
        ),
        query(
            `SELECT id, product_id, name FROM product_sizes WHERE product_id IN (${placeholders}) ORDER BY sort_order, id`,
            ids
        ),
        query(
            `SELECT product_id, color, size, stock FROM product_variants WHERE product_id IN (${placeholders}) ORDER BY id`,
            ids
        )
    ]);

    const imageMap = groupByProduct(images);
    const colorMap = groupByProduct(colors);
    const sizeMap = groupByProduct(sizes);
    const variantMap = groupByProduct(variants);

    const decorated = list.map((product) => {
        const stored = (imageMap.get(product.id) || []).map((row) => ({
            id: row.id,
            path: row.path
        }));
        const fallback = product.image_path ? [{ id: 0, path: product.image_path }] : [];
        const allImages = stored.length > 0 ? stored : fallback;
        const variantRows = (variantMap.get(product.id) || []).map((row) => ({
            color: row.color || "",
            size: row.size || "",
            stock: Number(row.stock) || 0
        }));

        return {
            ...product,
            category: product.category || null,
            featured: Number(product.featured) === 1,
            images: allImages,
            colors: colorMap.get(product.id) || [],
            sizes: sizeMap.get(product.id) || [],
            variants: variantRows,
            image_path: allImages[0] ? allImages[0].path : product.image_path || null
        };
    });

    return Array.isArray(products) ? decorated : decorated[0];
}

async function saveCatalog(productId, data) {
    const newPaths = Array.isArray(data.image_paths)
        ? data.image_paths.filter(Boolean)
        : data.image_path
            ? [data.image_path]
            : [];
    const keepIds = parseJson(data.keep_image_ids, undefined);

    if (keepIds !== undefined) {
        const keep = keepIds.map(Number).filter((id) => id > 0);

        if (keep.length > 0) {
            await query(
                `DELETE FROM product_images WHERE product_id = ? AND id NOT IN (${keep.map(() => "?").join(",")})`,
                [productId, ...keep]
            );
        } else {
            await query("DELETE FROM product_images WHERE product_id = ?", [productId]);
        }
    }

    const keepPaths = parseJson(data.keep_image_paths, [])
        .map((imagePath) => String(imagePath || "").trim())
        .filter(Boolean);
    const incoming = [...keepPaths, ...newPaths];

    if (incoming.length > 0) {
        const existing = await query(
            "SELECT COALESCE(MAX(sort_order), -1) AS n FROM product_images WHERE product_id = ?",
            [productId]
        );
        let order = Number(existing[0].n) + 1;

        for (const imagePath of incoming) {
            await query(
                "INSERT INTO product_images (product_id, path, sort_order) VALUES (?, ?, ?)",
                [productId, imagePath, order]
            );
            order += 1;
        }
    }

    const cover = await query(
        "SELECT path FROM product_images WHERE product_id = ? ORDER BY sort_order, id LIMIT 1",
        [productId]
    );

    if (cover[0]) {
        await query("UPDATE products SET image_path = ? WHERE id = ?", [
            cover[0].path,
            productId
        ]);
    } else if (keepIds !== undefined) {
        await query("UPDATE products SET image_path = NULL WHERE id = ?", [productId]);
    }

    if (data.colors !== undefined) {
        const colors = parseJson(data.colors, []);
        await query("DELETE FROM product_colors WHERE product_id = ?", [productId]);

        for (const color of colors) {
            const name = String(color.name || color || "").trim();

            if (!name) {
                continue;
            }

            const hex = String(color.hex || "#0f766e").trim() || "#0f766e";
            await query(
                "INSERT INTO product_colors (product_id, name, hex) VALUES (?, ?, ?)",
                [productId, name.slice(0, 40), hex.slice(0, 7)]
            );
        }
    }

    if (data.sizes !== undefined) {
        const sizes = parseJson(data.sizes, []);
        await query("DELETE FROM product_sizes WHERE product_id = ?", [productId]);
        let sizeOrder = 0;

        for (const size of sizes) {
            const name = String(size.name || size || "").trim();

            if (!name) {
                continue;
            }

            await query(
                "INSERT INTO product_sizes (product_id, name, sort_order) VALUES (?, ?, ?)",
                [productId, name.slice(0, 20), sizeOrder]
            );
            sizeOrder += 1;
        }
    }

    if (data.colors !== undefined || data.sizes !== undefined || data.variants !== undefined) {
        const colorRows = await query(
            "SELECT name FROM product_colors WHERE product_id = ? ORDER BY id",
            [productId]
        );
        const sizeRows = await query(
            "SELECT name FROM product_sizes WHERE product_id = ? ORDER BY sort_order, id",
            [productId]
        );
        await ensureVariants(
            productId,
            colorRows.map((row) => row.name),
            sizeRows.map((row) => row.name),
            parseJson(data.variants, undefined)
        );
    }
}

async function listProducts(tenantId, options = {}) {
    const { search, limitSql } = parseListOptions(options);
    const params = [tenantId];
    let where = "WHERE user_id = ?";

    if (search) {
        where += " AND (name LIKE ? OR IFNULL(sku, '') LIKE ?)";
        params.push(like(search), like(search));
    }

    const countRows = await query(
        `SELECT COUNT(*) AS n FROM products ${where}`,
        params
    );
    const rows = await query(
        `SELECT ${PRODUCT_COLUMNS} FROM products ${where} ORDER BY id DESC ${limitSql}`,
        params
    );

    return { rows: await attachCatalog(rows), total: Number(countRows[0].n) };
}

async function assertUniqueName(tenantId, productName, productId) {
    const rows = await query(
        `
        SELECT id FROM products
        WHERE user_id = ? AND LOWER(name) = LOWER(?) AND id <> ?
        LIMIT 1
        `,
        [tenantId, productName, productId || 0]
    );

    if (rows.length > 0) {
        throw new ServiceError(409, "A product with this name already exists");
    }
}

async function assertUniqueSku(tenantId, sku, productId) {
    if (!sku) {
        return;
    }

    const rows = await query(
        `
        SELECT id FROM products
        WHERE user_id = ? AND sku = ? AND id <> ?
        LIMIT 1
        `,
        [tenantId, sku, productId || 0]
    );

    if (rows.length > 0) {
        throw new ServiceError(409, "A product with this SKU already exists");
    }
}

function readProduct(data, existing = {}) {
    const productName = String(data.name ?? existing.name ?? "").trim();
    const salePrice = toMoney(data.price ?? existing.price);
    const costPrice = roundUnitCost(data.cost_price ?? existing.cost_price);
    const sku = String(data.sku ?? existing.sku ?? "").trim() || null;
    const description = String(data.description ?? existing.description ?? "").trim() || null;
    const category = readProductCategory(data.category ?? existing.category);
    const featured = readFeatured(data.featured ?? existing.featured);
    const units = readProductUnits(data, existing);

    if (!productName || salePrice <= 0 || costPrice < 0) {
        throw new ServiceError(400, "Name, sale price and cost price are required");
    }

    return {
        productName,
        salePrice,
        costPrice,
        sku,
        description,
        category,
        featured,
        ...units
    };
}

async function addProduct(tenantId, data, actorId = tenantId) {
    const productData = readProduct(data);
    const {
        productName,
        salePrice,
        costPrice,
        sku,
        description,
        category,
        featured,
        inventoryType,
        baseUnit,
        saleUnit,
        quantityStep,
        unitsPerSaleUnit
    } = productData;
    const productStock = roundQuantity(data.stock);
    const imagePath = String(data.image_path || "").trim() || null;

    if (productStock < 0) {
        throw new ServiceError(400, "Stock cannot be negative");
    }

    await assertUniqueName(tenantId, productName);
    await assertUniqueSku(tenantId, sku);

    let productId = 0;

    await withTransaction(async () => {
        const result = await query(
            `
            INSERT INTO products (
                user_id, name, sku, price, cost_price, stock, image_path, description,
                category, featured, inventory_type, base_unit, sale_unit, quantity_step,
                units_per_sale_unit
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                tenantId,
                productName,
                sku,
                salePrice,
                costPrice,
                productStock,
                imagePath,
                description,
                category,
                featured ? 1 : 0,
                inventoryType,
                baseUnit,
                saleUnit,
                quantityStep,
                unitsPerSaleUnit
            ]
        );

        productId = result.insertId;

        await saveCatalog(productId, {
            ...data,
            colors: data.colors !== undefined ? data.colors : [],
            sizes: data.sizes !== undefined ? data.sizes : [],
            variants:
                data.variants !== undefined
                    ? data.variants
                    : [{ color: "", size: "", stock: productStock }]
        });

        const variants = await listVariants(productId);

        for (const row of variants) {
            if (toNumber(row.stock) > 0) {
                const movementId = await recordMovement(
                    tenantId,
                    actorId,
                    productId,
                    "opening",
                    row.stock,
                    "Opening stock",
                    null,
                    row.color,
                    row.size,
                    costPrice
                );
                await createBatch({
                    tenantId,
                    actorId,
                    productId,
                    movementId,
                    color: row.color,
                    size: row.size,
                    quantity: row.stock,
                    unitCost: costPrice,
                    salePrice,
                    baseUnit,
                    saleUnit,
                    unitConversion: unitsPerSaleUnit
                });
            }
        }
    });

    return {
        message: "Product added",
        product: await getProduct(tenantId, productId)
    };
}

async function updateProduct(tenantId, productId, data) {
    const existingRows = await query(
        `SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = ? AND user_id = ?`,
        [productId, tenantId]
    );

    if (existingRows.length === 0) {
        throw new ServiceError(404, "Product not found");
    }

    const existing = existingRows[0];
    const productData = readProduct(data, existing);
    const {
        productName,
        salePrice,
        costPrice,
        sku,
        description,
        category,
        featured,
        inventoryType,
        baseUnit,
        saleUnit,
        quantityStep,
        unitsPerSaleUnit
    } = productData;
    const imagePath = String(data.image_path || "").trim();

    const unitsChanged =
        inventoryType !== existing.inventory_type ||
        baseUnit !== existing.base_unit ||
        saleUnit !== existing.sale_unit ||
        quantityStep !== roundQuantity(existing.quantity_step) ||
        unitsPerSaleUnit !== roundQuantity(existing.units_per_sale_unit);

    if (unitsChanged && roundQuantity(existing.stock) > 0) {
        throw new ServiceError(
            400,
            "Stock out this product before changing its units or quantity conversion"
        );
    }

    await assertUniqueName(tenantId, productName, productId);
    await assertUniqueSku(tenantId, sku, productId);

    const result = imagePath
        ? await query(
            `UPDATE products SET name = ?, sku = ?, price = ?, cost_price = ?, description = ?,
                category = ?, featured = ?, image_path = ?, inventory_type = ?, base_unit = ?,
                sale_unit = ?, quantity_step = ?, units_per_sale_unit = ?
             WHERE id = ? AND user_id = ?`,
            [productName, sku, salePrice, costPrice, description, category, featured ? 1 : 0, imagePath, inventoryType, baseUnit, saleUnit, quantityStep, unitsPerSaleUnit, productId, tenantId]
        )
        : await query(
            `UPDATE products SET name = ?, sku = ?, price = ?, cost_price = ?, description = ?,
                category = ?, featured = ?, inventory_type = ?, base_unit = ?, sale_unit = ?,
                quantity_step = ?, units_per_sale_unit = ?
             WHERE id = ? AND user_id = ?`,
            [productName, sku, salePrice, costPrice, description, category, featured ? 1 : 0, inventoryType, baseUnit, saleUnit, quantityStep, unitsPerSaleUnit, productId, tenantId]
        );

    if (result.affectedRows === 0) {
        throw new ServiceError(404, "Product not found");
    }

    await saveCatalog(productId, data);

    return {
        message: "Product updated",
        product: await getProduct(tenantId, productId)
    };
}

async function deleteProduct(tenantId, productId) {
    await withTransaction(async () => {
        const used = await query(
            `
            SELECT sale_items.id
            FROM sale_items
            INNER JOIN sales ON sales.id = sale_items.sale_id
            WHERE sale_items.product_id = ? AND sales.user_id = ?
            LIMIT 1
            `,
            [productId, tenantId]
        );

        if (used.length > 0) {
            throw new ServiceError(
                400,
                "Cannot delete this product because it is used in sales"
            );
        }

        await query(
            "DELETE FROM cart_items WHERE product_id = ?",
            [productId]
        );

        await query(
            "DELETE FROM stock_movements WHERE product_id = ? AND user_id = ?",
            [productId, tenantId]
        );

        const result = await query(
            "DELETE FROM products WHERE id = ? AND user_id = ?",
            [productId, tenantId]
        );

        if (result.affectedRows === 0) {
            throw new ServiceError(404, "Product not found");
        }
    });

    return { message: "Product deleted" };
}

function buildSaleAuditGroups(rows) {
    const grouped = new Map();

    for (const row of rows) {
        const saleItemId = Number(row.sale_item_id);

        if (!grouped.has(saleItemId)) {
            grouped.set(saleItemId, []);
        }

        grouped.get(saleItemId).push(row);
    }

    const sales = new Map();

    for (const [saleItemId, allocations] of grouped) {
        const first = allocations[0];
        const baseQuantity = toNumber(first.base_quantity) || allocations.reduce(
            (sum, row) => sum + toNumber(row.quantity),
            0
        );
        const revenueAmount = toMoney(first.total_amount);
        let allocatedRevenue = 0;
        const mappedAllocations = allocations.map((row, index) => {
            const quantity = roundQuantity(row.quantity);
            const revenue = index === allocations.length - 1
                ? toMoney(revenueAmount - allocatedRevenue)
                : toMoney(baseQuantity > 0 ? revenueAmount * quantity / baseQuantity : 0);
            allocatedRevenue = toMoney(allocatedRevenue + revenue);
            const costAmount = toMoney(row.cost_amount);

            return {
                id: Number(row.id),
                batch_id: Number(row.batch_id),
                quantity,
                base_unit: row.base_unit || row.batch_base_unit || "piece",
                unit_cost: roundUnitCost(row.unit_cost),
                cost_amount: costAmount,
                revenue_amount: revenue,
                profit_amount: toMoney(revenue - costAmount),
                received_at: row.batch_received_at,
                supplier: row.supplier || null,
                batch_sale_price: row.batch_sale_price == null
                    ? null
                    : toMoney(row.batch_sale_price),
                batch_sale_unit: row.batch_sale_unit || row.sale_unit || "piece",
                color: row.color || "",
                size: row.size || ""
            };
        });
        const costAmount = toMoney(
            mappedAllocations.reduce((sum, row) => sum + row.cost_amount, 0)
        );

        sales.set(saleItemId, {
            sale_id: Number(first.sale_id),
            sale_item_id: saleItemId,
            sale_quantity: roundQuantity(first.sale_quantity),
            base_quantity: roundQuantity(baseQuantity),
            base_unit: first.base_unit || "piece",
            sale_unit: first.sale_unit || "piece",
            unit_conversion: roundQuantity(first.unit_conversion || 1),
            unit_price: toMoney(first.unit_price),
            revenue_amount: revenueAmount,
            cost_amount: costAmount,
            profit_amount: toMoney(revenueAmount - costAmount),
            sold_at: first.sold_at,
            reversed: Boolean(first.reversed_at),
            reversed_at: first.reversed_at || null,
            reversal_note: first.reversal_note || null,
            allocations: mappedAllocations
        });
    }

    return sales;
}

async function getLedger(tenantId, productId) {
    const product = await getProduct(tenantId, productId);
    const [movements, allocationRows, stockValueRows] = await Promise.all([
        query(
        `
        SELECT
            stock_movements.id,
            stock_movements.type,
            stock_movements.quantity,
            stock_movements.unit_cost,
            stock_movements.note,
            stock_movements.created_at,
            stock_movements.sale_item_id,
            stock_movements.color,
            stock_movements.size,
            suppliers.name AS supplier,
            inventory_batches.id AS batch_id,
            inventory_batches.initial_quantity AS batch_initial_quantity,
            inventory_batches.remaining_quantity AS batch_remaining_quantity,
            inventory_batches.unit_cost AS batch_unit_cost,
            inventory_batches.sale_price_snapshot AS batch_sale_price,
            inventory_batches.base_unit_snapshot AS batch_base_unit,
            inventory_batches.sale_unit_snapshot AS batch_sale_unit,
            inventory_batches.unit_conversion_snapshot AS batch_unit_conversion,
            inventory_batches.received_at AS batch_received_at
        FROM stock_movements
        LEFT JOIN suppliers ON suppliers.id = stock_movements.supplier_id
        LEFT JOIN inventory_batches ON inventory_batches.stock_movement_id = stock_movements.id
        WHERE stock_movements.user_id = ? AND stock_movements.product_id = ?
        ORDER BY stock_movements.id ASC
        `,
        [tenantId, productId]
        ),
        query(
            `
            SELECT
                audit.*,
                inventory_batches.received_at AS batch_received_at,
                inventory_batches.sale_price_snapshot AS batch_sale_price,
                inventory_batches.base_unit_snapshot AS batch_base_unit,
                inventory_batches.sale_unit_snapshot AS batch_sale_unit,
                suppliers.name AS supplier
            FROM sale_allocation_audit audit
            INNER JOIN inventory_batches ON inventory_batches.id = audit.batch_id
            LEFT JOIN suppliers ON suppliers.id = inventory_batches.supplier_id
            WHERE audit.user_id = ? AND audit.product_id = ?
            ORDER BY audit.sale_item_id, inventory_batches.received_at, audit.batch_id
            `,
            [tenantId, productId]
        ),
        query(
            `
            SELECT COALESCE(SUM(remaining_quantity * unit_cost), 0) AS stock_value
            FROM inventory_batches
            WHERE user_id = ? AND product_id = ?
            `,
            [tenantId, productId]
        )
    ]);
    const saleAudits = buildSaleAuditGroups(allocationRows);

    let balance = 0;
    let totalIn = 0;
    let totalOut = 0;
    const rows = movements.map((row) => {
        const quantity = toNumber(row.quantity);
        const direction = stockDirection(row.type);
        const inbound = direction > 0 ? quantity : 0;
        const outbound = direction < 0 ? quantity : 0;
        balance += direction * quantity;
        totalIn += inbound;
        totalOut += outbound;

        const saleAudit = row.type === "sale" && row.sale_item_id
            ? saleAudits.get(Number(row.sale_item_id))
            : null;

        return {
            id: row.id,
            key: `movement-${row.id}`,
            type: row.type,
            quantity,
            inbound,
            outbound,
            balance,
            note: row.note,
            supplier: row.supplier || null,
            color: row.color || "",
            size: row.size || "",
            created_at: row.created_at,
            batch_id: row.batch_id == null ? null : Number(row.batch_id),
            batch_initial_quantity: row.batch_initial_quantity == null
                ? null
                : roundQuantity(row.batch_initial_quantity),
            batch_remaining_quantity: row.batch_remaining_quantity == null
                ? null
                : roundQuantity(row.batch_remaining_quantity),
            unit_cost: row.batch_unit_cost == null
                ? row.unit_cost == null ? null : roundUnitCost(row.unit_cost)
                : roundUnitCost(row.batch_unit_cost),
            sale_price_snapshot: row.batch_sale_price == null
                ? null
                : toMoney(row.batch_sale_price),
            base_unit: row.batch_base_unit || product.base_unit,
            sale_unit: row.batch_sale_unit || product.sale_unit,
            unit_conversion: row.batch_unit_conversion == null
                ? Number(product.units_per_sale_unit || 1)
                : roundQuantity(row.batch_unit_conversion),
            received_at: row.batch_received_at || row.created_at,
            ...(saleAudit || {})
        };
    });

    const activeSales = [...saleAudits.values()].filter((sale) => !sale.reversed);
    const totalRevenue = toMoney(
        activeSales.reduce((sum, sale) => sum + sale.revenue_amount, 0)
    );
    const totalCost = toMoney(
        activeSales.reduce((sum, sale) => sum + sale.cost_amount, 0)
    );

    return {
        product,
        totalIn,
        totalOut,
        totalRevenue,
        totalCost,
        totalProfit: toMoney(totalRevenue - totalCost),
        stockValue: toMoney(stockValueRows[0]?.stock_value || 0),
        rows
    };
}

module.exports = {
    getProduct,
    listProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    getLedger,
    attachCatalog
};
