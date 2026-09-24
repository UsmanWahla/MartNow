const { query } = require("../utils/query");
const { parseListOptions, like } = require("../utils/list");
const { ServiceError } = require("../utils/errors");

async function listSuppliers(tenantId, options = {}) {
    const { search, limitSql } = parseListOptions(options);
    const params = [tenantId];
    let where = "WHERE user_id = ?";

    if (search) {
        where += " AND (name LIKE ? OR IFNULL(phone, '') LIKE ?)";
        params.push(like(search), like(search));
    }

    const countRows = await query(
        `SELECT COUNT(*) AS n FROM suppliers ${where}`,
        params
    );
    const rows = await query(
        `SELECT id, name, phone FROM suppliers ${where} ORDER BY id DESC ${limitSql}`,
        params
    );

    return { rows, total: Number(countRows[0].n) };
}

async function addSupplier(tenantId, { name, phone }) {
    const supplierName = String(name || "").trim();

    if (!supplierName) {
        throw new ServiceError(400, "Supplier name is required");
    }

    const result = await query(
        "INSERT INTO suppliers (user_id, name, phone) VALUES (?, ?, ?)",
        [tenantId, supplierName, String(phone || "").trim() || null]
    );

    const rows = await query(
        "SELECT id, name, phone FROM suppliers WHERE id = ? AND user_id = ?",
        [result.insertId, tenantId]
    );

    return { message: "Supplier added", supplier: rows[0] };
}

async function updateSupplier(tenantId, supplierId, { name, phone }) {
    const supplierName = String(name || "").trim();

    if (!supplierName) {
        throw new ServiceError(400, "Supplier name is required");
    }

    const result = await query(
        "UPDATE suppliers SET name = ?, phone = ? WHERE id = ? AND user_id = ?",
        [supplierName, String(phone || "").trim() || null, supplierId, tenantId]
    );

    if (result.affectedRows === 0) {
        throw new ServiceError(404, "Supplier not found");
    }

    const rows = await query(
        "SELECT id, name, phone FROM suppliers WHERE id = ? AND user_id = ?",
        [supplierId, tenantId]
    );

    return { message: "Supplier updated", supplier: rows[0] };
}

async function deleteSupplier(tenantId, supplierId) {
    await query(
        "UPDATE stock_movements SET supplier_id = NULL WHERE supplier_id = ? AND user_id = ?",
        [supplierId, tenantId]
    );

    const result = await query(
        "DELETE FROM suppliers WHERE id = ? AND user_id = ?",
        [supplierId, tenantId]
    );

    if (result.affectedRows === 0) {
        throw new ServiceError(404, "Supplier not found");
    }

    return { message: "Supplier deleted" };
}

module.exports = { listSuppliers, addSupplier, updateSupplier, deleteSupplier };
