# Deployment Runbook

LiveBoard uses a custom `server.ts` wrapper for Socket.io, so the production host must run a long-lived Node HTTP process. A single Railway service with Railway Postgres and Redis is the simplest portfolio deployment. Vercel can host the Next.js REST/frontend surface, but it cannot run this Socket.io server as one full realtime app without a separate backend service.

## Recommended Target

- App service: Railway Docker deployment.
- Database: Railway Postgres or Neon.
- Redis: Railway Redis or Upstash Redis.
- Start command: `./docker-entrypoint.sh npm run start:socket`.
- Health check: `/api/health`.
- Live URL: `https://liveboard-production-6a27.up.railway.app`.

## Required Environment Variables

```bash
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=replace-with-a-long-random-production-secret
JWT_EXPIRES_IN=7d
NEXT_PUBLIC_APP_URL=https://your-liveboard-domain
SOCKET_CORS_ORIGIN=https://your-liveboard-domain
NODE_ENV=production
RUN_DEMO_SEED=true
```

## First Deployment Steps

1. Create a Railway project from the GitHub repository.
2. Add PostgreSQL and Redis services.
3. Copy the generated `DATABASE_URL` and `REDIS_URL` into the app service variables.
4. Add the auth and public URL variables listed above.
5. Deploy from `master`; Railway will use `Dockerfile` and `railway.json`.
6. The Docker entrypoint runs production migrations on container startup:

```bash
npx prisma migrate deploy
```

7. Demo data is seeded on startup when `RUN_DEMO_SEED=true`:

```bash
npm run db:seed
```

8. Verify:

```bash
curl https://liveboard-production-6a27.up.railway.app/api/health
```

Expected healthy response:

```json
{
  "status": "ok",
  "services": {
    "app": "ok",
    "database": "ok",
    "redis": "ok"
  }
}
```

## Post-Deploy Portfolio Updates

- README live demo URL is published.
- CV LiveBoard bullet includes the deployed URL.
- Capture one fresh screenshot from the live environment if the UI changes.
