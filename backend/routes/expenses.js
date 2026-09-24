const {
    sendJSON,
    getPath,
    getNumericId,
    getRequestBody,
    getQuery
} = require("../utils/http");
const { fromQuery } = require("../utils/list");
const { requireRole } = require("../middleware/auth");
const { REPORT } = require("../utils/roles");
const expenseService = require("../services/expenseService");

async function handleExpenseRoutes(req, res) {
    const path = getPath(req.url);
    const expenseId = getNumericId(path, "/api/expenses");

    if (req.method === "GET" && path === "/api/expenses") {
        const auth = requireRole(req, res, REPORT);

        if (!auth) {
            return true;
        }

        const expenses = await expenseService.listExpenses(
            auth.tenantId,
            fromQuery(getQuery(req.url))
        );
        sendJSON(req, res, 200, expenses);
        return true;
    }

    if (req.method === "POST" && path === "/api/expenses") {
        const auth = requireRole(req, res, REPORT);

        if (!auth) {
            return true;
        }

        const body = await getRequestBody(req);
        const result = await expenseService.addExpense(auth.tenantId, auth.id, body);
        sendJSON(req, res, 201, result);
        return true;
    }

    if (req.method === "PUT" && expenseId) {
        const auth = requireRole(req, res, REPORT);

        if (!auth) {
            return true;
        }

        const body = await getRequestBody(req);
        const result = await expenseService.updateExpense(
            auth.tenantId,
            expenseId,
            body
        );
        sendJSON(req, res, 200, result);
        return true;
    }

    if (req.method === "DELETE" && expenseId) {
        const auth = requireRole(req, res, REPORT);

        if (!auth) {
            return true;
        }

        const result = await expenseService.deleteExpense(auth.tenantId, expenseId);
        sendJSON(req, res, 200, result);
        return true;
    }

    return false;
}

module.exports = handleExpenseRoutes;
