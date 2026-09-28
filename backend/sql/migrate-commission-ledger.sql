CREATE TABLE IF NOT EXISTS platform_commission_ledger (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_id INT NOT NULL,
    shop_order_id INT NULL,
    sale_id INT NULL,
    entry_type VARCHAR(20) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    note VARCHAR(200) NULL,
    created_by_user_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    FOREIGN KEY (shop_order_id) REFERENCES shop_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uq_commission_ledger_order_entry (shop_order_id, entry_type),
    KEY idx_commission_ledger_store_created (store_id, created_at),
    KEY idx_commission_ledger_type_created (entry_type, created_at)
);

-- Backfill only commissions that have already become payable: delivered and collected orders.
INSERT INTO platform_commission_ledger (
    store_id, shop_order_id, sale_id, entry_type, amount, note
)
SELECT
    stores.id,
    shop_orders.id,
    shop_orders.sale_id,
    'due',
    shop_orders.platform_fee,
    'Delivered and paid order'
FROM shop_orders
INNER JOIN stores ON stores.tenant_user_id = shop_orders.user_id
WHERE shop_orders.delivery_status = 'delivered'
  AND shop_orders.payment_status = 'collected'
  AND shop_orders.platform_fee > 0
  AND NOT EXISTS (
      SELECT 1
      FROM platform_commission_ledger ledger
      WHERE ledger.shop_order_id = shop_orders.id
        AND ledger.entry_type = 'due'
  );
