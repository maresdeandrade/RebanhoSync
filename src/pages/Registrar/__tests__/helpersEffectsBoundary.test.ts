import { describe, expect, it } from "vitest";
import path from "node:path";
import { readdirSync, readFileSync } from "node:fs";

const HELPERS_DIR = path.resolve(
  process.cwd(),
  "src/pages/Registrar/helpers",
);

const HELPER_FILES = readdirSync(HELPERS_DIR).filter(
  (name) => name.endsWith(".ts") && name !== "README.md",
);

const FORBIDDEN_PATTERNS: RegExp[] = [
  /@\/pages\/Registrar\/effects\//,
  /@\/lib\/offline\/db/,
  /@\/lib\/offline\/ops/,
  /\bpullDataForFarm\b/,
  /\bfetch\s*\(/,
  /\bsupabase\b/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bwindow\./,
  /\bdocument\./,
  /\bindexedDB\b/,
];

describe("Registrar helpers/effects boundary", () => {
  it("helpers nao importam effects nem IO de infraestrutura", () => {
    const violations: string[] = [];

    for (const fileName of HELPER_FILES) {
      const absolutePath = path.join(HELPERS_DIR, fileName);
      const source = readFileSync(absolutePath, "utf8");

      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(source)) {
          violations.push(`${fileName} viola ${pattern}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
