-- Safe to re-run via migrate-indexes.js (duplicate index names are skipped).

ALTER TABLE products ADD INDEX idx_products_user_id (user_id);
ALTER TABLE products ADD INDEX idx_products_created (created_at);
ALTER TABLE products ADD UNIQUE INDEX uq_products_user_name (user_id, name);
ALTER TABLE products ADD UNIQUE INDEX uq_products_user_sku (user_id, sku);

ALTER TABLE sales ADD INDEX idx_sales_user_id (user_id);
ALTER TABLE sales ADD INDEX idx_sales_created (created_at);
ALTER TABLE sales ADD INDEX idx_sales_customer (customer_id);

ALTER TABLE sale_items ADD INDEX idx_sale_items_sale (sale_id);
ALTER TABLE sale_items ADD INDEX idx_sale_items_product (product_id);

ALTER TABLE customers ADD INDEX idx_customers_user_id (user_id);
ALTER TABLE suppliers ADD INDEX idx_suppliers_user_id (user_id);

ALTER TABLE expenses ADD INDEX idx_expenses_user_id (user_id);
ALTER TABLE expenses ADD INDEX idx_expenses_created (created_at);

ALTER TABLE stock_movements ADD INDEX idx_stock_user_id (user_id);
ALTER TABLE stock_movements ADD INDEX idx_stock_created (created_at);

ALTER TABLE refresh_tokens ADD INDEX idx_refresh_user (user_id);
