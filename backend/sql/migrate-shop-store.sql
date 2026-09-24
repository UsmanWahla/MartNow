-- Online shop storefront (additive, does not drop products/sales)

ALTER TABLE products
    ADD COLUMN image_path VARCHAR(255) NULL;

ALTER TABLE products
    ADD COLUMN description VARCHAR(500) NULL;

ALTER TABLE users
    ADD COLUMN shop_slug VARCHAR(60) NULL;

ALTER TABLE users
    ADD UNIQUE INDEX uq_users_shop_slug (shop_slug);

ALTER TABLE customers
    ADD COLUMN email VARCHAR(120) NULL;

ALTER TABLE customers
    ADD COLUMN account_user_id INT NULL;

ALTER TABLE customers
    ADD COLUMN address VARCHAR(250) NULL;

ALTER TABLE customers
    ADD COLUMN city VARCHAR(80) NULL;

CREATE TABLE IF NOT EXISTS cart_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id),
    UNIQUE KEY uq_cart_user_product (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS shop_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    sale_id INT NULL,
    customer_id INT NOT NULL,
    shopper_user_id INT NOT NULL,
    email VARCHAR(120) NOT NULL,
    phone VARCHAR(30) NULL,
    address VARCHAR(250) NOT NULL,
    city VARCHAR(80) NOT NULL,
    payment_method VARCHAR(20) NOT NULL DEFAULT 'cod',
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    delivery_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE SET NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (shopper_user_id) REFERENCES users(id),
    KEY idx_shop_orders_user (user_id),
    KEY idx_shop_orders_sale (sale_id)
);
