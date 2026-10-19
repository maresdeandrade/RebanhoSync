import { describe, expect, it } from "vitest";
import { validateBackendEnvironment } from "../../scripts/codex/backend-environment.mjs";
import { createHash } from "node:crypto";

const production = {
  VITE_SUPABASE_URL: "https://zqloazqzhwauamcejmuz.supabase.co",
  VITE_SUPABASE_FUNCTIONS_URL:
    "https://zqloazqzhwauamcejmuz.supabase.co/functions/v1",
  VITE_SUPABASE_PUBLISHABLE_KEY: "synthetic-public-key",
};
const registered = {
  existing_backend_homologation: {
    project_ref: "zqloazqzhwauamcejmuz",
    reuse_decision_reference: "synthetic-reuse-decision",
  },
  production_project_refs: ["zqloazqzhwauamcejmuz"],
  homologation_project_refs: [],
  production_publishable_key_sha256: {
    zqloazqzhwauamcejmuz: [
      createHash("sha256")
        .update(production.VITE_SUPABASE_PUBLISHABLE_KEY)
        .digest("hex"),
    ],
  },
};
const local = {
  VITE_SUPABASE_URL: "http://127.0.0.1:55421",
  VITE_SUPABASE_FUNCTIONS_URL: "http://127.0.0.1:55421/functions/v1",
  VITE_BACKEND_ENV: "homologation",
};
describe("backend build boundary", () => {
  it("binds controlled preview to the existing target/key without changing production rules", () => {
    const env = { ...production, VITE_BACKEND_ENV: "controlled-homologation", VERCEL_ENV: "preview" };
    expect(validateBackendEnvironment("controlled-homologation", env, registered).projectRef).toBe("zqloazqzhwauamcejmuz");
    for (const values of [
      { ...env, VERCEL_ENV: "production" },
      { ...env, VITE_SUPABASE_PUBLISHABLE_KEY: "wrong-key" },
      { ...env, VITE_SUPABASE_URL: production.VITE_SUPABASE_URL + "/other" },
      { ...env, VITE_SUPABASE_FUNCTIONS_URL: local.VITE_SUPABASE_FUNCTIONS_URL },
    ]) expect(() => validateBackendEnvironment("controlled-homologation", values, registered)).toThrow();
    expect(() => validateBackendEnvironment("controlled-homologation", env, {
      ...registered, existing_backend_homologation: undefined,
    })).toThrow();
    expect(() => validateBackendEnvironment("production", env, registered)).toThrow();
  });
  it("accepts the registered production target and isolated local homologation", () => {
    expect(
      validateBackendEnvironment("production", production, registered),
    ).toEqual({ role: "production", projectRef: "zqloazqzhwauamcejmuz" });
    expect(validateBackendEnvironment("homologation", local)).toEqual({
      role: "homologation",
      projectRef: "local",
    });
  });
  it.each([
    ["production", local],
    ["development", { ...local, VERCEL_ENV: "production" }],
    ["production", { ...production, VITE_BACKEND_ENV: "homologation" }],
    ["homologation", { ...production, VITE_BACKEND_ENV: "homologation" }],
    [
      "homologation",
      {
        VITE_BACKEND_ENV: "homologation",
        VITE_SUPABASE_URL: "https://unregistered.supabase.co",
        VITE_SUPABASE_FUNCTIONS_URL:
          "https://unregistered.supabase.co/functions/v1",
      },
    ],
    [
      "production",
      {
        ...production,
        VITE_SUPABASE_FUNCTIONS_URL: local.VITE_SUPABASE_FUNCTIONS_URL,
      },
    ],
    [
      "production",
      {
        ...production,
        VITE_SUPABASE_PUBLISHABLE_KEY: "another-environment-public-key",
      },
    ],
  ])("rejects a cross-environment build (%s)", (mode, env) => {
    expect(() => validateBackendEnvironment(mode, env, registered)).toThrow();
  });
});
