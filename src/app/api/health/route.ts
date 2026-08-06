import { createClient } from "redis";
import { jsonResponse } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type ServiceStatus = "ok" | "not_configured" | "error";

type HealthResponse = {
  status: "ok" | "degraded";
  services: {
    app: "ok";
    database: ServiceStatus;
    redis: ServiceStatus;
  };
};

async function checkDatabase(): Promise<ServiceStatus> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "ok";
  } catch {
    return "error";
  }
}

async function checkRedis(): Promise<ServiceStatus> {
  if (!process.env.REDIS_URL) {
    return "not_configured";
  }

  const client = createClient({ url: process.env.REDIS_URL });

  try {
    await client.connect();
    await client.ping();
    return "ok";
  } catch {
    return "error";
  } finally {
    if (client.isOpen) {
      await client.quit();
    }
  }
}

export async function GET() {
  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);
  const status = database === "ok" && redis !== "error" ? "ok" : "degraded";
  const body: HealthResponse = {
    status,
    services: {
      app: "ok",
      database,
      redis,
    },
  };

  return jsonResponse(body, status === "ok" ? 200 : 503);
}
