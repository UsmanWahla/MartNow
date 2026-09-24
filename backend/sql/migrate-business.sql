-- Additive upgrades for an existing login_signup_db (does not drop products/sales)

ALTER TABLE users
    ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'owner';

ALTER TABLE users
    ADD COLUMN owner_id INT NULL;

ALTER TABLE products
    ADD COLUMN cost_price DECIMAL(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE sales
    ADD COLUMN unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE sales
    ADD COLUMN unit_cost DECIMAL(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE sales
    ADD COLUMN cost_amount DECIMAL(10, 2) NOT NULL DEFAULT 0;

UPDATE sales
SET
    unit_price = CASE WHEN quantity > 0 THEN total_amount / quantity ELSE 0 END,
    unit_cost = 0,
    cost_amount = 0
WHERE unit_price = 0 AND total_amount > 0;

UPDATE users SET role = 'owner' WHERE role IS NULL OR role = '';

CREATE TABLE IF NOT EXISTS stock_movements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    type VARCHAR(20) NOT NULL,
    quantity INT NOT NULL,
    note VARCHAR(200) NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);
