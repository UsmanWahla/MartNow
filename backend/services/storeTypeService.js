const { query, withTransaction } = require("../utils/query");
const { ServiceError } = require("../utils/errors");
const { parseListOptions, like } = require("../utils/list");

function mapStoreType(row) {
    const storeType = {
        id: Number(row.id),
        code: row.code,
        name: row.name
    };

    if (row.is_active !== undefined) {
        storeType.is_active = Number(row.is_active) === 1;
    }

    if (row.store_count !== undefined) {
        storeType.store_count = Number(row.store_count || 0);
    }

    if (row.created_at !== undefined) {
        storeType.created_at = row.created_at;
    }

    if (row.updated_at !== undefined) {
        storeType.updated_at = row.updated_at;
    }

    return storeType;
}

function readStoreTypeName(value) {
    const name = String(value || "").trim().replace(/\s+/g, " ");

    if (name.length < 2 || name.length > 100) {
        throw new ServiceError(400, "Store type name must be between 2 and 100 characters");
    }

    if (!/[\p{L}\p{N}]/u.test(name)) {
        throw new ServiceError(400, "Enter a valid store type name");
    }

    if (name.toLowerCase() === "other") {
        throw new ServiceError(400, "Use a specific store type name instead of Other");
    }

    return name;
}

function readStoreTypeId(value) {
    const storeTypeId = Number(value);

    if (!Number.isInteger(storeTypeId) || storeTypeId <= 0) {
        throw new ServiceError(400, "Choose a valid store type");
    }

    return storeTypeId;
}

function readActiveValue(value) {
    if (value === true || value === 1 || value === "1") {
        return true;
    }

    if (value === false || value === 0 || value === "0") {
        return false;
    }

    throw new ServiceError(400, "Choose a valid store type status");
}

async function assertUniqueName(name, excludeId = 0) {
    const rows = await query(
        "SELECT id FROM store_types WHERE LOWER(name) = LOWER(?) AND id <> ? LIMIT 1",
        [name, excludeId]
    );

    if (rows.length > 0) {
        throw new ServiceError(409, "A store type with this name already exists");
    }
}

function codeRoot(name) {
    const root = String(name)
        .normalize("NFKD")
        .toLowerCase()
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 50);

    return root || "store_type";
}

async function allocateCode(name) {
    const root = codeRoot(name);

    for (let index = 0; index < 100; index += 1) {
        const code = index === 0 ? root : `${root}_${index + 1}`;
        const rows = await query("SELECT id FROM store_types WHERE code = ? LIMIT 1", [code]);

        if (rows.length === 0) {
            return code;
        }
    }

    return `${root.slice(0, 40)}_${Date.now()}`;
}

