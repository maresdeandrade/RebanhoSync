import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("validate-supabase-baseline-functional contract", () => {
  it("does not write legacy sanitario agenda_itens", () => {
    const scriptPath = resolve(process.cwd(), "scripts/codex/validate-supabase-baseline-functional.mjs");
    const script = readFileSync(scriptPath, "utf8");

    expect(script).not.toContain("insert into public.agenda_itens(");
    expect(script).not.toContain("'sanitario', 'vacinacao', 'agendado'");
    expect(script).toContain("evento sanitario direto sem agenda legada");
  });
});
