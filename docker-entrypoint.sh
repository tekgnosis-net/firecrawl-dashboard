#!/bin/sh
set -e

chown -R node:node /app/data 2>/dev/null || true
chmod 755 /app/data

exec su-exec node "$@"
