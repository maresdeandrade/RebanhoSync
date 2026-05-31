import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const LEGACY_KEYS = [
  ["protocol", "item", "id"].join("_"),
  ["protocolo", "item", "id"].join("_"),
] as const;

const SCANNED_DIRS = ["src", "tests", "scripts", join("supabase", "migrations")];
const SKIPPED_DIRS = new Set(["node_modules", "dist", "coverage", ".git"]);
const TECHNICAL_CLEANUP_MIGRATION = join(
  "supabase",
  "migrations",
  `20260531001000_protocolos_sanitarios_drop_legacy_${LEGACY_KEYS[0]}.sql`,
);

function collectFiles(dir: string, result: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIPPED_DIRS.has(entry)) continue;

    const path = join(dir, entry);
    const stat = statSync(path);

    if (stat.isDirectory()) {
      collectFiles(path, result);
      continue;
    }

    result.push(path);
  }

  return result;
}

describe("contrato final de itens de protocolo sanitario", () => {
  it("nao reintroduz chaves operacionais legadas fora da migration tecnica de contracao", () => {
    const files = SCANNED_DIRS.flatMap((dir) => collectFiles(join(ROOT, dir)));
    const violations = files
      .filter((file) => relative(ROOT, file) !== TECHNICAL_CLEANUP_MIGRATION)
      .flatMap((file) => {
        const content = readFileSync(file, "utf8");

        return LEGACY_KEYS.filter((key) => content.includes(key)).map(
          (key) => `${relative(ROOT, file)}: ${key}`,
        );
      });

    expect(violations).toEqual([]);
  });
});
