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
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}", "server.ts"],
      exclude: ["src/app/page.tsx", "src/app/layout.tsx"],
    },
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
