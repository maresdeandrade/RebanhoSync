import { execFileSync, spawn } from "node:child_process";
if (process.env.REBANHOSYNC_DISPOSABLE_LOCAL_DB !== "1")
  throw new Error("LOCAL_DISPOSABLE_REQUIRED");
const status = execFileSync("supabase", ["status", "-o", "env"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
const values = Object.fromEntries(
  status.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^([A-Z_]+)=["']?(.*?)["']?$/);
    return match ? [[match[1], match[2]]] : [];
  }),
);
for (const key of ["API_URL", "DB_URL"])
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(new URL(values[key]).hostname)
  )
    throw new Error("LOCAL_ONLY");
const args = process.argv.includes("--digest")
  ? [
      "node_modules/vitest/vitest.mjs",
      "run",
      "src/lib/offline/__tests__/movementDigest.postgres.test.ts",
    ]
  : [
      "node_modules/@playwright/test/cli.js",
      "test",
      "--config",
      "playwright.movement.config.ts",
    ];
const child = spawn(process.execPath, args, {
  stdio: "inherit",
  windowsHide: true,
  env: {
    ...process.env,
    REBANHOSYNC_TEST_API_URL: values.API_URL,
    REBANHOSYNC_TEST_DB_URL: values.DB_URL,
    REBANHOSYNC_TEST_ANON_KEY: values.ANON_KEY,
    REBANHOSYNC_TEST_SERVICE_ROLE_KEY: values.SERVICE_ROLE_KEY,
    VITE_SUPABASE_URL: values.API_URL,
    VITE_SUPABASE_FUNCTIONS_URL: values.API_URL + "/functions/v1",
    VITE_SUPABASE_PUBLISHABLE_KEY: values.ANON_KEY,
  },
});
process.exitCode = await new Promise((resolve, reject) => {
  child.on("error", reject);
  child.on("exit", (code) => resolve(code ?? 1));
});
