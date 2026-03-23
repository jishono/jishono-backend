-- Up Migration
ALTER TABLE verb_boy ADD COLUMN s_passiv varchar(50);

-- Down Migration
ALTER TABLE verb_boy DROP COLUMN s_passiv;
