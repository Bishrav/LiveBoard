import { describe, expect, it } from "vitest";
import { createInviteToken, hashToken } from "@/lib/tokens";

describe("invite tokens", () => {
  it("creates high-entropy URL-safe tokens", () => {
    const token = createInviteToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(40);
  });

  it("hashes tokens deterministically without leaking the raw token", () => {
    const token = "demo-token";

    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(token);
    expect(hashToken(token)).toHaveLength(64);
  });
});
