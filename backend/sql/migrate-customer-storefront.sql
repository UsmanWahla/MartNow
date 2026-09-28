ALTER TABLE products
    ADD COLUMN category VARCHAR(60) NULL AFTER description;

ALTER TABLE products
    ADD COLUMN featured TINYINT(1) NOT NULL DEFAULT 0 AFTER category;

ALTER TABLE products
    ADD KEY idx_products_user_category (user_id, category);

ALTER TABLE products
    ADD KEY idx_products_user_featured (user_id, featured, id);
