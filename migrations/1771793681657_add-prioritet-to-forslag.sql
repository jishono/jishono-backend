-- Up Migration

ALTER TABLE forslag ADD COLUMN IF NOT EXISTS prioritet smallint NOT NULL DEFAULT 1;

-- Down Migration

ALTER TABLE forslag DROP COLUMN IF EXISTS prioritet;
