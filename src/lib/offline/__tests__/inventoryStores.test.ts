import { describe, expect, it } from "vitest";

import { db } from "@/lib/offline/db";
import { DEFAULT_REMOTE_TABLES } from "@/lib/offline/pull";
import { TABLE_MAP } from "@/lib/offline/tableMap";

describe("offline inventory stores", () => {
  it("registra stores tenant-scoped do inventario no Dexie", () => {
    expect(db.tables.map((table) => table.name)).toEqual(
      expect.arrayContaining([
        "state_insumos",
        "state_insumo_apresentacoes",
        "state_insumo_lotes",
        "state_insumo_movimentacoes",
      ]),
    );
  });

  it("mapeia tabelas remotas de inventario para stores locais", () => {
    expect(TABLE_MAP.insumos).toBe("state_insumos");
    expect(TABLE_MAP.insumo_apresentacoes).toBe("state_insumo_apresentacoes");
    expect(TABLE_MAP.insumo_lotes).toBe("state_insumo_lotes");
    expect(TABLE_MAP.insumo_movimentacoes).toBe("state_insumo_movimentacoes");
  });

  it("indexa lotes de insumo por fazenda e insumo para seleção no Registrar", () => {
    const compoundIndexes = db.state_insumo_lotes.schema.indexes.map(
      (index) => index.src,
    );

    expect(compoundIndexes).toContain("[fazenda_id+insumo_id]");
  });

  it("mantem eventos fonte no contrato do pull inicial do inventario", () => {
    expect(DEFAULT_REMOTE_TABLES).toEqual(
      expect.arrayContaining([
        "eventos",
        "eventos_sanitario",
        "eventos_nutricao",
        "eventos_pasto_avaliacao",
      ]),
    );
  });
});
