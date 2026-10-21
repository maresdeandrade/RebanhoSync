import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  timeout: 90_000,
  testDir: ".", testMatch: "sanitary-planning.spec.ts", workers: 1, retries: 0,
  use: { baseURL: "http://127.0.0.1:4187", ...devices["Desktop Chrome"], screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    command: "pnpm exec vite --host 127.0.0.1 --port 4187 --strictPort",
    url: "http://127.0.0.1:4187", reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: "http://127.0.0.1:59997", VITE_SUPABASE_FUNCTIONS_URL: "http://127.0.0.1:59997/functions/v1", VITE_SUPABASE_PUBLISHABLE_KEY: "local-disposable-test" },
  },
});
