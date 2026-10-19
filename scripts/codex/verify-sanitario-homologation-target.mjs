// Offline preflight. Reads secret values only in memory; no network or write.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import process from "node:process";
import { pathToFileURL } from "node:url";
import targets from "../../config/backend-targets.json" with { type: "json" };
import { validateBackendEnvironment } from "./backend-environment.mjs";

export function verifyHomologationTarget(binding, env, registered = targets) {
  const ref = binding.project_ref;
  assert(/^[a-z]{20}$/.test(ref ?? ""), "EXCLUSIVE_PROJECT_REF_REQUIRED");
  assert(!registered.production_project_refs.includes(ref), "PRODUCTION_TARGET_FORBIDDEN");
  assert(binding.organization_id && binding.environment_owner && binding.provisioning_decision_reference,
    "PROVISIONING_EVIDENCE_REQUIRED");
  assert.equal(binding.api_url, `https://${ref}.supabase.co`);
  assert.equal(binding.functions_url, `${binding.api_url}/functions/v1`);
  const origin = new URL(binding.preview_origin);
  assert(origin.protocol === "https:" && origin.origin === binding.preview_origin &&
    origin.hostname !== "rebanho-sync.vercel.app", "EXCLUSIVE_PREVIEW_ORIGIN_REQUIRED");
  assert(/^[a-f0-9]{64}$/.test(binding.publishable_key_sha256 ?? ""), "PUBLIC_KEY_DIGEST_REQUIRED");
  assert(!Object.values(registered.production_publishable_key_sha256).flat().includes(binding.publishable_key_sha256),
    "PRODUCTION_PUBLIC_KEY_FORBIDDEN");
  assert(registered.homologation_project_refs.includes(ref), "REGISTER_EXCLUSIVE_TARGET_FIRST");
  assert(registered.homologation_publishable_key_sha256[ref]?.includes(binding.publishable_key_sha256),
    "REGISTER_EXCLUSIVE_PUBLIC_KEY_FIRST");
  assert.equal(env.VITE_BACKEND_ENV, "homologation");
  assert.equal(env.VITE_SUPABASE_URL, binding.api_url);
  assert.equal(env.VITE_SUPABASE_FUNCTIONS_URL, binding.functions_url);
  validateBackendEnvironment("homologation", env, { ...registered,
    homologation_publishable_key_sha256: { [ref]: [binding.publishable_key_sha256] } });
  const database = new URL(env.DB_URL);
  const direct = database.hostname === `db.${ref}.supabase.co` && database.username === "postgres";
  const pooler = /^[a-z0-9.-]+\.pooler\.supabase\.com$/.test(database.hostname) && database.username === `postgres.${ref}`;
  assert(["postgres:", "postgresql:"].includes(database.protocol) && (direct || pooler),
    "DATABASE_TARGET_MISMATCH");
  assert([...database.searchParams].every(([key, value]) => key === "sslmode" && ["require", "verify-full"].includes(value)),
    "DATABASE_QUERY_OVERRIDE_FORBIDDEN");
  return { project_ref: ref, preflight: "PASS", remote_operations: 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    assert(process.argv.length === 3, "Use <approved target binding JSON>; secrets only in environment");
    console.log(JSON.stringify(verifyHomologationTarget(JSON.parse(readFileSync(process.argv[2], "utf8")), process.env)));
  } catch {
    // Avoid assertion/URL diagnostics that could expose supplied credentials.
    console.error("HOMOLOGATION_TARGET_PREFLIGHT_FAILED: verify binding, registered ref/key, endpoints and DB target; no remote operation executed");
    process.exitCode = 1;
  }
}
