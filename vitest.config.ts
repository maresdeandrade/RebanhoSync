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
      "tests/codex/sanitary-disposable-support.test.mjs",
      // node:test harnesses: SQL/Auth cases run in the disposable CI stack.
      "tests/codex/member-invites.local.test.mjs",
      "tests/codex/member-invites-concurrency.local.test.mjs",
      "tests/codex/block1-security.local.test.mjs",
      // Opt-in harnesses require their own inspected local stack (54421/54422).
      "tests/codex/block1-concurrency.local.test.mjs",
      "tests/codex/block1-browser.local.test.mjs",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
