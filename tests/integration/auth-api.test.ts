import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { GET as getMe } from "@/app/api/auth/me/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as register } from "@/app/api/auth/register/route";
import { prisma } from "@/lib/prisma";
import { bearer, getRequest, jsonRequest, readJson } from "../helpers/api";

type AuthResponse = {
  user: {
    id: string;
    name: string;
    email: string;
  };
  token: string;
};

describe("auth API", () => {
  beforeEach(async () => {
    process.env.JWT_SECRET = "test-secret-for-auth-api";
    await prisma.user.deleteMany({
      where: { email: { in: ["api-user@liveboard.test"] } },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("registers, logs in, and returns the current user", async () => {
    const registerResponse = await register(
      jsonRequest({
        name: "API User",
        email: "api-user@liveboard.test",
        password: "LiveBoardDemo123!",
      }),
    );

    expect(registerResponse.status).toBe(201);
    const registered = await readJson<AuthResponse>(registerResponse);
    expect(registered.user.email).toBe("api-user@liveboard.test");
    expect(registered.token).toEqual(expect.any(String));

    const loginResponse = await login(
      jsonRequest({
        email: "api-user@liveboard.test",
        password: "LiveBoardDemo123!",
      }),
    );

    expect(loginResponse.status).toBe(200);
    const loggedIn = await readJson<AuthResponse>(loginResponse);
    expect(loggedIn.user.id).toBe(registered.user.id);

    const meResponse = await getMe(getRequest(loggedIn.token));
    expect(meResponse.status).toBe(200);
    await expect(readJson<AuthResponse>(meResponse)).resolves.toMatchObject({
      user: {
        email: "api-user@liveboard.test",
      },
    });
  });

  it("rejects requests without a bearer token", async () => {
    const response = await getMe(
      new Request("http://localhost/test", {
        headers: bearer("bad-token"),
      }),
    );

    expect(response.status).toBe(401);
  });
});
