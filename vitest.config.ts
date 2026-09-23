import { configDefaults, defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    hookTimeout: 30000,
    testTimeout: 30000,
    maxWorkers: 2,
    setupFiles: ["./vitest.setup.ts"],
    exclude: [
      ...configDefaults.exclude,
      "**/.kilo/worktrees/**",
      "e2e/**",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
