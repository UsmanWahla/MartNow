ALTER TABLE inventory_batches
    ADD COLUMN sale_price_snapshot DECIMAL(14, 2) NULL AFTER unit_cost;

ALTER TABLE inventory_batches
    ADD COLUMN base_unit_snapshot VARCHAR(20) NULL AFTER sale_price_snapshot;

ALTER TABLE inventory_batches
    ADD COLUMN sale_unit_snapshot VARCHAR(20) NULL AFTER base_unit_snapshot;

ALTER TABLE inventory_batches
    ADD COLUMN unit_conversion_snapshot DECIMAL(14, 3) NULL AFTER sale_unit_snapshot;

UPDATE inventory_batches
INNER JOIN products ON products.id = inventory_batches.product_id
SET
    inventory_batches.sale_price_snapshot = COALESCE(
        inventory_batches.sale_price_snapshot,
        products.price
    ),
    inventory_batches.base_unit_snapshot = COALESCE(
        inventory_batches.base_unit_snapshot,
        products.base_unit
    ),
    inventory_batches.sale_unit_snapshot = COALESCE(
        inventory_batches.sale_unit_snapshot,
        products.sale_unit
    ),
    inventory_batches.unit_conversion_snapshot = COALESCE(
        inventory_batches.unit_conversion_snapshot,
        products.units_per_sale_unit
    );

ALTER TABLE stock_movements
    ADD COLUMN sale_item_id INT NULL AFTER supplier_id;

ALTER TABLE stock_movements
    ADD INDEX idx_stock_movement_sale_item (sale_item_id);

UPDATE stock_movements
INNER JOIN sale_items
    ON sale_items.product_id = stock_movements.product_id
   AND stock_movements.note LIKE CONCAT('Sale #', sale_items.sale_id, ' %')
   AND sale_items.color = stock_movements.color
   AND sale_items.size = stock_movements.size
SET stock_movements.sale_item_id = sale_items.id
WHERE stock_movements.type = 'sale'
  AND stock_movements.sale_item_id IS NULL;

CREATE TABLE IF NOT EXISTS sale_allocation_audit (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    sale_id INT NOT NULL,
    sale_item_id INT NOT NULL,
    batch_id INT NOT NULL,
    quantity DECIMAL(14, 3) NOT NULL,
    unit_cost DECIMAL(14, 4) NOT NULL,
    cost_amount DECIMAL(14, 2) NOT NULL,
    sale_quantity DECIMAL(14, 3) NOT NULL,
    base_quantity DECIMAL(14, 3) NOT NULL,
    base_unit VARCHAR(20) NOT NULL DEFAULT 'piece',
    sale_unit VARCHAR(20) NOT NULL DEFAULT 'piece',
    unit_conversion DECIMAL(14, 3) NOT NULL DEFAULT 1.000,
    unit_price DECIMAL(14, 2) NOT NULL,
    total_amount DECIMAL(14, 2) NOT NULL,
    color VARCHAR(40) NOT NULL DEFAULT '',
    size VARCHAR(40) NOT NULL DEFAULT '',
    sold_at DATETIME NOT NULL,
    reversed_at DATETIME NULL,
    reversal_note VARCHAR(160) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (batch_id) REFERENCES inventory_batches(id) ON DELETE CASCADE,
    UNIQUE KEY uq_sale_allocation_audit (sale_item_id, batch_id),
    KEY idx_sale_audit_product_date (user_id, product_id, sold_at, id),
    KEY idx_sale_audit_sale (sale_id),
    KEY idx_sale_audit_reversed (reversed_at)
);

INSERT INTO sale_allocation_audit (
    user_id, product_id, sale_id, sale_item_id, batch_id,
    quantity, unit_cost, cost_amount,
    sale_quantity, base_quantity, base_unit, sale_unit, unit_conversion,
    unit_price, total_amount, color, size, sold_at
)
SELECT
    sales.user_id,
    sale_items.product_id,
    sale_items.sale_id,
    sale_item_allocations.sale_item_id,
    sale_item_allocations.batch_id,
    sale_item_allocations.quantity,
    sale_item_allocations.unit_cost,
    sale_item_allocations.cost_amount,
    sale_items.quantity,
    COALESCE(
        sale_items.base_quantity,
        sale_items.quantity * sale_items.unit_conversion
    ),
    products.base_unit,
    sale_items.sale_unit,
    sale_items.unit_conversion,
    sale_items.unit_price,
    sale_items.total_amount,
    sale_items.color,
    sale_items.size,
    sales.created_at
FROM sale_item_allocations
INNER JOIN sale_items ON sale_items.id = sale_item_allocations.sale_item_id
INNER JOIN sales ON sales.id = sale_items.sale_id
INNER JOIN products ON products.id = sale_items.product_id
WHERE NOT EXISTS (
    SELECT 1
    FROM sale_allocation_audit audit
    WHERE audit.sale_item_id = sale_item_allocations.sale_item_id
      AND audit.batch_id = sale_item_allocations.batch_id
);
