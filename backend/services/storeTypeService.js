const { query } = require("../utils/query");
const { ServiceError } = require("../utils/errors");

function mapStoreType(row) {
    return {
        id: Number(row.id),
        code: row.code,
        name: row.name
    };
}

async function listActiveStoreTypes() {
    const rows = await query(
        `
        SELECT id, code, name
        FROM store_types
        WHERE is_active = 1
        ORDER BY sort_order, name
        `
    );

    return { rows: rows.map(mapStoreType) };
}

async function requireActiveStoreType(value) {
    const storeTypeId = Number(value);

    if (!Number.isInteger(storeTypeId) || storeTypeId <= 0) {
        throw new ServiceError(400, "Choose a valid store type");
    }

    const rows = await query(
        `
        SELECT id, code, name
        FROM store_types
        WHERE id = ? AND is_active = 1
        LIMIT 1
        `,
        [storeTypeId]
    );

    if (rows.length === 0) {
        throw new ServiceError(400, "Choose a valid store type");
    }

    return mapStoreType(rows[0]);
}

module.exports = { listActiveStoreTypes, requireActiveStoreType };
