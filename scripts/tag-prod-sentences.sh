#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."

set -a
source <(sed $'s/\r//' "$ROOT/.env.prod")
set +a

LOCAL_PORT="${PROD_DB_PORT}"

echo "Opening SSH tunnel on localhost:${LOCAL_PORT}..."
ssh -fNL "${LOCAL_PORT}:${PROD_DB_HOST}:${PROD_DB_PORT}" "${SSH_USER}@${SSH_HOST}"
TUNNEL_PID=$(lsof -ti "TCP:${LOCAL_PORT}" | head -1)
trap 'echo "Closing tunnel..."; kill "$TUNNEL_PID" 2>/dev/null || true' EXIT

ENCODED_PASS=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$PROD_DB_PASS")
export DATABASE_URL="postgres://${PROD_DB_USER}:${ENCODED_PASS}@localhost:${LOCAL_PORT}/${PROD_DB_NAME}"

echo "Running tagging script..."
uv run "$SCRIPT_DIR/tag_example_sentences.py"