async function getManagedStoreType(storeTypeId) {
    const rows = await query(
        `
        SELECT
            store_types.id,
            store_types.code,
            store_types.name,
            store_types.is_active,
            store_types.created_at,
            store_types.updated_at,
            COUNT(stores.id) AS store_count
        FROM store_types
        LEFT JOIN stores ON stores.store_type_id = store_types.id
        WHERE store_types.id = ?
        GROUP BY store_types.id
        LIMIT 1
        `,
        [readStoreTypeId(storeTypeId)]
    );

    if (rows.length === 0) {
        throw new ServiceError(404, "Store type not found");
    }

    return mapStoreType(rows[0]);
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

async function listManagedStoreTypes(options = {}) {
    const { search, limitSql } = parseListOptions(options);
    const status = options.status === "active" || options.status === "inactive"
        ? options.status
        : "all";
    const clauses = [];
    const params = [];

    if (search) {
        clauses.push("(store_types.name LIKE ? OR store_types.code LIKE ?)");
        params.push(like(search), like(search));
    }

    if (status !== "all") {
        clauses.push("store_types.is_active = ?");
        params.push(status === "active" ? 1 : 0);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const countRows = await query(
        `SELECT COUNT(*) AS total FROM store_types ${where}`,
        params
    );
    const rows = await query(
        `
        SELECT
            store_types.id,
            store_types.code,
            store_types.name,
            store_types.is_active,
            store_types.created_at,
            store_types.updated_at,
            COUNT(stores.id) AS store_count
        FROM store_types
        LEFT JOIN stores ON stores.store_type_id = store_types.id
        ${where}
        GROUP BY store_types.id
        ORDER BY store_types.is_active DESC, store_types.sort_order, store_types.name
        ${limitSql}
        `,
        params
    );

    return {
        rows: rows.map(mapStoreType),
        total: Number(countRows[0]?.total || 0)
    };
}

async function requireActiveStoreType(value) {
    const storeTypeId = readStoreTypeId(value);

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

async function createStoreType(data) {
    const name = readStoreTypeName(data.name);
    await assertUniqueName(name);
    const code = await allocateCode(name);
    const orderRows = await query("SELECT COALESCE(MAX(sort_order), 0) + 10 AS next_order FROM store_types");

    try {
        const result = await query(
            `
            INSERT INTO store_types (code, name, is_active, sort_order)
            VALUES (?, ?, 1, ?)
            `,
            [code, name, Number(orderRows[0]?.next_order || 10)]
        );

        return {
            message: "Store type added",
            store_type: await getManagedStoreType(result.insertId)
        };
    } catch (error) {
        if (error.code === "ER_DUP_ENTRY") {
            throw new ServiceError(409, "A store type with this name already exists");
        }

        throw error;
    }
}

async function updateStoreType(storeTypeId, data) {
    const id = readStoreTypeId(storeTypeId);
    const name = readStoreTypeName(data.name);

    await withTransaction(async () => {
        const rows = await query("SELECT id FROM store_types WHERE id = ? FOR UPDATE", [id]);

        if (rows.length === 0) {
            throw new ServiceError(404, "Store type not found");
        }

        await assertUniqueName(name, id);

        try {
            await query("UPDATE store_types SET name = ? WHERE id = ?", [name, id]);
        } catch (error) {
            if (error.code === "ER_DUP_ENTRY") {
                throw new ServiceError(409, "A store type with this name already exists");
            }

            throw error;
        }

        await query("UPDATE stores SET store_type = ? WHERE store_type_id = ?", [name, id]);
    });

    return {
        message: "Store type updated",
        store_type: await getManagedStoreType(id)
    };
}

async function setStoreTypeActive(storeTypeId, value) {
    const id = readStoreTypeId(storeTypeId);
    const isActive = readActiveValue(value);

    await withTransaction(async () => {
        const rows = await query(
            "SELECT id, is_active FROM store_types ORDER BY id FOR UPDATE"
        );
        const current = rows.find((row) => Number(row.id) === id);

        if (!current) {
            throw new ServiceError(404, "Store type not found");
        }

        if ((Number(current.is_active) === 1) === isActive) {
            return;
        }

        if (!isActive) {
            const storeRows = await query(
                "SELECT COUNT(*) AS total FROM stores WHERE store_type_id = ?",
                [id]
            );
            const storeCount = Number(storeRows[0]?.total || 0);

            if (storeCount > 0) {
                throw new ServiceError(
                    409,
                    `Change the type of ${storeCount} ${storeCount === 1 ? "store" : "stores"} before deactivating this store type`
                );
            }

            if (rows.filter((row) => Number(row.is_active) === 1).length <= 1) {
                throw new ServiceError(409, "At least one store type must remain active");
            }
        }

        await query("UPDATE store_types SET is_active = ? WHERE id = ?", [isActive ? 1 : 0, id]);
    });

    return {
        message: isActive ? "Store type activated" : "Store type deactivated",
        store_type: await getManagedStoreType(id)
    };
}

module.exports = {
    listActiveStoreTypes,
    listManagedStoreTypes,
    requireActiveStoreType,
    createStoreType,
    updateStoreType,
    setStoreTypeActive
};
