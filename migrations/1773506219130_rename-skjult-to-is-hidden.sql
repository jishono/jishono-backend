-- Up Migration

ALTER TABLE oppslag ALTER COLUMN skjult DROP DEFAULT;
ALTER TABLE oppslag ALTER COLUMN skjult TYPE boolean USING (skjult = 1);
ALTER TABLE oppslag ALTER COLUMN skjult SET DEFAULT false;
ALTER TABLE oppslag RENAME COLUMN skjult TO is_hidden;

-- Down Migration

ALTER TABLE oppslag RENAME COLUMN is_hidden TO skjult;
ALTER TABLE oppslag ALTER COLUMN skjult DROP DEFAULT;
ALTER TABLE oppslag ALTER COLUMN skjult TYPE smallint USING (skjult::int);
ALTER TABLE oppslag ALTER COLUMN skjult SET DEFAULT 0;
