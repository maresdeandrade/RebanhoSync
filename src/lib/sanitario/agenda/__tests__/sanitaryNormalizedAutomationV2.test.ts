import "fake-indexeddb/auto";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { db } from "@/lib/offline/db";
import { loadSanitaryProtocolWindowSourceV2, buildSanitaryProtocolWindowV2 } from "../../windows/sanitaryProtocolWindowsV2";
import { generateSanitaryAutomaticAgendasV2, previewSanitaryAutomaticPlanV2 } from "../sanitaryAutomaticGenerationV2";
import { saveSanitaryAutomationPlanV2, selectSanitaryAutomationRuleV2, readSanitaryAutomationPlanV2 } from "../sanitaryAutomationPlanV2";
import { assessSanitaryAutomationReadinessV2 } from "../sanitaryAutomationReadinessV2";
import { cancelLocalSanitaryAgendaV2 } from "../sanitaryLocalAgendaManagementV2";
import { normalizedItems, automaticItemKeys, blockedItemKeys, normalizedDate, seedNormalizedFixture, seedNormalizedHistory, normalizedDraft, fixtureContext } from "./fixtures/sanitaryNormalizedFixtureV2";

vi.mock("@/lib/offline/localReadBoundary", () => ({
  requireTenantSensitiveRead: vi.fn().mockResolvedValue(undefined),
  requireTenantSensitiveWrite: vi.fn().mockResolvedValue(undefined),
  requireTenantSensitiveAccess: vi.fn().mockResolvedValue(undefined),
}));
const generate = (date = normalizedDate) => generateSanitaryAutomaticAgendasV2({ fazendaId: "farm", referenceDate: date });
const clear = () => Promise.all(db.tables.map((table) => table.clear()));
async function activate(keys = automaticItemKeys, date = normalizedDate, revision = 0) {
  const draft = await normalizedDraft("farm", keys, date);
  return saveSanitaryAutomationPlanV2({ fazendaId: "farm", actorId: "fixture-producer", expectedRevision: revision, draft, enabled: true, confirmed: true });
}
function dateFor(item: typeof normalizedItems[number]) {
  const months = item.operational_window_rule.calendar_months as number[] | undefined;
  return months ? `2026-${String(months[0]).padStart(2, "0")}-04` : normalizedDate;
}

