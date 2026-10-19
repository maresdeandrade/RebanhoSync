import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyHomologationTarget } from "../../scripts/codex/verify-sanitario-homologation-target.mjs";

const ref = "abcdefghijklmnopqrst";
const key = "synthetic-public-key-for-isolation-test";
const digest = createHash("sha256").update(key).digest("hex");
const binding = { project_ref: ref, organization_id: "synthetic-org", environment_owner: "test-owner",
  provisioning_decision_reference: "synthetic-test-only", api_url: `https://${ref}.supabase.co`,
  functions_url: `https://${ref}.supabase.co/functions/v1`, preview_origin: "https://isolated-preview.example",
  publishable_key_sha256: digest };
const registered = { production_project_refs: ["zqloazqzhwauamcejmuz"],
  production_publishable_key_sha256: { zqloazqzhwauamcejmuz: ["f".repeat(64)] },
  homologation_project_refs: [ref], homologation_publishable_key_sha256: { [ref]: [digest] } };
const env = { VITE_BACKEND_ENV: "homologation", VITE_SUPABASE_URL: binding.api_url,
  VITE_SUPABASE_FUNCTIONS_URL: binding.functions_url, VITE_SUPABASE_PUBLISHABLE_KEY: key,
  DB_URL: `postgresql://postgres@db.${ref}.supabase.co/postgres?sslmode=require` };

describe("release target binding protects production before remote commands", () => {
  it("accepts only a complete independently registered project/key and matching database", () => {
    expect(verifyHomologationTarget(binding, env, registered)).toEqual({ project_ref: ref, preflight: "PASS", remote_operations: 0 });
    expect(verifyHomologationTarget(binding, { ...env, DB_URL: `postgresql://postgres.${ref}@aws-0-sa-east-1.pooler.supabase.com/postgres` }, registered).preflight).toBe("PASS");
  });
  it("binds the actual credential to this decision even when the project has multiple registered keys", () => {
    const other = "another-synthetic-public-key";
    const otherDigest = createHash("sha256").update(other).digest("hex");
    const registry = { ...registered, homologation_publishable_key_sha256: { [ref]: [digest, otherDigest] } };
    expect(() => verifyHomologationTarget(binding, { ...env, VITE_SUPABASE_PUBLISHABLE_KEY: other }, registry)).toThrow();
  });
  it.each([
    ["production project", { ...binding, project_ref: "zqloazqzhwauamcejmuz" }, env, registered],
    ["production key digest", { ...binding, publishable_key_sha256: "f".repeat(64) }, env, registered],
    ["missing provisioning evidence", { ...binding, provisioning_decision_reference: null }, env, registered],
    ["unregistered project", binding, env, { ...registered, homologation_project_refs: [] }],
    ["mixed function endpoint", binding, { ...env, VITE_SUPABASE_FUNCTIONS_URL: "https://zqloazqzhwauamcejmuz.supabase.co/functions/v1" }, registered],
    ["production build context", binding, { ...env, VERCEL_ENV: "production" }, registered],
    ["production database", binding, { ...env, DB_URL: "postgresql://postgres@db.zqloazqzhwauamcejmuz.supabase.co/postgres" }, registered],
    ["connection string host override", binding, { ...env, DB_URL: env.DB_URL + "&host=db.zqloazqzhwauamcejmuz.supabase.co" }, registered],
    ["production preview", { ...binding, preview_origin: "https://rebanho-sync.vercel.app" }, env, registered],
    ["unregistered credential", binding, { ...env, VITE_SUPABASE_PUBLISHABLE_KEY: "wrong-test-key" }, registered],
  ])("rejects %s without connecting", (_name, target, values, registry) => {
    expect(() => verifyHomologationTarget(target, values, registry)).toThrow();
  });
});
