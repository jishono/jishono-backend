-- Up Migration
ALTER TABLE page_traffic ADD COLUMN IF NOT EXISTS visitor_id uuid;

-- Down Migration
ALTER TABLE page_traffic DROP COLUMN IF EXISTS visitor_id;
