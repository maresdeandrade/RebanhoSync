import { env } from "node:process";
import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(env.CI);

export default defineConfig({
  testDir: "./e2e",

  fullyParallel: false,

  workers: isCI ? 1 : undefined,

  retries: isCI ? 1 : 0,

  reporter: isCI ? [["line"], ["html", { open: "never" }]] : "list",

  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],

  webServer: {
    command: "pnpm run preview -- --host 127.0.0.1",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !isCI,
  },
});
