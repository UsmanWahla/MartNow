const { query } = require("../utils/query");
const { toMoney } = require("../utils/http");
const { ServiceError } = require("../utils/errors");
const { roundQuantity, roundUnitCost } = require("../utils/productUnits");

const EPSILON = 0.0005;

function normalizeOption(value) {
    return String(value || "").trim();
}

function readReceivedAt(value) {
    const text = String(value || "").trim();

    if (!text) {
        return null;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        throw new ServiceError(400, "Purchase date is invalid");
    }

    return `${text} 00:00:00`;
}

async function createBatch({
    tenantId,
    actorId,
    productId,
    movementId = null,
    supplierId = null,
    color = "",
    size = "",
    quantity,
    unitCost,
    receivedAt = null
}) {
    const batchQuantity = roundQuantity(quantity);
    const cost = roundUnitCost(unitCost);

    if (batchQuantity <= 0 || cost < 0) {
        throw new ServiceError(400, "Batch quantity and cost are invalid");
    }

    const result = await query(
        `
        INSERT INTO inventory_batches (
            user_id, product_id, stock_movement_id, supplier_id, color, size,
            initial_quantity, remaining_quantity, unit_cost, received_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?)
        `,
        [
            tenantId,
            productId,
            movementId,
            supplierId || null,
            normalizeOption(color),
            normalizeOption(size),
            batchQuantity,
            batchQuantity,
            cost,
            readReceivedAt(receivedAt),
            actorId || null
        ]
    );

    return result.insertId;
}

async function allocateFifo({
    tenantId,
    productId,
    color = "",
    size = "",
    quantity,
    saleItemId = null,
    stockMovementId = null
}) {
    const requested = roundQuantity(quantity);

    if (requested <= 0 || (!saleItemId && !stockMovementId)) {
        throw new ServiceError(400, "FIFO allocation source is invalid");
    }

    const batches = await query(
        `
        SELECT id, remaining_quantity, unit_cost
        FROM inventory_batches
        WHERE user_id = ? AND product_id = ? AND color = ? AND size = ?
          AND remaining_quantity > 0
        ORDER BY received_at ASC, id ASC
        FOR UPDATE
        `,
        [tenantId, productId, normalizeOption(color), normalizeOption(size)]
    );
    const available = roundQuantity(
        batches.reduce((sum, batch) => sum + Number(batch.remaining_quantity || 0), 0)
    );

    if (available + EPSILON < requested) {
        throw new ServiceError(400, "Inventory batches do not contain enough stock");
    }

    let remaining = requested;
    let costAmount = 0;

    for (const batch of batches) {
        if (remaining <= EPSILON) {
            break;
        }

        const take = roundQuantity(Math.min(remaining, Number(batch.remaining_quantity)));

        if (take <= 0) {
            continue;
        }

        const allocationCost = toMoney(take * roundUnitCost(batch.unit_cost));
        await query(
            "UPDATE inventory_batches SET remaining_quantity = remaining_quantity - ? WHERE id = ?",
            [take, batch.id]
        );

        if (saleItemId) {
            await query(
                `
                INSERT INTO sale_item_allocations
                    (sale_item_id, batch_id, quantity, unit_cost, cost_amount)
                VALUES (?, ?, ?, ?, ?)
                `,
                [saleItemId, batch.id, take, roundUnitCost(batch.unit_cost), allocationCost]
            );
        } else {
            await query(
                `
                INSERT INTO stock_movement_allocations
                    (stock_movement_id, batch_id, quantity, unit_cost)
                VALUES (?, ?, ?, ?)
                `,
                [stockMovementId, batch.id, take, roundUnitCost(batch.unit_cost)]
            );
        }

        costAmount = toMoney(costAmount + allocationCost);
        remaining = roundQuantity(remaining - take);
    }

    if (remaining > EPSILON) {
        throw new ServiceError(400, "Unable to allocate the complete FIFO quantity");
    }

    return { quantity: requested, costAmount };
}

async function restoreAllocations(table, sourceColumn, sourceId) {
    const rows = await query(
        `
        SELECT allocations.batch_id, allocations.quantity
        FROM ${table} allocations
        INNER JOIN inventory_batches batches ON batches.id = allocations.batch_id
        WHERE allocations.${sourceColumn} = ?
        ORDER BY allocations.id
        FOR UPDATE
        `,
        [sourceId]
    );
    let restored = 0;

    for (const row of rows) {
        await query(
            `
            UPDATE inventory_batches
            SET remaining_quantity = LEAST(initial_quantity, remaining_quantity + ?)
            WHERE id = ?
            `,
            [row.quantity, row.batch_id]
        );
        restored = roundQuantity(restored + Number(row.quantity));
    }

    await query(`DELETE FROM ${table} WHERE ${sourceColumn} = ?`, [sourceId]);
    return restored;
}

function restoreSaleItemAllocations(saleItemId) {
    return restoreAllocations("sale_item_allocations", "sale_item_id", saleItemId);
}

function restoreMovementAllocations(stockMovementId) {
    return restoreAllocations(
        "stock_movement_allocations",
        "stock_movement_id",
        stockMovementId
    );
}

async function removeUnusedInboundBatch(stockMovementId) {
    const rows = await query(
        `
        SELECT id, initial_quantity, remaining_quantity
        FROM inventory_batches
        WHERE stock_movement_id = ?
        FOR UPDATE
        `,
        [stockMovementId]
    );

    if (rows.length === 0) {
        return false;
    }

    if (
        Math.abs(Number(rows[0].initial_quantity) - Number(rows[0].remaining_quantity)) > EPSILON
    ) {
        throw new ServiceError(
            400,
            "This stock-in batch has already been used and cannot be changed or deleted"
        );
    }

    await query("DELETE FROM inventory_batches WHERE id = ?", [rows[0].id]);
    return true;
}

async function updateInboundBatchDetails(stockMovementId, { supplierId, unitCost, receivedAt }) {
    const rows = await query(
        `
        SELECT id, initial_quantity, remaining_quantity, unit_cost
        FROM inventory_batches
        WHERE stock_movement_id = ?
        FOR UPDATE
        `,
        [stockMovementId]
    );

    if (rows.length === 0) {
        return;
    }

    const nextCost = roundUnitCost(unitCost ?? rows[0].unit_cost);
    const costChanged = Math.abs(nextCost - Number(rows[0].unit_cost)) > 0.00005;
    const used =
        Math.abs(Number(rows[0].initial_quantity) - Number(rows[0].remaining_quantity)) > EPSILON;

    if (costChanged && used) {
        throw new ServiceError(400, "Cost cannot change after stock from this batch has been sold");
    }

    await query(
        `
        UPDATE inventory_batches
        SET supplier_id = ?, unit_cost = ?, received_at = COALESCE(?, received_at)
        WHERE id = ?
        `,
        [supplierId || null, nextCost, readReceivedAt(receivedAt), rows[0].id]
    );
}

module.exports = {
    createBatch,
    allocateFifo,
    restoreSaleItemAllocations,
    restoreMovementAllocations,
    removeUnusedInboundBatch,
    updateInboundBatchDetails
};
