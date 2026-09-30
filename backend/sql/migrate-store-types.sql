CREATE TABLE IF NOT EXISTS store_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(60) NOT NULL,
    name VARCHAR(100) NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_store_types_code (code),
    UNIQUE KEY uq_store_types_name (name),
    KEY idx_store_types_active_sort (is_active, sort_order, name)
);

INSERT INTO store_types (code, name, is_active, sort_order) VALUES
    ('mart_general', 'Mart / General Store', 1, 10),
    ('grocery_kiryana', 'Grocery / Kiryana Store', 1, 20),
    ('pharmacy_medical', 'Pharmacy / Medical Store', 1, 30),
    ('bakery', 'Bakery', 1, 40),
    ('fruits_vegetables', 'Fruits & Vegetables', 1, 50),
    ('meat_poultry', 'Meat & Poultry', 1, 60),
    ('dairy', 'Dairy Store', 1, 70),
    ('restaurant_fast_food', 'Restaurant / Fast Food', 1, 80),
    ('sweets_confectionery', 'Sweets & Confectionery', 1, 90),
    ('clothing_fashion', 'Clothing / Fashion', 1, 100),
    ('shoes_footwear', 'Shoes & Footwear', 1, 110),
    ('cosmetics_beauty', 'Cosmetics / Beauty', 1, 120),
    ('electronics', 'Electronics', 1, 130),
    ('mobile_accessories', 'Mobile & Accessories', 1, 140),
    ('computers_accessories', 'Computers & Accessories', 1, 150),
    ('home_appliances', 'Home Appliances', 1, 160),
    ('hardware', 'Hardware Store', 1, 170),
    ('furniture_home_decor', 'Furniture & Home Decor', 1, 180),
    ('kitchenware', 'Kitchenware', 1, 190),
    ('books_stationery', 'Books & Stationery', 1, 200),
    ('toys_gifts', 'Toys & Gifts', 1, 210),
    ('jewelry_watches', 'Jewelry & Watches', 1, 220),
    ('auto_parts', 'Auto Parts', 1, 230),
    ('sports_fitness', 'Sports & Fitness', 1, 240),
    ('pet_supplies', 'Pet Supplies', 1, 250),
    ('agriculture_supplies', 'Agriculture / Seeds & Fertilizer', 1, 260),
    ('wholesale_distributor', 'Wholesale / Distributor', 1, 270),
    ('optical', 'Optical Store', 1, 280)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    is_active = VALUES(is_active),
    sort_order = VALUES(sort_order);

UPDATE stores SET store_type = 'Mart / General Store'
WHERE store_type IS NULL OR TRIM(store_type) = '' OR store_type = 'Other';

UPDATE stores SET store_type = 'Pharmacy / Medical Store' WHERE store_type = 'Pharmacy';
UPDATE stores SET store_type = 'Books & Stationery' WHERE store_type = 'Book Shop';
UPDATE stores SET store_type = 'Restaurant / Fast Food' WHERE store_type = 'Food / Restaurant';

INSERT INTO store_types (code, name, is_active, sort_order)
SELECT
    CONCAT('legacy-', SUBSTRING(SHA2(LOWER(TRIM(stores.store_type)), 256), 1, 24)),
    TRIM(stores.store_type),
    0,
    999
FROM stores
LEFT JOIN store_types ON store_types.name = TRIM(stores.store_type)
WHERE store_types.id IS NULL
  AND stores.store_type IS NOT NULL
  AND TRIM(stores.store_type) <> ''
GROUP BY stores.store_type;

ALTER TABLE stores ADD COLUMN store_type_id INT NULL AFTER commission_percent;

UPDATE stores
INNER JOIN store_types ON store_types.name = stores.store_type
SET stores.store_type_id = store_types.id
WHERE stores.store_type_id IS NULL;

UPDATE stores
SET store_type_id = (
    SELECT id FROM store_types WHERE code = 'mart_general' LIMIT 1
)
WHERE store_type_id IS NULL;

ALTER TABLE stores MODIFY COLUMN store_type_id INT NOT NULL;
ALTER TABLE stores MODIFY COLUMN store_type VARCHAR(100) NOT NULL DEFAULT 'Mart / General Store';
ALTER TABLE stores ADD INDEX idx_stores_type_id (store_type_id);
ALTER TABLE stores
    ADD CONSTRAINT fk_stores_store_type
    FOREIGN KEY (store_type_id) REFERENCES store_types(id);
