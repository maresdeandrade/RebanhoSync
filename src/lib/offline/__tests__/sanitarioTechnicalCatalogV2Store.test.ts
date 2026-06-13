import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/offline/db";
import { getLocalStoreName, getRemoteTableName } from "@/lib/offline/tableMap";
import type {
  SanitarioFonteTecnicaLocalV2,
  SanitarioProdutoCarenciaRuleLocalV2,
  SanitarioProdutoDoseRuleLocalV2,
  SanitarioProdutoEspecieAutorizacaoLocalV2,
  SanitarioProdutoLocalV2,
} from "@/lib/offline/types";

const stores = [
  "catalog_sanitario_fontes_tecnicas_v2",
  "catalog_sanitario_fonte_cobertura_campos_v2",
  "catalog_sanitario_produtos_v2",
  "catalog_sanitario_produto_especie_autorizacao_v2",
  "catalog_sanitario_produto_fontes_v2",
  "catalog_sanitario_produto_dose_rules_v2",
  "catalog_sanitario_produto_carencia_rules_v2",
] as const;

const now = "2026-06-12T12:00:00.000Z";
const later = "2026-06-12T13:00:00.000Z";

describe("offline technical sanitary catalog v2 stores", () => {
  beforeEach(async () => {
    await db.open();
    await Promise.all(stores.map((store) => db.table(store).clear()));
    await db.queue_ops.clear();
  });

  afterEach(async () => {
    await Promise.all(stores.map((store) => db.table(store).clear()));
    await db.queue_ops.clear();
  });

  it("registra stores do catalogo tecnico sanitario v2 no Dexie v24 ou superior", () => {
    expect(db.verno).toBeGreaterThanOrEqual(24);
    expect(db.tables.map((table) => table.name)).toEqual(
      expect.arrayContaining([...stores]),
    );
    expect(getLocalStoreName("sanitario_fontes_tecnicas_v2")).toBe(
      "catalog_sanitario_fontes_tecnicas_v2",
    );
    expect(getRemoteTableName("catalog_sanitario_produtos_v2")).toBe(
      "sanitario_produtos_v2",
    );
  });

  it("preserva fonte tecnica global e fonte da fazenda sem criar queue_ops", async () => {
    const globalSource: SanitarioFonteTecnicaLocalV2 = {
      id: "source-global",
      kind: "bula",
      scope: "global",
      fazenda_id: null,
      title: "Bula Produto X",
      issuer: "MAPA",
      version: "2026",
      published_at: "2026-01-01",
      accessed_at: "2026-06-12",
      url: "https://example.test/bula",
      jurisdiction_country: "BR",
      jurisdiction_uf: null,
      jurisdiction_zone: null,
      strength: "forte",
      evidence_status: "SIM_BULA",
      limitations: [{ field: "withdrawal", note: "catalogo, nao execucao" }],
      metadata: { phase: "12E3", tags: ["source"] },
      created_by: null,
      created_at: now,
      updated_at: later,
      deleted_at: null,
    };
    const farmSource: SanitarioFonteTecnicaLocalV2 = {
      ...globalSource,
      id: "source-farm",
      kind: "mv_responsavel",
      scope: "fazenda",
      fazenda_id: "farm-1",
      title: "Responsavel tecnico da fazenda",
      strength: "forte",
      evidence_status: "PRECISA_VALIDAR",
      deleted_at: "2026-06-12T14:00:00.000Z",
    };

    await db.catalog_sanitario_fontes_tecnicas_v2.bulkPut([
      globalSource,
      farmSource,
    ]);

    await expect(
      db.catalog_sanitario_fontes_tecnicas_v2.get(globalSource.id),
    ).resolves.toMatchObject({
      scope: "global",
      fazenda_id: null,
      updated_at: later,
      deleted_at: null,
      metadata: { phase: "12E3", tags: ["source"] },
    });
    await expect(
      db.catalog_sanitario_fontes_tecnicas_v2.get(farmSource.id),
    ).resolves.toMatchObject({
      scope: "fazenda",
      fazenda_id: "farm-1",
      deleted_at: "2026-06-12T14:00:00.000Z",
    });
    expect(await db.queue_ops.count()).toBe(0);
  });

  it("preserva produto, autorizacao por especie, dose e carencia catalogada sem inferir bubalino ou carencia ativa", async () => {
    const product: SanitarioProdutoLocalV2 = {
      id: "product-1",
      nome_comercial: "Produto Tecnico X",
      fabricante: "Fabricante",
      registro_orgao: "MAPA",
      registro_numero: "123",
      classe: "vacina",
      principio_ativo: "antigeno",
      tipo_produto: "vacinacao",
      apresentacao: "frasco",
      status_curatorial: "precisa_validar",
      metadata: { catalogOnly: true },
      created_at: now,
      updated_at: later,
      deleted_at: null,
    };
    const bovineAuthorization: SanitarioProdutoEspecieAutorizacaoLocalV2 = {
      id: "auth-bovino",
      product_id: product.id,
      species_code: "bovino",
      authorization_status: "SIM_BULA",
      aptitude: "corte",
      sexo: null,
      idade_min_dias: null,
      idade_max_dias: null,
      lactacao_permitida: null,
      gestacao_permitida: null,
      requires_mv_responsavel: false,
      limitations: ["bubalino exige linha propria"],
      metadata: { explicitSpecies: true },
      created_at: now,
      updated_at: later,
      deleted_at: null,
    };
    const doseRule: SanitarioProdutoDoseRuleLocalV2 = {
      id: "dose-1",
      product_id: product.id,
      species_code: "bovino",
      aptitude: "corte",
      route: "subcutanea",
      dose_quantity: 2,
      dose_unit: "ml",
      dose_basis: "animal",
      min_weight_kg: null,
      max_weight_kg: null,
      limitations: ["nao cria execucao"],
      status_curatorial: "precisa_validar",
      created_at: now,
      updated_at: later,
      deleted_at: null,
    };
    const withdrawalRule: SanitarioProdutoCarenciaRuleLocalV2 = {
      id: "withdrawal-1",
      product_id: product.id,
      species_code: "bovino",
      aptitude: "corte",
      route: "subcutanea",
      dose_basis: "animal",
      meat_days: 30,
      milk_days: null,
      milk_hours: null,
      applicability: "period",
      zero_requires_explicit_source: true,
      valid_from: "2026-01-01",
      valid_until: null,
      status_curatorial: "precisa_validar",
      limitations: ["catalogo tecnico; carencia ativa depende de evento"],
      metadata: { source: "label" },
      created_at: now,
      updated_at: later,
      deleted_at: null,
    };

    await db.catalog_sanitario_produtos_v2.put(product);
    await db.catalog_sanitario_produto_especie_autorizacao_v2.put(
      bovineAuthorization,
    );
    await db.catalog_sanitario_produto_dose_rules_v2.put(doseRule);
    await db.catalog_sanitario_produto_carencia_rules_v2.put(withdrawalRule);

    expect(
      await db.catalog_sanitario_produto_especie_autorizacao_v2
        .where("product_id")
        .equals(product.id)
        .and((row) => row.species_code === "bubalino")
        .toArray(),
    ).toEqual([]);
    await expect(
      db.catalog_sanitario_produto_dose_rules_v2.get(doseRule.id),
    ).resolves.toMatchObject({
      product_id: product.id,
      dose_quantity: 2,
      dose_unit: "ml",
      route: "subcutanea",
    });
    const storedWithdrawalRule =
      await db.catalog_sanitario_produto_carencia_rules_v2.get(
        withdrawalRule.id,
      );
    expect(storedWithdrawalRule).toMatchObject({
      product_id: product.id,
      species_code: "bovino",
      aptitude: "corte",
      applicability: "period",
      meat_days: 30,
      metadata: { source: "label" },
    });
    expect(storedWithdrawalRule).not.toHaveProperty("carencia_ativa");
    expect(storedWithdrawalRule).not.toHaveProperty("createsAgenda");
    expect(storedWithdrawalRule).not.toHaveProperty("createsEvent");
    expect(await db.queue_ops.count()).toBe(0);
  });

  it("preserva vinculos fonte-campo e produto-fonte", async () => {
    await db.catalog_sanitario_fonte_cobertura_campos_v2.put({
      id: "coverage-1",
      source_id: "source-global",
      field_key: "withdrawal",
      coverage_status: "covers",
      notes: "cobre carencia declarada",
      created_at: now,
      updated_at: later,
      deleted_at: null,
    });
    await db.catalog_sanitario_produto_fontes_v2.put({
      product_id: "product-1",
      source_id: "source-global",
      field_key: "withdrawal",
      created_at: now,
    });

    await expect(
      db.catalog_sanitario_fonte_cobertura_campos_v2.get("coverage-1"),
    ).resolves.toMatchObject({
      source_id: "source-global",
      field_key: "withdrawal",
      coverage_status: "covers",
      updated_at: later,
    });
    await expect(
      db.catalog_sanitario_produto_fontes_v2.get([
        "product-1",
        "source-global",
        "withdrawal",
      ]),
    ).resolves.toMatchObject({
      product_id: "product-1",
      source_id: "source-global",
      field_key: "withdrawal",
    });
  });
});
