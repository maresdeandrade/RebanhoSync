import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const FORBIDDEN_TERMS = [
  "Concluir direto",
  "Abrir próxima ação",
  "Abrir registro detalhado",
  "Executar direto",
];

const SOURCE_ROOT = path.resolve(process.cwd(), "src");
const ALLOWED_EXTENSIONS = new Set([".ts", ".tsx"]);
const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  "coverage",
  "__tests__",
]);

function listSourceFiles(root: string): string[] {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
      files.push(...listSourceFiles(absolutePath));
      continue;
    }

    if (!ALLOWED_EXTENSIONS.has(path.extname(entry.name))) continue;
    files.push(absolutePath);
  }

  return files;
}

describe("semantic terms guard", () => {
  it("blocks forbidden legacy terms in source UI copy", () => {
    const offenders: string[] = [];
    const files = listSourceFiles(SOURCE_ROOT);

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split(/\r?\n/);
      lines.forEach((line, index) => {
        FORBIDDEN_TERMS.forEach((term) => {
          if (line.includes(term)) {
            offenders.push(
              `${path.relative(process.cwd(), filePath)}:${index + 1} -> ${term}`,
            );
          }
        });
      });
    }

    expect(offenders).toEqual([]);
  });
});
