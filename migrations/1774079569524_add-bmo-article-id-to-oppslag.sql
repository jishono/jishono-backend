-- Up Migration
ALTER TABLE oppslag ADD COLUMN bmo_article_id integer;

-- Down Migration
--ALTER TABLE oppslag DROP COLUMN bmo_article_id;
