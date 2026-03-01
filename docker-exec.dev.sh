#!/bin/sh

LOCKFILE=/usr/src/app/package-lock.json
HASH_FILE=/usr/src/app/node_modules/.install-hash

current=$(md5sum "$LOCKFILE" | cut -d' ' -f1)
stored=$(cat "$HASH_FILE" 2>/dev/null || echo "")

if [ "$current" != "$stored" ]; then
  echo "[dev] package-lock.json changed -- running npm ci..."
  npm ci
  echo "$current" > "$HASH_FILE"
fi

exec node server.js
