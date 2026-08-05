import { describe, expect, it } from "vitest";
import { createSlug } from "@/lib/slug";

describe("createSlug", () => {
  it("normalizes names into URL-safe slugs", () => {
    expect(createSlug(" Product Launch Board ")).toBe("product-launch-board");
    expect(createSlug("Client/API Sync")).toBe("client-api-sync");
  });

  it("falls back when the input has no slug-safe characters", () => {
    expect(createSlug(" !!! ")).toBe("workspace");
  });
});
