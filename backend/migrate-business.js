const fs = require("fs");
const path = require("path");
const db = require("./db");
const { getStatements } = require("./utils/sqlFile");

function query(sql, params) {
    return new Promise((resolve, reject) => {
        db.query(sql, params || [], (error, results) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(results);
        });
    });
}

async function migrate() {
    const files = [
        "migrate-business.sql",
        "migrate-shop.sql",
        "migrate-shop-store.sql",
        "migrate-product-options.sql",
        "migrate-variant-stock.sql",
        "migrate-stock-note.sql",
        "migrate-platform-stores.sql",
        "migrate-delivery-by.sql",
        "migrate-username.sql"
    ];

    for (const fileName of files) {
        const sqlPath = path.join(__dirname, "sql", fileName);
        const statements = getStatements(fs.readFileSync(sqlPath, "utf8"));

        for (const statement of statements) {
            try {
                await query(statement);
            } catch (error) {
                if (
                    error.code === "ER_DUP_FIELDNAME" ||
                    error.code === "ER_TABLE_EXISTS_ERROR" ||
                    error.code === "ER_FK_DUP_NAME" ||
                    error.code === "ER_DUP_KEYNAME" ||
                    error.code === "ER_CANT_DROP_FIELD_OR_KEY" ||
                    error.errno === 1060 ||
                    error.errno === 1050 ||
                    error.errno === 1061 ||
                    error.errno === 1091
                ) {
                    continue;
                }

                throw error;
            }
        }
    }

    await backfillVariants();
    await backfillStores();
    await require("./utils/ownerUsernames").backfillOwnerUsernames();
    await seedSuperAdmin();
    console.log("Business schema is ready.");
}

async function backfillStores() {
    const owners = await query(
        `
        SELECT id, name, email, shop_name, shop_slug
        FROM users
        WHERE role = 'owner' AND owner_id IS NULL
        `
    );

    for (const owner of owners) {
        const existing = await query("SELECT id FROM stores WHERE tenant_user_id = ?", [owner.id]);

        if (existing.length > 0) {
            continue;
        }

        const slug =
            owner.shop_slug ||
            `${String(owner.shop_name || owner.name || "shop")
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "")
                .slice(0, 40) || "shop"}-${owner.id}`;

        await query(
            `
            INSERT INTO stores (tenant_user_id, name, contact_name, shop_slug, status)
            VALUES (?, ?, ?, ?, 'active')
            `,
            [
                owner.id,
                owner.shop_name || owner.name || "Shop",
                owner.name || "Owner",
                slug
            ]
        );

        if (!owner.shop_slug) {
            await query("UPDATE users SET shop_slug = ?, shop_name = COALESCE(shop_name, ?) WHERE id = ?", [
                slug,
                owner.shop_name || owner.name || "Shop",
                owner.id
            ]);
        }
    }

    await query("UPDATE users SET role = 'customer', owner_id = NULL WHERE role = 'shopper'");
}

async function seedSuperAdmin() {
    const bcrypt = require("bcryptjs");
    const email = String(process.env.SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
    const password = String(process.env.SUPER_ADMIN_PASSWORD || "");
    const name = String(process.env.SUPER_ADMIN_NAME || "Platform Admin").trim();

    if (!email || !password) {
        return;
    }

    const existing = await query("SELECT id FROM users WHERE email = ?", [email]);

    if (existing.length > 0) {
        await query("UPDATE users SET role = 'super_admin', owner_id = NULL WHERE id = ?", [
            existing[0].id
        ]);
        return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await query(
        "INSERT INTO users (name, email, password, role, owner_id) VALUES (?, ?, ?, 'super_admin', NULL)",
        [name, email, hashedPassword]
    );
}

async function backfillVariants() {
    const products = await query("SELECT id, stock FROM products");

    for (const product of products) {
        const existing = await query("SELECT id FROM product_variants WHERE product_id = ?", [
            product.id
        ]);

        if (existing.length > 0) {
            continue;
        }

        const colors = await query("SELECT name FROM product_colors WHERE product_id = ? ORDER BY id", [
            product.id
        ]);
        const sizes = await query(
            "SELECT name FROM product_sizes WHERE product_id = ? ORDER BY sort_order, id",
            [product.id]
        );
        const colorNames = colors.length > 0 ? colors.map((row) => row.name) : [""];
        const sizeNames = sizes.length > 0 ? sizes.map((row) => row.name) : [""];
        let first = true;

        for (const color of colorNames) {
            for (const size of sizeNames) {
                await query(
                    "INSERT INTO product_variants (product_id, color, size, stock) VALUES (?, ?, ?, ?)",
                    [product.id, color, size, first ? Number(product.stock) || 0 : 0]
                );
                first = false;
            }
        }
    }
}

if (require.main === module) {
    migrate()
        .then(() => {
            db.end(() => process.exit(0));
        })
        .catch((error) => {
            console.error("Migration failed:", error.message);
            db.end(() => process.exit(1));
        });
}

module.exports = { migrate };
