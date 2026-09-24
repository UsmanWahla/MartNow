const { query } = require("../utils/query");
const { toMoney } = require("../utils/http");
const { parseListOptions, like } = require("../utils/list");
const { ServiceError } = require("../utils/errors");

async function listExpenses(tenantId, options = {}) {
    const { search, limitSql } = parseListOptions(options);
    const params = [tenantId];
    let where = "WHERE user_id = ?";

    if (search) {
        where += " AND IFNULL(note, '') LIKE ?";
        params.push(like(search));
    }

    const countRows = await query(
        `SELECT COUNT(*) AS n FROM expenses ${where}`,
        params
    );
    const rows = await query(
        `SELECT id, amount, note, created_at FROM expenses ${where} ORDER BY id DESC ${limitSql}`,
        params
    );

    return { rows, total: Number(countRows[0].n) };
}

async function addExpense(tenantId, actorId, data) {
    const expenseAmount = toMoney(data.amount);

    if (expenseAmount <= 0) {
        throw new ServiceError(400, "Expense amount is required");
    }

    const note = String(data.note || "").trim() || null;
    const createdAt = String(data.created_at || "").trim();
    let result;

    if (/^\d{4}-\d{2}-\d{2}$/.test(createdAt)) {
        result = await query(
            "INSERT INTO expenses (user_id, amount, note, created_by, created_at) VALUES (?, ?, ?, ?, ?)",
            [tenantId, expenseAmount, note, actorId, createdAt]
        );
    } else {
        result = await query(
            "INSERT INTO expenses (user_id, amount, note, created_by) VALUES (?, ?, ?, ?)",
            [tenantId, expenseAmount, note, actorId]
        );
    }

    const rows = await query(
        "SELECT id, amount, note, created_at FROM expenses WHERE id = ? AND user_id = ?",
        [result.insertId, tenantId]
    );

    return { message: "Expense added", expense: rows[0] };
}

async function updateExpense(tenantId, expenseId, data) {
    const expenseAmount = toMoney(data.amount);

    if (expenseAmount <= 0) {
        throw new ServiceError(400, "Expense amount is required");
    }

    const note = String(data.note || "").trim() || null;
    const result = await query(
        "UPDATE expenses SET amount = ?, note = ? WHERE id = ? AND user_id = ?",
        [expenseAmount, note, expenseId, tenantId]
    );

    if (result.affectedRows === 0) {
        throw new ServiceError(404, "Expense not found");
    }

    const rows = await query(
        "SELECT id, amount, note, created_at FROM expenses WHERE id = ? AND user_id = ?",
        [expenseId, tenantId]
    );

    return { message: "Expense updated", expense: rows[0] };
}

async function deleteExpense(tenantId, expenseId) {
    const result = await query(
        "DELETE FROM expenses WHERE id = ? AND user_id = ?",
        [expenseId, tenantId]
    );

    if (result.affectedRows === 0) {
        throw new ServiceError(404, "Expense not found");
    }

    return { message: "Expense deleted" };
}

module.exports = { listExpenses, addExpense, updateExpense, deleteExpense };
