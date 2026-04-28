import { readFileSync } from "node:fs";
import { join } from "node:path";

export const CANONICAL_BASELINE_MIGRATION =
  "00000000000000_rebuild_base_schema_sanitario.sql";

export function readCanonicalBaselineMigration() {
  return readFileSync(
    join(process.cwd(), "supabase", "migrations", CANONICAL_BASELINE_MIGRATION),
    "utf8",
  );
}
