const { query, withTransaction } = require("./query");

function sqlIn(ids) {
    return ids.map(() => "?").join(",");
}

async function deleteWhereIn(table, column, ids) {
    if (ids.length === 0) {
        return;
    }

    await query(`DELETE FROM ${table} WHERE ${column} IN (${sqlIn(ids)})`, ids);
}

/** Removes a store tenant (owner), staff, catalog, sales, and store row from the database. */
async function deleteTenantData(tenantId, { storeId = null } = {}) {
    const staffRows = await query("SELECT id FROM users WHERE owner_id = ?", [tenantId]);
    const staffIds = staffRows.map((row) => row.id);
    const storeUserIds = [tenantId, ...staffIds];
    const productRows = await query("SELECT id FROM products WHERE user_id = ?", [tenantId]);
    const productIds = productRows.map((row) => row.id);
    const saleRows = await query("SELECT id FROM sales WHERE user_id = ?", [tenantId]);
    const saleIds = saleRows.map((row) => row.id);

    await withTransaction(async () => {
        await deleteWhereIn("cart_items", "product_id", productIds);
        await deleteWhereIn("cart_items", "user_id", storeUserIds);
        await query("DELETE FROM shop_orders WHERE user_id = ?", [tenantId]);
        await deleteWhereIn("sale_items", "sale_id", saleIds);
        await query("DELETE FROM sales WHERE user_id = ?", [tenantId]);
        await query("DELETE FROM stock_movements WHERE user_id = ?", [tenantId]);
        await query("DELETE FROM expenses WHERE user_id = ?", [tenantId]);
        await query("DELETE FROM suppliers WHERE user_id = ?", [tenantId]);

        if (storeUserIds.length > 0) {
            await query(
                `UPDATE customers SET account_user_id = NULL WHERE account_user_id IN (${sqlIn(storeUserIds)})`,
                storeUserIds
            );
        }

        await query("DELETE FROM customers WHERE user_id = ?", [tenantId]);

        if (storeId != null) {
            await query("DELETE FROM stores WHERE id = ?", [storeId]);
        } else {
            await query("DELETE FROM stores WHERE tenant_user_id = ?", [tenantId]);
        }

        await query("DELETE FROM products WHERE user_id = ?", [tenantId]);
        await deleteWhereIn("refresh_tokens", "user_id", storeUserIds);
        await query("DELETE FROM users WHERE owner_id = ?", [tenantId]);
        await query("DELETE FROM users WHERE id = ?", [tenantId]);
    });
}

module.exports = { deleteTenantData };
