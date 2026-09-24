-- Shop daily-work upgrades (does not drop products/sales)

ALTER TABLE users
    ADD COLUMN shop_name VARCHAR(100) NULL;

ALTER TABLE users
    ADD COLUMN low_stock_threshold INT NOT NULL DEFAULT 3;

ALTER TABLE products
    ADD COLUMN sku VARCHAR(50) NULL;

ALTER TABLE sales
    ADD COLUMN customer_id INT NULL;

ALTER TABLE sales
    ADD COLUMN paid_amount DECIMAL(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE sales
    MODIFY product_id INT NULL;

UPDATE sales
SET paid_amount = total_amount
WHERE paid_amount = 0 AND total_amount > 0;

ALTER TABLE stock_movements
    ADD COLUMN supplier_id INT NULL;

CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(30) NULL,
    balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(30) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    note VARCHAR(200) NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS sale_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sale_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    unit_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(10, 2) NOT NULL,
    cost_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(128) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, unit_cost, total_amount, cost_amount)
SELECT id, product_id, quantity, unit_price, unit_cost, total_amount, cost_amount
FROM sales
WHERE product_id IS NOT NULL
AND id NOT IN (SELECT sale_id FROM (SELECT sale_id FROM sale_items) AS existing_items);
