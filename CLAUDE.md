# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

REST API backend for [jisho.no](https://jisho.no) (Norwegian-Japanese dictionary) and [baksida.jisho.no](https://baksida.jisho.no) (admin/community interface). Built with Node.js + Express, backed by PostgreSQL.

## Running the Server

```bash
# Start with nodemon (auto-reload)
nodemon server.js

# Or plain node
node server.js
```

Server runs on port 3001 by default.

## Local Development with Docker

```bash
# Start with local postgres included
docker compose -f docker-compose.yaml -f docker-compose.dev.yaml up

# Production-style (no local postgres, expects external DB)
docker compose up
```

The dev compose override adds a local PostgreSQL 18 container and mounts the source directory for live reloading.

## Environment Variables

Required in `.env`:
```
NODE_ENV=development
DB_HOST_NODE=
DB_PORT_NODE=5432
DB_USER_ADMIN_NODE=
DB_NAME_NODE=
DB_PASS_ADMIN_NODE=
JWT_SECRET=
NODEMAILER_USER=
NODEMAILER_PASSWORD=
```

## Architecture

### Request Flow

```
server.js → app/routes/routes.js → [auth middleware] → [admin middleware] → controller → service → db/database.js → PostgreSQL
```

- **`server.js`**: Entry point. Configures Express, CORS (wildcard in dev, domain-restricted in prod), EJS views, and starts cron jobs.
- **`app/routes/routes.js`**: All route definitions in one file.
- **`app/routes/auth.js`**: JWT middleware (`auth`). Decodes token and sets `res.locals.user_id` and `res.locals.decoded_token`.
- **`app/routes/admin.js`**: Admin middleware. Checks `decoded_token.admin === 1`. Must run after `auth`.
- **`app/controllers/`**: Thin controllers that parse request params and delegate to services.
- **`app/services/`**: Business logic. `oppslagService`, `forslagService`, `userService`, `appService`.
- **`app/db/database.js`**: PostgreSQL connection pool wrapper. Exposes `query(text, params)` and `bulkInsert(baseQuery, rows, columnsPerRow, onConflict)`. Raw SQL throughout — no ORM.
- **`app/cron/jobs.js`**: Scheduled digest emails (daily at 17:00, weekly at 18:00 Sunday, biweekly at 19:00 Sunday) and weekly `generateRelatedWords()` job at 04:00 Sunday. Email is disabled in dev (`NODE_ENV !== 'development'` check in appService).
- **`app/views/`**: EJS templates used for email bodies.
- **`app/locale/msg.json`**: Error/response message strings (Norwegian).

### Route Auth Patterns

- **Public** (no middleware): `/items/all`, `/suggestion_list`, `/search/:query`, `/statistikk`, login/register
- **Authenticated** (`auth`): Most baksida routes
- **Admin** (`auth` + `admin`): `/update/:id`, `/forslag/:id/godkjenn`, `/forslag/:id/avvis`, `/brukere`, `/pagevisits`, word suggestion accept/reject

### Domain Terminology

The codebase uses Norwegian terminology:
- **oppslag** = dictionary entry/lookup
- **forslag** = suggestion/proposal
- **boyning** = word conjugation/inflection
- **bruker** = user
- **veggen** = "the wall" (community feed)
- **anbefalinger** = recommendations
- **baksida** = the admin/community backend interface
