ALTER TABLE products
    ADD COLUMN inventory_type VARCHAR(20) NOT NULL DEFAULT 'unit';

ALTER TABLE products
    ADD COLUMN base_unit VARCHAR(20) NOT NULL DEFAULT 'piece';

ALTER TABLE products
    ADD COLUMN sale_unit VARCHAR(20) NOT NULL DEFAULT 'piece';

ALTER TABLE products
    ADD COLUMN quantity_step DECIMAL(14, 3) NOT NULL DEFAULT 1.000;

ALTER TABLE products
    ADD COLUMN units_per_sale_unit DECIMAL(14, 3) NOT NULL DEFAULT 1.000;

ALTER TABLE products MODIFY COLUMN stock DECIMAL(14, 3) NOT NULL DEFAULT 0;
ALTER TABLE products MODIFY COLUMN cost_price DECIMAL(14, 4) NOT NULL DEFAULT 0;
ALTER TABLE product_variants MODIFY COLUMN stock DECIMAL(14, 3) NOT NULL DEFAULT 0;
ALTER TABLE stock_movements MODIFY COLUMN quantity DECIMAL(14, 3) NOT NULL;
ALTER TABLE sales MODIFY COLUMN quantity DECIMAL(14, 3) NOT NULL DEFAULT 0;
ALTER TABLE sale_items MODIFY COLUMN quantity DECIMAL(14, 3) NOT NULL;
ALTER TABLE cart_items MODIFY COLUMN quantity DECIMAL(14, 3) NOT NULL DEFAULT 1;

ALTER TABLE stock_movements
    ADD COLUMN unit_cost DECIMAL(14, 4) NULL;

ALTER TABLE sale_items
    ADD COLUMN base_quantity DECIMAL(14, 3) NULL;

ALTER TABLE sale_items
    ADD COLUMN sale_unit VARCHAR(20) NOT NULL DEFAULT 'piece';

ALTER TABLE sale_items
    ADD COLUMN unit_conversion DECIMAL(14, 3) NOT NULL DEFAULT 1.000;

UPDATE sale_items
SET base_quantity = quantity * unit_conversion
WHERE base_quantity IS NULL;

CREATE TABLE IF NOT EXISTS inventory_batches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    stock_movement_id INT NULL,
    supplier_id INT NULL,
    color VARCHAR(40) NOT NULL DEFAULT '',
    size VARCHAR(40) NOT NULL DEFAULT '',
    initial_quantity DECIMAL(14, 3) NOT NULL,
    remaining_quantity DECIMAL(14, 3) NOT NULL,
    unit_cost DECIMAL(14, 4) NOT NULL DEFAULT 0,
    received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (stock_movement_id) REFERENCES stock_movements(id) ON DELETE SET NULL,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uq_inventory_batch_movement (stock_movement_id),
    KEY idx_inventory_batch_fifo (user_id, product_id, color, size, received_at, id),
    KEY idx_inventory_batch_remaining (product_id, remaining_quantity)
);

CREATE TABLE IF NOT EXISTS sale_item_allocations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sale_item_id INT NOT NULL,
    batch_id INT NOT NULL,
    quantity DECIMAL(14, 3) NOT NULL,
    unit_cost DECIMAL(14, 4) NOT NULL,
    cost_amount DECIMAL(14, 2) NOT NULL,
    FOREIGN KEY (sale_item_id) REFERENCES sale_items(id) ON DELETE CASCADE,
    FOREIGN KEY (batch_id) REFERENCES inventory_batches(id),
    KEY idx_sale_allocations_item (sale_item_id),
    KEY idx_sale_allocations_batch (batch_id)
);

CREATE TABLE IF NOT EXISTS stock_movement_allocations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    stock_movement_id INT NOT NULL,
    batch_id INT NOT NULL,
    quantity DECIMAL(14, 3) NOT NULL,
    unit_cost DECIMAL(14, 4) NOT NULL,
    FOREIGN KEY (stock_movement_id) REFERENCES stock_movements(id) ON DELETE CASCADE,
    FOREIGN KEY (batch_id) REFERENCES inventory_batches(id),
    KEY idx_stock_allocations_movement (stock_movement_id),
    KEY idx_stock_allocations_batch (batch_id)
);

INSERT INTO inventory_batches (
    user_id, product_id, stock_movement_id, supplier_id, color, size,
    initial_quantity, remaining_quantity, unit_cost, received_at, created_by
)
SELECT
    products.user_id,
    products.id,
    NULL,
    NULL,
    product_variants.color,
    product_variants.size,
    product_variants.stock,
    product_variants.stock,
    products.cost_price,
    products.created_at,
    products.user_id
FROM products
INNER JOIN product_variants ON product_variants.product_id = products.id
WHERE product_variants.stock > 0
  AND NOT EXISTS (
      SELECT 1
      FROM inventory_batches batches
      WHERE batches.product_id = products.id
        AND batches.color = product_variants.color
        AND batches.size = product_variants.size
  );

INSERT INTO inventory_batches (
    user_id, product_id, stock_movement_id, supplier_id, color, size,
    initial_quantity, remaining_quantity, unit_cost, received_at, created_by
)
SELECT
    products.user_id,
    products.id,
    NULL,
    NULL,
    '',
    '',
    products.stock,
    products.stock,
    products.cost_price,
    products.created_at,
    products.user_id
FROM products
WHERE products.stock > 0
  AND NOT EXISTS (
      SELECT 1 FROM product_variants WHERE product_variants.product_id = products.id
  )
  AND NOT EXISTS (
      SELECT 1 FROM inventory_batches WHERE inventory_batches.product_id = products.id
  );
