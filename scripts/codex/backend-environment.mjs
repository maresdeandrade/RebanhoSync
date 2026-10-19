import targets from "../../config/backend-targets.json" with { type: "json" };
import { createHash } from "node:crypto";

// Endpoints are public configuration. Never inspect or include API key values.
export function validateBackendEnvironment(mode, env, registered = targets) {
  const production = env.VERCEL_ENV === "production" || mode === "production";
  const role =
    env.VITE_BACKEND_ENV ?? (production ? "production" : "development");
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
  if (production || (role === "homologation" && !local)) {
    const hashes =
      (production
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
