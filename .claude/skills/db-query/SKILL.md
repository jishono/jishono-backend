---
name: db-query
description: Use this skill to run SQL queries against the jishono database. Trigger for requests like "query the database", "run a SQL query", "check the data", "look up rows", "count entries", or any task that requires reading from or writing to the PostgreSQL database. Supports both the local dev database (via Docker) and the prod database (on localhost:5433).
---

# Database Query — jishono-backend

Run SQL queries against the jishono PostgreSQL database.

## Connection details

### Local dev database (default)

Accessed via the Docker `postgres` service. The local dev DB is exposed on **localhost:5432**.

```bash
docker compose exec -T postgres psql -U postgres -d jishono -c "<SQL>"
```

For multi-line or complex queries, use a heredoc:

```bash
docker compose exec -T postgres psql -U postgres -d jishono <<'SQL'
SELECT ...
FROM ...
WHERE ...;
SQL
```

### Production database

The prod database is tunneled/available on **localhost:5433**. Use `psql` directly (not via Docker):
Source the `.env.prod` file first:

```bash
source /Users/pg/kode/jisho/jishono-backend/.env.prod && PGPASSWORD="$DB_PASS_ADMIN_NODE" psql -h localhost -p 5433 -U "$DB_USER_ADMIN_NODE" -d jishono -c "<SQL>"
```

## Which database to use

- Default to **local dev** unless the user explicitly says "prod", "production", or "live".
- Always confirm before running **write operations** (INSERT, UPDATE, DELETE) on prod.
- SELECT queries on prod are safe to run without confirmation.

## Useful tips

- Use `\x` or `--expanded` for wide result sets.
- Use `LIMIT` on exploratory queries to avoid dumping huge tables.
- For CSV output: `psql ... -A -F',' -c "SELECT ..."`
- The `-T` flag on `docker compose exec` is important to avoid TTY issues.

## Key tables

- `oppslag` — dictionary entries (lemma_id, oppslag, boy_tabell, etc.)
- `definisjon` — definitions linked to oppslag via lemma_id
- `boyning` tables — `subst_boy`, `verb_boy`, `adj_boy`, `adv_boy`, `det_boy`, `pron_boy`
- `brukere` — users
- `forslag` — definition suggestions
- `oppslag_forslag` — new entry suggestions
- `veggen_innlegg` — community wall posts
- `page_traffic` — page visit tracking
