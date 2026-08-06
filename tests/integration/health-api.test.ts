import { afterAll, describe, expect, it } from "vitest";
import { GET as getHealth } from "@/app/api/health/route";
import { prisma } from "@/lib/prisma";
import { readJson } from "../helpers/api";

type HealthResponse = {
  status: "ok" | "degraded";
  services: {
    app: "ok";
    database: "ok" | "not_configured" | "error";
    redis: "ok" | "not_configured" | "error";
  };
};

describe("health API", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("reports app, database, and redis readiness", async () => {
    const response = await getHealth();
    const body = await readJson<HealthResponse>(response);

    expect([200, 503]).toContain(response.status);
    expect(body).toMatchObject({
      services: {
        app: "ok",
      },
    });
    expect(["ok", "degraded"]).toContain(body.status);
    expect(["ok", "error"]).toContain(body.services.database);
    expect(["ok", "not_configured", "error"]).toContain(body.services.redis);
  });
});
