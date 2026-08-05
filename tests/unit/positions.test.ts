import { describe, expect, it } from "vitest";
import { nextPosition } from "@/lib/positions";

describe("nextPosition", () => {
  it("starts empty ordered lists at 1000", async () => {
    await expect(nextPosition(async () => null, () => 0)).resolves.toBe(1000);
  });

  it("adds a 1000 gap after the latest position", async () => {
    await expect(
      nextPosition(async () => ({ position: 4000 }), (item) => item.position),
    ).resolves.toBe(5000);
  });
});
