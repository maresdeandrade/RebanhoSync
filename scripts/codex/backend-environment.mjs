import targets from "../../config/backend-targets.json" with { type: "json" };
import { createHash } from "node:crypto";

const syntheticBuildEnvironment = {
  VITE_SUPABASE_URL: "https://example.supabase.co",
  VITE_SUPABASE_FUNCTIONS_URL: "https://example.supabase.co/functions/v1",
  VITE_SUPABASE_PUBLISHABLE_KEY: "example-publishable-key",
};

function validateSyntheticBuild(env) {
  const deployed = env.VERCEL === "1" || env.VERCEL_ENV != null;
  const mismatch = Object.entries(syntheticBuildEnvironment)
    .some(([key, value]) => env[key] !== value);
  if (env.CI !== "true" || deployed || mismatch)
    throw new Error("CI_SYNTHETIC_BACKEND_FORBIDDEN");
  return { role: "ci-synthetic", projectRef: "synthetic" };
}

// Build deployment context is distinct from Vite's optimized production mode.
// The existing controlled preflight below does not authorize a deployed client.
export function validateBackendBuildEnvironment(mode, env, registered = targets) {
  if (env.VITE_BACKEND_ENV === "ci-synthetic") return validateSyntheticBuild(env);
  if (env.VERCEL_ENV === "preview") {
    if (env.VITE_BACKEND_ENV !== "homologation")
      throw new Error("PREVIEW_REQUIRES_ISOLATED_HOMOLOGATION");
    const target = validateBackendEnvironment("homologation", env, registered);
    if (target.projectRef === "local" ||
      new URL(env.VITE_SUPABASE_URL).href !== `https://${target.projectRef}.supabase.co/`)
      throw new Error("PREVIEW_REQUIRES_REGISTERED_HTTPS_BACKEND");
    return target;
  }
  return validateBackendEnvironment(mode, env, registered);
}

// Endpoints are public configuration. Never inspect or include API key values.
export function validateBackendEnvironment(mode, env, registered = targets) {
  const production = env.VERCEL_ENV === "production" || mode === "production";
  const role =
    env.VITE_BACKEND_ENV ?? (production ? "production" : "development");
  const controlled = role === "controlled-homologation";
  const api = new URL(env.VITE_SUPABASE_URL);
  const functions = new URL(env.VITE_SUPABASE_FUNCTIONS_URL);
  if (
    functions.origin !== api.origin ||
    functions.pathname.replace(/\/$/, "") !== "/functions/v1"
  )
    throw new Error(
      "BACKEND_ENDPOINT_MISMATCH: API and Functions must use the same project",
    );
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(api.hostname);
  const ref = api.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
  if (controlled && (production || local || api.protocol !== "https:" ||
    ref !== registered.existing_backend_homologation?.project_ref ||
    !registered.existing_backend_homologation?.reuse_decision_reference ||
    !registered.production_project_refs.includes(ref) || api.href !== `https://${ref}.supabase.co/`))
    throw new Error("CONTROLLED_HOMOLOGATION_TARGET_FORBIDDEN");
  if (
    production &&
    (role !== "production" ||
      local ||
      api.protocol !== "https:" ||
      !registered.production_project_refs.includes(ref))
  )
    throw new Error(
      "PRODUCTION_BACKEND_FORBIDDEN: production requires its registered production backend",
    );
  if (
    role === "homologation" &&
    !local &&
    (!registered.homologation_project_refs.includes(ref) ||
      registered.production_project_refs.includes(ref))
  )
    throw new Error(
      "HOMOLOGATION_BACKEND_NOT_ISOLATED: register an exclusive provisioned project first",
    );
  if (role === "homologation" && production)
    throw new Error("PRODUCTION_CANNOT_USE_HOMOLOGATION");
  if (production || controlled || (role === "homologation" && !local)) {
    const hashes =
      (production || controlled
        ? registered.production_publishable_key_sha256
        : registered.homologation_publishable_key_sha256)?.[ref] ?? [];
    const digest = createHash("sha256")
      .update(env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "")
      .digest("hex");
    if (!hashes.includes(digest))
      throw new Error(
        "BACKEND_PUBLIC_KEY_NOT_REGISTERED: verify the public key in the intended environment",
      );
  }
  return { role, projectRef: local ? "local" : ref };
}
