import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("validate-supabase-baseline-functional contract", () => {
  it("does not write legacy sanitario agenda_itens", () => {
    const scriptPath = resolve(process.cwd(), "scripts/codex/validate-supabase-baseline-functional.mjs");
    const script = readFileSync(scriptPath, "utf8");

    expect(script).not.toContain("insert into public.agenda_itens(");
    expect(script).not.toContain("'sanitario', 'vacinacao', 'agendado'");
    expect(script).toContain('operation("apply_factual_core"');
    expect(script).toContain("SANITARIO_SINGLE_ADMISSION_REQUIRED");
    expect(script).toContain("sanitario_v3_confirmation = 'confirmed'");
    expect(script).toContain("Evento sanitario direto deve exigir admissao V3");
  });
});
