import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("inventory migrations", () => {
  it("protege baixa nutricional remota por evento/source sem bloquear tombstones", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/20260604090000_insumo_movimentacoes_consumo_nutricao_idempotency.sql",
      ),
      "utf8",
    );

    expect(migration).toContain(
      "create unique index if not exists ux_insumo_movimentacoes_consumo_nutricao_evento",
    );
    expect(migration).toContain(
      "on public.insumo_movimentacoes (fazenda_id, source_evento_id)",
    );
    expect(migration).toContain("where tipo = 'consumo_nutricao'");
    expect(migration).toContain("source_evento_id is not null");
    expect(migration).toContain("deleted_at is null");
  });
});
