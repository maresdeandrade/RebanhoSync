import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateBackendBuildEnvironment } from "../../scripts/codex/backend-environment.mjs";

const productionRef = "productionfixtureonly";
const previewRef = "previewfixtureonlyxx";
const publicKey = "synthetic-test-public-key";
const digest = createHash("sha256").update(publicKey).digest("hex");
const registered = {
  production_project_refs: [productionRef],
  homologation_project_refs: [previewRef],
  production_publishable_key_sha256: { [productionRef]: [digest] },
  homologation_publishable_key_sha256: { [previewRef]: [digest] },
};
const backend = (ref, role) => ({
  VITE_BACKEND_ENV: role,
  VITE_SUPABASE_URL: `https://${ref}.supabase.co`,
  VITE_SUPABASE_FUNCTIONS_URL: `https://${ref}.supabase.co/functions/v1`,
  VITE_SUPABASE_PUBLISHABLE_KEY: publicKey,
});
const preview = { ...backend(previewRef, "homologation"), VERCEL_ENV: "preview" };
const synthetic = {
  CI: "true",
  VITE_BACKEND_ENV: "ci-synthetic",
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_FUNCTIONS_URL: "https://example.supabase.co/functions/v1",
  VITE_SUPABASE_PUBLISHABLE_KEY: "example-publishable-key",
};

describe("backend build deployment matrix", () => {
  it("keeps optimized production-mode Preview builds isolated", () => {
    expect(validateBackendBuildEnvironment("production", preview, registered)).toEqual({
      role: "homologation", projectRef: previewRef,
    });
  });
  it("accepts only the exact synthetic CI target", () => {
    expect(validateBackendBuildEnvironment("production", synthetic, registered)).toEqual({
      role: "ci-synthetic", projectRef: "synthetic",
    });
  });
  it.each([undefined, "production"])("keeps production fail-closed (%s)", vercel => {
    const env = { ...backend(productionRef, "production"), VERCEL_ENV: vercel };
    expect(validateBackendBuildEnvironment("production", env, registered).projectRef).toBe(productionRef);
    expect(() => validateBackendBuildEnvironment("production", { ...env, VITE_SUPABASE_PUBLISHABLE_KEY: undefined }, registered)).toThrow(/BACKEND_PUBLIC_KEY_NOT_REGISTERED/);
    expect(() => validateBackendBuildEnvironment("production", { ...env, ...backend(previewRef, "homologation") }, registered)).toThrow(/PRODUCTION_BACKEND_FORBIDDEN/);
  });
  it.each([
    ["missing role", { VITE_BACKEND_ENV: undefined }],
    ["production role", backend(productionRef, "production")],
    ["controlled production reuse", backend(productionRef, "controlled-homologation")],
    ["development role", { VITE_BACKEND_ENV: "development" }],
    ["local backend", { VITE_SUPABASE_URL: "http://127.0.0.1:54321", VITE_SUPABASE_FUNCTIONS_URL: "http://127.0.0.1:54321/functions/v1" }],
    ["production project", backend(productionRef, "homologation")],
    ["unregistered project", backend("unregisteredfixture", "homologation")],
    ["missing public key", { VITE_SUPABASE_PUBLISHABLE_KEY: undefined }],
    ["wrong public key", { VITE_SUPABASE_PUBLISHABLE_KEY: "wrong-test-key" }],
    ["http endpoint", { VITE_SUPABASE_URL: `http://${previewRef}.supabase.co`, VITE_SUPABASE_FUNCTIONS_URL: `http://${previewRef}.supabase.co/functions/v1` }],
    ["different functions project", { VITE_SUPABASE_FUNCTIONS_URL: `https://${productionRef}.supabase.co/functions/v1` }],
  ])("rejects unsafe Preview: %s", (_label, changed) => {
    expect(() => validateBackendBuildEnvironment("production", { ...preview, ...changed }, registered)).toThrow();
  });
  it.each([
    ["outside CI", { CI: undefined }],
    ["Vercel preview", { VERCEL_ENV: "preview" }],
    ["Vercel production", { VERCEL_ENV: "production" }],
    ["Vercel without context", { VERCEL: "1" }],
    ["real target", backend(productionRef, "ci-synthetic")],
    ["unexpected public key", { VITE_SUPABASE_PUBLISHABLE_KEY: publicKey }],
    ["different functions target", { VITE_SUPABASE_FUNCTIONS_URL: `https://${previewRef}.supabase.co/functions/v1` }],
  ])("rejects synthetic context: %s", (_label, changed) => {
    expect(() => validateBackendBuildEnvironment("production", { ...synthetic, ...changed }, registered)).toThrow(/CI_SYNTHETIC_BACKEND_FORBIDDEN/);
  });
});
