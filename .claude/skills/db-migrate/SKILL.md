---
name: db-migrate
description: Use this skill whenever the user wants to run, apply, or check database migrations in the jishono-backend repo. Trigger for requests like "run migrations", "apply pending migrations", "create a new migration", "roll back migration", "check migration status", "what migrations are pending", or "migrate the database". Also trigger when a new feature requires schema changes and the user wants help creating a migration file.
---

# Database Migrations — jishono-backend

This project uses **node-pg-migrate**. Migration files live in `migrations/` and are plain SQL with `-- Up Migration` and `-- Down Migration` sections.

## 1. List existing migrations

Before doing anything, show the user what's there:

```bash
ls -1 migrations/
```

## 2. Apply pending migrations

Run locally:
```bash
npm run migrate:up
```

Or inside Docker (if the user is working via Docker):
```bash
docker compose exec jishono-api npm run migrate:up
```

**When to use Docker**: if the user mentions Docker, or if there's a running container. Otherwise default to local.

## 3. Create a new migration

Ask the user for a short descriptive name (snake_case, e.g. `add_tags_to_oppslag`), then run:

```bash
npm run migrate:create -- <name>
```

This creates `migrations/<timestamp>_<name>.sql`. Read the file and show the user the path, then tell them to fill in SQL under:
- `-- Up Migration` — the forward change
- `-- Down Migration` — how to reverse it

Remind them: commit the migration in the same PR as the code that depends on it. Never edit a migration after it's applied to production.

## 4. Roll back the last migration

**Always confirm before rolling back** — this is destructive and may cause data loss.

Say something like: "Rolling back will reverse the last migration. This can cause data loss. Shall I proceed?"

If the user confirms:
```bash
npm run migrate:down
```

Or inside Docker:
```bash
docker compose exec jishono-api npm run migrate:down
```

## 5. Check migration status

node-pg-migrate doesn't have a built-in status command, but you can:

1. Show migration files: `ls -1 migrations/`
2. Query the DB for applied migrations (if DB access available):
```sql
SELECT name, run_on FROM pgmigrations ORDER BY run_on DESC LIMIT 20;
```

## Environment note

`DATABASE_URL` must be set for migrations to work. In Docker Compose, it's auto-constructed from other env vars. For local runs outside Docker, it must be set in `.env`:
```
DATABASE_URL=postgres://<user>:<pass>@<host>:<port>/<db>
```

## Rules

- Never edit a migration file that has been applied to production — create a new one instead.
- `relaterte_oppslag` is managed by a weekly cron job — do not create migrations for it.
- Commit migration files in the same PR as the code that depends on them.
