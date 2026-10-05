ALTER TABLE users
    ADD COLUMN phone VARCHAR(30) NULL AFTER email;

CREATE TABLE IF NOT EXISTS customer_addresses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shopper_user_id INT NOT NULL,
    label VARCHAR(40) NOT NULL DEFAULT 'Home',
    recipient_name VARCHAR(100) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    address VARCHAR(250) NOT NULL,
    city VARCHAR(80) NOT NULL,
    latitude DECIMAL(10, 7) NULL,
    longitude DECIMAL(10, 7) NULL,
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (shopper_user_id) REFERENCES users(id) ON DELETE CASCADE,
    KEY idx_customer_addresses_owner (shopper_user_id, is_default, id)
);

ALTER TABLE shop_orders
    ADD COLUMN customer_address_id INT NULL AFTER shopper_user_id;

ALTER TABLE shop_orders
    ADD COLUMN latitude DECIMAL(10, 7) NULL AFTER city;

ALTER TABLE shop_orders
    ADD COLUMN longitude DECIMAL(10, 7) NULL AFTER latitude;

ALTER TABLE shop_orders
    ADD INDEX idx_shop_orders_shopper (shopper_user_id, created_at, id);

ALTER TABLE customers
    ADD INDEX idx_customers_account_user (account_user_id, user_id);

ALTER TABLE shop_orders
    ADD CONSTRAINT fk_shop_orders_customer_address
    FOREIGN KEY (customer_address_id) REFERENCES customer_addresses(id) ON DELETE SET NULL;

UPDATE users
INNER JOIN (
    SELECT account_user_id, MAX(id) AS customer_id
    FROM customers
    WHERE account_user_id IS NOT NULL
      AND phone IS NOT NULL
      AND TRIM(phone) <> ''
    GROUP BY account_user_id
) latest_customer ON latest_customer.account_user_id = users.id
INNER JOIN customers ON customers.id = latest_customer.customer_id
SET users.phone = customers.phone
WHERE (users.phone IS NULL OR TRIM(users.phone) = '')
  AND users.role IN ('customer', 'shopper');

INSERT INTO customer_addresses (
    shopper_user_id, label, recipient_name, phone, address, city,
    latitude, longitude, is_default
)
SELECT
    customers.account_user_id,
    'Home',
    COALESCE(NULLIF(TRIM(customers.name), ''), users.name),
    COALESCE(NULLIF(TRIM(customers.phone), ''), users.phone, ''),
    customers.address,
    COALESCE(customers.city, ''),
    NULL,
    NULL,
    1
FROM customers
INNER JOIN (
    SELECT account_user_id, MAX(id) AS customer_id
    FROM customers
    WHERE account_user_id IS NOT NULL
      AND address IS NOT NULL
      AND TRIM(address) <> ''
    GROUP BY account_user_id
) latest_customer ON latest_customer.customer_id = customers.id
INNER JOIN users ON users.id = customers.account_user_id
WHERE NOT EXISTS (
    SELECT 1
    FROM customer_addresses
    WHERE customer_addresses.shopper_user_id = customers.account_user_id
);
