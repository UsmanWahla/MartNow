ALTER TABLE stores
    ADD COLUMN store_description VARCHAR(500) NULL AFTER logo_path;

ALTER TABLE stores
    ADD COLUMN business_hours VARCHAR(160) NULL AFTER store_description;

ALTER TABLE stores
    ADD COLUMN delivery_note VARCHAR(250) NULL AFTER business_hours;
