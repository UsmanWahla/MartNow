-- Per color/size stock (additive)

CREATE TABLE IF NOT EXISTS product_variants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    color VARCHAR(40) NOT NULL DEFAULT '',
    size VARCHAR(40) NOT NULL DEFAULT '',
    stock INT NOT NULL DEFAULT 0,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY uq_product_variant (product_id, color, size)
);

ALTER TABLE stock_movements
    ADD COLUMN color VARCHAR(40) NOT NULL DEFAULT '';

ALTER TABLE stock_movements
    ADD COLUMN size VARCHAR(40) NOT NULL DEFAULT '';
