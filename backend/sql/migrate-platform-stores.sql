CREATE TABLE IF NOT EXISTS stores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    address VARCHAR(250) NULL,
    latitude DECIMAL(10, 7) NULL,
    longitude DECIMAL(10, 7) NULL,
    contact_name VARCHAR(100) NULL,
    contact_phone VARCHAR(30) NULL,
    logo_path VARCHAR(255) NULL,
    store_description VARCHAR(500) NULL,
    business_hours VARCHAR(160) NULL,
    delivery_note VARCHAR(250) NULL,
    delivery_enabled TINYINT(1) NOT NULL DEFAULT 1,
    commission_percent DECIMAL(5, 2) NOT NULL DEFAULT 0,
    store_type VARCHAR(100) NOT NULL DEFAULT 'Other',
    shop_slug VARCHAR(60) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY uq_stores_tenant (tenant_user_id),
    UNIQUE KEY uq_stores_slug (shop_slug),
    KEY idx_stores_status (status),
    KEY idx_stores_type (store_type)
);

ALTER TABLE shop_orders
    ADD COLUMN commission_percent DECIMAL(5, 2) NOT NULL DEFAULT 0;

ALTER TABLE shop_orders
    ADD COLUMN platform_fee DECIMAL(10, 2) NOT NULL DEFAULT 0;
