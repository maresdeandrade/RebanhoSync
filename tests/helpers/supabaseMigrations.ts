import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const CANONICAL_BASELINE_MIGRATION =
  "00000000000000_rebuild_base_schema_sanitario.sql";

export function readCanonicalBaselineMigration() {
  return readFileSync(
    join(process.cwd(), "supabase", "migrations", CANONICAL_BASELINE_MIGRATION),
    "utf8",
  );
}

export function readMigrationFile(filename: string) {
  return readFileSync(
    join(process.cwd(), "supabase", "migrations", filename),
    "utf8",
  );
}

export function readAllMigrations() {
  const dir = join(process.cwd(), "supabase", "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  return files.map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
}