describe("cobertura integral do payload normalizado — 20 itens", () => {
  beforeEach(async () => {
    vi.stubGlobal("localStorage", { getItem: () => "fixture-client", setItem: vi.fn() });
    await db.open(); await clear();
  });
  afterEach(async () => { vi.restoreAllMocks(); await clear(); vi.unstubAllGlobals(); });

  it.each(automaticItemKeys)("regra aprovada permite Agenda sem veterinário executor identificado: %s", async (key) => {
    // Explicit catalog approval in a disposable fixture, never an operational approval.
    await seedNormalizedFixture();
    const original = normalizedItems.find((item) => item.logical_item_key === key)!;
    const date = dateFor(original);
    await seedNormalizedHistory(key, "farm", date);
    const draft = await normalizedDraft("farm", [key], date);
    if (key === "pre_desmama_situacional") {
      draft.ruleContexts[original.id].preWeaningBasis = { kind: "intensive_dairy", reference: "Sistema intensivo/leiteiro declarado na fixture" };
    }
    await saveSanitaryAutomationPlanV2({ fazendaId: "farm", actorId: "fixture-producer", expectedRevision: 0, draft, enabled: true, confirmed: true });
    const facts = await db.event_eventos.count();
    expect((await generate(date)).created).toBeGreaterThan(0);
    expect((await generate(date)).created).toBe(0);
    expect(await db.event_eventos.count()).toBe(facts);
    expect(await db.state_insumo_movimentacoes.count()).toBe(0);
    if (key === "b19_femeas_3_8_meses") expect(original.requires_mv_responsavel).toBe(true);
  });

  it.each(normalizedItems.map((item) => [item.logical_item_key, item] as const))("classifica e testa elegibilidade e exclusão: %s", async (key, original) => {
    await seedNormalizedFixture();
    const date = dateFor(original);
    await seedNormalizedHistory(key, "farm", date);
    const source = await loadSanitaryProtocolWindowSourceV2("farm");
    const item = source.catalog.items.find((row) => row.logicalItemKey === key)!;
    const protocol = source.catalog.protocols.find((row) => row.id === item.protocolId)!;
    const readiness = assessSanitaryAutomationReadinessV2(protocol, item);
    const draft = { context: fixtureContext(key, date), rules: [selectSanitaryAutomationRuleV2(protocol, item)] };
    const preview = previewSanitaryAutomaticPlanV2(source, draft, date);
    expect(preview.entries.find((entry) => entry.animalId === "ineligible")?.eligible).toBe(false);
    const facts = await db.event_eventos.count();
    if (automaticItemKeys.includes(key)) {
      expect(readiness.authorized).toBe(true);
      expect(preview.toCreate).toBeGreaterThan(0);
      await activate([key], date);
      expect(await generate(date)).toMatchObject({ failures: [] });
      const agendas = await db.ops_sanitario_agenda_v2.toArray();
      expect(agendas.length).toBeGreaterThan(0);
      expect(agendas.every((agenda) => agenda.protocol_item_snapshot.itemKey === key)).toBe(true);
      expect(agendas.every((agenda) => agenda.protocol_item_snapshot.planningKind === readiness.kind)).toBe(true);
      expect((await generate(date)).created).toBe(0);
    } else {
      expect(readiness.classification).toBe(blockedItemKeys.includes(key) ? "BLOQUEIO_TECNICO_ESPECIFICO" : "SUGESTAO_CONDICIONAL");
      expect(preview.toCreate).toBe(0);
      expect(preview.entries.every((entry) => entry.reason.length > 0)).toBe(true);
      await expect(activate([key], date)).rejects.toThrow(/sem autorização/);
    }
    expect(await db.event_eventos.count()).toBe(facts);
    expect(await db.state_insumo_movimentacoes.count()).toBe(0);
  });

  it.each(normalizedItems.map((item) => item.logical_item_key))("normalização não autoriza a versão canônica: %s", async (key) => {
    await seedNormalizedFixture("farm", false);
    const source = await loadSanitaryProtocolWindowSourceV2("farm");
    const item = source.catalog.items.find((row) => row.logicalItemKey === key)!;
    const protocol = source.catalog.protocols.find((row) => row.id === item.protocolId)!;
    const result = assessSanitaryAutomationReadinessV2(protocol, item);
    expect(result.authorized).toBe(false);
    expect(result.blockers.length).toBeGreaterThan(0);
    expect(item.allowsAgendaAuto).toBe(false);
    await expect(activate([key])).rejects.toThrow(/sem autorização/);
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(0);
  });

  it.each(["clostridial_primovac_dose2", "clostridial_reforco_anual", "ibr_bvd_primovac_dose2", "lepto_reforco_anual_semestral"])("histórico ausente ou de outro produto bloqueia %s", async (key) => {
    await seedNormalizedFixture(); await activate([key]);
    expect((await generate()).created).toBe(0);
    await seedNormalizedHistory(key);
    await db.event_eventos_sanitario.update(`fixture-fact-${key}`, { produto_veterinario_id: "other-product" });
    expect((await generate()).created).toBe(0);
  });

  it("fazenda com vários protocolos: gera os 12 itens aplicáveis em julho, preserva após restart e concorrência", async () => {
    await seedNormalizedFixture();
    for (const key of automaticItemKeys) await seedNormalizedHistory(key);
    await activate();
    const facts = await db.event_eventos.count();
    const config = await db.state_fazenda_sanidade_config.get("farm");
    expect(readSanitaryAutomationPlanV2(config)?.schemaVersion).toBe(2);
    await Promise.all([generate(), generate()]);
    const agendas = await db.ops_sanitario_agenda_v2.toArray();
    const keys = [...new Set(agendas.map((agenda) => agenda.protocol_item_snapshot.itemKey))].sort();
    expect(keys).toEqual(automaticItemKeys.filter((key) => !["recria_maio", "recria_setembro"].includes(key)).sort());
    expect(new Set(agendas.map((agenda) => agenda.metadata.automationKey)).size).toBe(agendas.length);
    db.close(); await db.open();
    expect((await generate()).created).toBe(0);
    expect(await db.ops_sanitario_agenda_v2.toArray()).toEqual(agendas);
    expect(await db.event_eventos.count()).toBe(facts);
    expect(await db.state_insumo_movimentacoes.count()).toBe(0);
  });

  it("calendário requer adesão regional, UF e categoria; não reaplica uma intervenção no mesmo mês", async () => {
    await seedNormalizedFixture();
    const key = "recria_julho";
    const plan = await activate([key]);
    const item = normalizedItems.find((row) => row.logical_item_key === key)!;
    const source = await loadSanitaryProtocolWindowSourceV2("farm");
    const rule = plan.rules[0];
    expect(previewSanitaryAutomaticPlanV2(source, { context: { ...plan.context, management: "rearing" }, rules: [rule] }, normalizedDate).toCreate).toBe(0);
    const wrongUf = { ...plan, ruleContexts: { [item.id]: { ...fixtureContext(key), regionalCalendar: { uf: "SC", months: [7] } } } };
    expect(previewSanitaryAutomaticPlanV2(source, wrongUf, normalizedDate).toCreate).toBe(0);
    expect((await generate()).created).toBe(1);
    expect((await db.ops_sanitario_agenda_animais_v2.toArray()).map((row) => row.animal_id)).toEqual(["rearing"]);
    const agenda = (await db.ops_sanitario_agenda_v2.toArray())[0];
    await cancelLocalSanitaryAgendaV2({ fazendaId: "farm", agendaId: agenda.id });
    expect((await generate()).created).toBe(0);
    expect((await generate("2027-07-04")).created).toBe(1);
  });

  it("novo calendário anual não é suprimido por fato de ano anterior", async () => {
    await seedNormalizedFixture(); await activate(["recria_julho"]);
    const row = normalizedItems.find((item) => item.logical_item_key === "recria_julho")!;
    await db.event_eventos.put({ id: "past-year", fazenda_id: "farm", animal_id: "rearing", dominio: "sanitario", occurred_at: "2025-07-04", payload: {} } as never);
    await db.event_eventos_sanitario.put({ evento_id: "past-year", fazenda_id: "farm", protocol_item_version_id: row.id, protocol_item_logical_key: row.logical_item_key, protocol_item_snapshot: { protocolId: row.protocol_id, itemKey: row.logical_item_key }, payload: {} } as never);
    expect((await generate()).created).toBe(1);
  });

  it("pré-parto exige fêmea, contexto, alvos e data; pré-confinamento exige entrada programada", async () => {
    await seedNormalizedFixture();
    for (const key of ["matrizes_pre_parto_antiparasitario", "pre_confinamento_dose_unica"]) {
      const draft = await normalizedDraft("farm", [key]);
      const source = await loadSanitaryProtocolWindowSourceV2("farm");
      const item = source.catalog.items.find((row) => row.logicalItemKey === key)!;
      const context = draft.ruleContexts![item.id];
      const window = (override = context) => buildSanitaryProtocolWindowV2({ source, protocolId: item.protocolId, itemId: item.id, evaluatedAt: normalizedDate, operationalContext: override, generationMode: "automatic" })!;
      expect(window().rows.filter((row) => row.canSelect).map((row) => row.animalId)).toEqual(["adult"]);
      expect(window({ ...context, scheduledContext: undefined }).rows.every((row) => !row.canSelect)).toBe(true);
      expect(window({ ...context, scheduledContext: { ...context.scheduledContext!, date: "2026-02-31" } }).rows.every((row) => !row.canSelect)).toBe(true);
      expect(window({ ...context, scheduledContext: { ...context.scheduledContext!, date: "2026-07-05" } }).rows.every((row) => !row.canSelect)).toBe(true);
    }
  });

  it("segunda dose já executada não vira nova intenção só porque falta Agenda local", async () => {
    await seedNormalizedFixture(); const key = "ibr_bvd_primovac_dose2";
    await seedNormalizedHistory(key); await activate([key]);
    const row = normalizedItems.find((item) => item.logical_item_key === key)!;
    await db.event_eventos.put({ id: "executed-dose2", fazenda_id: "farm", animal_id: "calf", dominio: "sanitario", occurred_at: normalizedDate, payload: {} } as never);
    await db.event_eventos_sanitario.put({ evento_id: "executed-dose2", fazenda_id: "farm", produto_veterinario_id: "fixture-product-ibr_bvd", protocol_item_version_id: row.id, protocol_item_logical_key: key, protocol_item_snapshot: { protocolId: row.protocol_id, itemKey: key }, payload: {} } as never);
    expect((await generate()).created).toBe(0);
  });

  it("leptospirose dose 2 só funciona em outra variante explicitamente aprovada, preservando o item canônico bloqueado", async () => {
    await seedNormalizedFixture();
    const original = normalizedItems.find((item) => item.logical_item_key === "lepto_primovac_dose2")!;
    const stored = await db.catalog_sanitario_protocolo_itens_versions_v2.get(original.id);
    await db.catalog_sanitario_protocolo_itens_versions_v2.put({ ...stored!, id: "lepto-dose2-variant-fixture", version: stored!.version + 1,
      item_status: "condicional", allows_agenda_auto: true, snapshot_template: { fixtureApproval: "variante sintética; não altera referência canônica" },
      operational_window_rule: { anchor: "previous_dose", min_offset_days: 21, max_offset_days: 30 },
      booster_rule: { previous_logical_item_key: "lepto_primovac_dose1", recurrenceRule: { kind: "primovaccination_dose_2" } },
    });
    const source = await loadSanitaryProtocolWindowSourceV2("farm");
    const variant = source.catalog.items.find((item) => item.id === "lepto-dose2-variant-fixture")!;
    const protocol = source.catalog.protocols.find((row) => row.id === variant.protocolId)!;
    const draft = { context: fixtureContext(variant.logicalItemKey), rules: [selectSanitaryAutomationRuleV2(protocol, variant)] };
    await saveSanitaryAutomationPlanV2({ fazendaId: "farm", actorId: "fixture-producer", expectedRevision: 0, draft, enabled: true, confirmed: true });
    expect((await generate()).created).toBe(0);
    const initial = normalizedItems.find((item) => item.logical_item_key === "lepto_primovac_dose1")!;
    await db.event_eventos.put({ id: "lepto-initial", fazenda_id: "farm", animal_id: "calf", dominio: "sanitario", occurred_at: "2026-06-10", payload: {} } as never);
    await db.event_eventos_sanitario.put({ evento_id: "lepto-initial", fazenda_id: "farm", produto_veterinario_id: "fixture-product-leptospirose", protocol_item_version_id: initial.id,
      protocol_item_logical_key: initial.logical_item_key, protocol_item_snapshot: { protocolId: initial.protocol_id, itemKey: initial.logical_item_key }, payload: {} } as never);
    expect((await generate()).created).toBe(1);
    expect(await db.catalog_sanitario_protocolo_itens_versions_v2.get(original.id)).toEqual(stored);
  });

  it("cancelamento de manejo preserva a janela e permite outra entrada programada explicitamente", async () => {
    await seedNormalizedFixture(); const key = "pre_confinamento_dose_unica";
    await activate([key]); expect((await generate()).created).toBe(1);
    const agenda = (await db.ops_sanitario_agenda_v2.toArray())[0];
    await cancelLocalSanitaryAgendaV2({ fazendaId: "farm", agendaId: agenda.id });
    expect((await generate()).created).toBe(0);
    await activate([key], "2026-08-04", 1);
    expect((await generate("2026-08-04")).created).toBe(1);
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(2);
  });

  it("pré-parto não inclui macho bovino mesmo com seleção de alvo e contexto declarados", async () => {
    await seedNormalizedFixture(); await db.state_animais.update("adult", { sexo: "M" });
    await activate(["matrizes_pre_parto_antiparasitario"]);
    expect((await generate()).created).toBe(0);
  });

  it("pré-desmama exige sistema ou orientação referenciada, além do estágio de manejo", async () => {
    await seedNormalizedFixture();
    const key = "pre_desmama_situacional";
    const draft = await normalizedDraft("farm", [key]);
    const rule = draft.rules[0];
    draft.ruleContexts![rule.itemId] = { ...fixtureContext(key), preWeaningBasis: undefined };
    await saveSanitaryAutomationPlanV2({ fazendaId: "farm", actorId: "producer", expectedRevision: 0, draft, enabled: true, confirmed: true });
    expect((await generate()).created).toBe(0);
    await activate([key], normalizedDate, 1);
    expect((await generate()).created).toBe(1);
  });
});
