const { AsyncLocalStorage } = require("node:async_hooks");
const db = require("../db");

const transactionStore = new AsyncLocalStorage();

function activeConnection() {
    return transactionStore.getStore() || db;
}

function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        activeConnection().query(sql, params, (error, results) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(results);
        });
    });
}

function getConnection() {
    return new Promise((resolve, reject) => {
        db.getConnection((error, connection) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(connection);
        });
    });
}

function runOnConnection(connection, method) {
    return new Promise((resolve, reject) => {
        connection[method]((error) => {
            if (error && method !== "rollback") {
                reject(error);
                return;
            }

            resolve();
        });
    });
}

async function withTransaction(work) {
    if (transactionStore.getStore()) {
        return work();
    }

    const connection = await getConnection();

    try {
        await runOnConnection(connection, "beginTransaction");
        const result = await transactionStore.run(connection, work);
        await runOnConnection(connection, "commit");
        return result;
    } catch (error) {
        await runOnConnection(connection, "rollback");
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = {
    query,
    withTransaction
};
