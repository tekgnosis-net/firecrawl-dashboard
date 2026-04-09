#!/bin/sh
set -e

# Ensure /app/data is writable by the node user.
# When Docker creates a bind-mount directory on the host it is owned by root,
# which causes EACCES for the node user. This entrypoint runs as root, fixes
# ownership if needed, then drops to the node user via su-exec before exec-ing
# the application so PID 1 is the Node process (proper signal handling).
if [ ! -w /app/data ]; then
  echo "Fixing /app/data ownership for node user..."
  chown -R node:node /app/data
fi

exec su-exec node "$@"
