#!/bin/sh
set -e

npx prisma migrate deploy

if [ "$RUN_DEMO_SEED" = "true" ]; then
  npm run db:seed
fi

exec "$@"
