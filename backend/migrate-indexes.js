const { query } = require("./utils/query");
const db = require("./db");

const statements = [
    "ALTER TABLE products ADD INDEX idx_products_user_id (user_id)",
    "ALTER TABLE products ADD INDEX idx_products_created (created_at)",
    "ALTER TABLE sales ADD INDEX idx_sales_user_id (user_id)",
    "ALTER TABLE sales ADD INDEX idx_sales_created (created_at)",
    "ALTER TABLE sales ADD INDEX idx_sales_customer (customer_id)",
    "ALTER TABLE sale_items ADD INDEX idx_sale_items_sale (sale_id)",
    "ALTER TABLE sale_items ADD INDEX idx_sale_items_product (product_id)",
    "ALTER TABLE customers ADD INDEX idx_customers_user_id (user_id)",
    "ALTER TABLE suppliers ADD INDEX idx_suppliers_user_id (user_id)",
    "ALTER TABLE expenses ADD INDEX idx_expenses_user_id (user_id)",
    "ALTER TABLE expenses ADD INDEX idx_expenses_created (created_at)",
    "ALTER TABLE stock_movements ADD INDEX idx_stock_user_id (user_id)",
    "ALTER TABLE stock_movements ADD INDEX idx_stock_created (created_at)",
    "ALTER TABLE refresh_tokens ADD INDEX idx_refresh_user (user_id)",
    "ALTER TABLE products ADD UNIQUE INDEX uq_products_user_name (user_id, name)",
    "ALTER TABLE products ADD UNIQUE INDEX uq_products_user_sku (user_id, sku)"
];

async function run() {
    for (const sql of statements) {
        try {
            await query(sql);
            console.log("OK", sql);
        } catch (error) {
            if (error.errno === 1061 || error.errno === 1062 || error.code === "ER_DUP_KEYNAME") {
                console.log("SKIP", sql);
                continue;
            }

            console.error("FAIL", sql, error.message);
        }
    }

    db.end();
}

run().catch((error) => {
    console.error(error);
    db.end();
    process.exit(1);
});
