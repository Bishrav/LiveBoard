import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      DATABASE_URL:
        "postgresql://liveboard:liveboard@localhost:55432/liveboard",
      JWT_SECRET: "test-secret-for-liveboard-suite",
    },
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
