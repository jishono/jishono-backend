#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

set -a
source <(sed $'s/\r//' "$ROOT/.env.prod")
set +a

LOCAL_DB_URL="postgres://postgres:example@localhost:5432/jishono"

echo "This will WIPE your local database and restore from production."
read -p "Continue? [y/N] " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 1; }

echo "Recreating local database..."
PGPASSWORD=example psql "postgres://postgres:example@localhost:5432/postgres" \
  -c "DROP DATABASE IF EXISTS jishono;" \
  -c "CREATE DATABASE jishono;"

echo "Streaming dump from production via SSH..."
ssh "${SSH_USER}@${SSH_HOST}" \
  "PGPASSWORD='${PROD_DB_PASS}' /usr/lib/postgresql/18/bin/pg_dump \
    --host='${PROD_DB_HOST}' \
    --port='${PROD_DB_PORT}' \
    --username='${PROD_DB_USER}' \
    --dbname='${PROD_DB_NAME}' \
    --no-owner \
    --no-privileges" \
| PGPASSWORD=example psql "$LOCAL_DB_URL"

echo "Applying pending migrations..."
cd "$ROOT"
npm run migrate:up

echo "Done. Local database restored from production."
