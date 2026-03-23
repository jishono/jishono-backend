-- Up Migration
ALTER TABLE oppslag ADD COLUMN paradigm_class varchar(20);

-- Down Migration
ALTER TABLE oppslag DROP COLUMN paradigm_class;
