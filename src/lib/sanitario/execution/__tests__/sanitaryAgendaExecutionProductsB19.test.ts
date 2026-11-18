import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/offline/db";
import { loadSanitaryAgendaExecutionOptionsV2 } from "@/components/sanitario/SanitaryAgendaExecutionConfirmV2";

const farm = "farm-b19";
const item = {
  id: "agenda-b19",
  fazendaId: farm,
  plannedFor: "2026-11-14",
  status: "programada",
  protocolId: "protocol-b19",
  itemKey: "b19",
  protocolLabel: "Brucelose",
  itemLabel: "Vacinação B19",
  productRequirementKind: "product_class",
  productClass: "vacina_b19",
  productClassLabel: "Vacina B19",
  productClassGroupId: null,
  productClassGroupName: null,
  plannedProductId: null,
  plannedProductName: null,
  suggestedDose: 2,
  suggestedDoseUnit: "ml",
  suggestedRoute: "subcutanea",
  animalCount: 1,
  target: { scope: "lote", id: "lote-b19" },
  canManage: true,
  canExecute: true,
} as const;

describe("B19 directed product selection", () => {
  beforeEach(async () => {
    await db.catalog_sanitario_produtos_v2.clear();
    await db.catalog_sanitario_product_class_group_members_v2.clear();
    await db.catalog_sanitario_product_classes_v2.clear();
    await db.state_insumos.clear();
    await db.state_insumo_lotes.clear();

    await db.catalog_sanitario_produtos_v2.bulkPut([
      {
        id: "product-compatible",
        nome_comercial: "Vacina B19 registrada",
        fabricante: "Fabricante A",
        classe: "vacina_b19",
        status_curatorial: "ativo",
        deleted_at: null,
      } as never,
      {
        id: "product-incompatible",
        nome_comercial: "Vacina clostridial",
        fabricante: "Fabricante B",
        classe: "vacina_clostridial",
        status_curatorial: "ativo",
        deleted_at: null,
      } as never,
    ]);
    await db.state_insumos.bulkPut([
      {
        id: "supply-no-class",
        fazenda_id: farm,
        nome: "Vacina B19 sem classe",
        categoria: "Vacina",
        tipo: "sanitario",
        ativo: true,
        deleted_at: null,
        produto_veterinario_id: null,
        payload: {},
      } as never,
      {
        id: "supply-explicit-link",
        fazenda_id: farm,
        nome: "Vacina B19 vinculada",
        categoria: "Vacina",
        tipo: "sanitario",
        ativo: true,
        deleted_at: null,
        produto_veterinario_id: "product-compatible",
        payload: {},
      } as never,
    ]);
  });

  afterEach(async () => {
    await db.catalog_sanitario_produtos_v2.clear();
    await db.catalog_sanitario_product_class_group_members_v2.clear();
    await db.catalog_sanitario_product_classes_v2.clear();
    await db.state_insumos.clear();
    await db.state_insumo_lotes.clear();
  });

  it("mantém compatível, bloqueia incompatível e rejeita sem classe ou vínculo explícito", async () => {
    const result = await loadSanitaryAgendaExecutionOptionsV2([item as never]);
    const ids = result.productOptions.map((option) => option.id);

    expect(ids).toContain("product-compatible");
    expect(ids).not.toContain("product-incompatible");
    expect(ids).not.toContain("insumo:supply-no-class");
    expect(ids).not.toContain("insumo:supply-explicit-link");
  });
});
