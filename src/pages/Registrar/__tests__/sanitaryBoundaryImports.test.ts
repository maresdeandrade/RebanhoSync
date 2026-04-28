import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Registrar sanitary boundary imports", () => {
  function collectSourceFiles(directory: string): string[] {
    return readdirSync(directory).flatMap((entry) => {
      const path = resolve(directory, entry);
      if (statSync(path).isDirectory()) return collectSourceFiles(path);
      return /\.(ts|tsx)$/.test(path) ? [path] : [];
    });
  }

  it("does not import sanitario engine modules directly from Registrar files", () => {
    const registrarFiles = collectSourceFiles(resolve(process.cwd(), "src/pages/Registrar"));
    const forbiddenImport = ["@/lib/sanitario", "engine"].join("/");
    const offendingFiles = registrarFiles.filter((file) =>
      readFileSync(file, "utf8").includes(forbiddenImport),
    );

    expect(offendingFiles).toEqual([]);
  });

  it("routes Registrar calendar labels through the display facade", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/pages/Registrar/components/RegistrarSanitarioSection.tsx"),
      "utf8",
    );

    expect(source).toContain("@/lib/sanitario/models/calendarDisplay");
  });
});
