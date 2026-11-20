import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  compileProductClassPublicationV2,
  validateProductClassPublicationV2,
} from "../../scripts/codex/sanitario-product-class-publication-v2.mjs";
const packet = () =>
  JSON.parse(
    readFileSync(
      "docs/review/evidence/SANITARIO_PRODUCT_CLASS_PUBLICATION_20261120.json",
      "utf8",
    ),
  );
describe("definitive commercial class publication", () => {
  it("validates real identities and multivalence, rejecting duplicate pairs and clinical coverage", () => {
    const p = packet();
    expect(validateProductClassPublicationV2(p).links).toHaveLength(37);
    expect(new Set(p.links.map((l) => l.product_id)).size).toBe(33);
    const duplicate = packet();
    duplicate.links.push(duplicate.links[0]);
    expect(() => validateProductClassPublicationV2(duplicate)).toThrow();
    const clinical = packet();
    clinical.sources[0].coverage.field_key = "dose";
    expect(() => validateProductClassPublicationV2(clinical)).toThrow();
  });
  it("encodes document text without permitting SQL dollar-quote delimiter injection", () => {
    const p = packet();
    p.sources[0].title = "$publication$; drop table public.eventos; --";
    expect(compileProductClassPublicationV2(p)).not.toContain(
      "drop table public.eventos",
    );
  });
  it("canonical entrypoint validates the packet and refuses remote targets before connecting", () => {
    const args = [
      "scripts/codex/import-sanitario-protocols-v2.mjs",
      "--product-class-links",
      "docs/review/evidence/SANITARIO_PRODUCT_CLASS_PUBLICATION_20261120.json",
    ];
    expect(
      spawnSync(process.execPath, [...args, "--validate"], { encoding: "utf8" })
        .status,
    ).toBe(0);
    const result = spawnSync(process.execPath, [...args, "--apply-local"], {
      encoding: "utf8",
      env: {
        ...process.env,
        DB_URL: "postgresql://postgres@remote.invalid/postgres",
      },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("LOCAL_TARGET_REQUIRED");
  });
});
