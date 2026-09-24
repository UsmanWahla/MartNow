-- Product gallery, colors, and sizes (additive)

CREATE TABLE IF NOT EXISTS product_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    path VARCHAR(255) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    KEY idx_product_images_product (product_id)
);

CREATE TABLE IF NOT EXISTS product_colors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    name VARCHAR(40) NOT NULL,
    hex VARCHAR(7) NOT NULL DEFAULT '#0f766e',
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    KEY idx_product_colors_product (product_id)
);

CREATE TABLE IF NOT EXISTS product_sizes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    name VARCHAR(20) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    KEY idx_product_sizes_product (product_id)
);

ALTER TABLE cart_items
    ADD COLUMN color VARCHAR(40) NOT NULL DEFAULT '';

ALTER TABLE cart_items
    ADD COLUMN size VARCHAR(40) NOT NULL DEFAULT '';

ALTER TABLE cart_items
    ADD UNIQUE INDEX uq_cart_user_variant (user_id, product_id, color, size);

ALTER TABLE cart_items
    DROP INDEX uq_cart_user_product;

ALTER TABLE sale_items
    ADD COLUMN color VARCHAR(40) NOT NULL DEFAULT '';

ALTER TABLE sale_items
    ADD COLUMN size VARCHAR(40) NOT NULL DEFAULT '';
