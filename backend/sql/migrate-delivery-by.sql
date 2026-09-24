ALTER TABLE shop_orders
    ADD COLUMN delivery_by VARCHAR(20) NOT NULL DEFAULT 'store';

ALTER TABLE shop_orders
    ADD COLUMN delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 0;
