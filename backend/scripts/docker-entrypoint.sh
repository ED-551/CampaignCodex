#!/bin/sh
# Container entrypoint: prepare the database, then hand off to the server.
set -e

node scripts/migrate.js

# Create the first admin account on a fresh install. No-op once an admin exists.
if [ -n "$ADMIN_USERNAME" ] && [ -n "$ADMIN_PASSWORD" ]; then
  node scripts/seed-admin.js
fi

# exec so the server becomes PID 1 and receives SIGTERM from `docker stop`.
exec "$@"
