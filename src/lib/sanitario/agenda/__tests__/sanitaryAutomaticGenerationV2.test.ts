import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/offline/db";
import { saveSanitaryAutomationPlanV2, readSanitaryAutomationPlanV2, selectSanitaryAutomationRuleV2, SANITARY_AUTOMATION_PLAN_KEY, type SanitaryAutomationDraftV2 } from "../sanitaryAutomationPlanV2";
import { generateSanitaryAutomaticAgendasV2, previewSanitaryAutomaticPlanV2 } from "../sanitaryAutomaticGenerationV2";
import { loadSanitaryProtocolWindowSourceV2, createGroupedManualSanitaryAgendasV2, EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2 } from "../../windows/sanitaryProtocolWindowsV2";
import { cancelLocalSanitaryAgendaV2, rescheduleLocalSanitaryAgendaV2 } from "../sanitaryLocalAgendaManagementV2";

vi.mock("@/lib/offline/localReadBoundary", () => ({
  requireTenantSensitiveRead: vi.fn().mockResolvedValue(undefined),
  requireTenantSensitiveWrite: vi.fn().mockResolvedValue(undefined),
  requireTenantSensitiveAccess: vi.fn().mockResolvedValue(undefined),
}));
const date = "2026-07-04";
const stamp = { created_at: date, updated_at: date, deleted_at: null };
const sources = Object.fromEntries(["eligibility_rule", "operational_window", "product_requirement", "composition", "dose", "route", "species_authorization"].map((field) => [field, [{
  kind: "norma_oficial", title: "Fixture explicitamente aprovada — teste", strength: "forte", evidenceStatus: "SIM_NORMA", fieldKeys: [field],
}]]));
const protocol = {
  id: "b19", family_code: "brucelose_b19", name: "B19 teste", scope: "global", fazenda_id: null,
  version: 1, status: "active", approval_status: "approved", legal_status: "obrigatorio_norma",
  species_scope: {}, jurisdiction_scope: {}, source_refs_snapshot: [], metadata: {}, ...stamp,
};
const item = {
  id: "b19-item", protocol_id: "b19", logical_item_key: "b19_femeas_3_8_meses", version: 1,
  status: "active", item_status: "obrigatorio", action_type: "vacinacao", product_requirement_kind: "product_class",
  product_id: null, product_class: "vacina_brucelose_b19", product_class_group_id: null,
  eligibility_rule: { species: ["bovino", "bubalino"], sex: "femea" },
  operational_window_rule: {}, dose_rule: {}, route_rule: {}, booster_rule: {}, species_authorization: {},
  source_refs_by_field: sources, limitations: [], snapshot_template: {}, allows_agenda_auto: true, requires_mv_responsavel: true, ...stamp,
};
async function seed() {
  await db.state_fazenda_sanidade_config.put({ fazenda_id: "farm", uf: "MG", payload: { unrelated: "preserved" }, ...stamp } as never);
  await db.catalog_sanitario_protocolos_v2.put(protocol);
  await db.catalog_sanitario_protocolo_itens_versions_v2.put(item);
  await db.state_animais.bulkPut([
    { id: "female", fazenda_id: "farm", identificacao: "Bezerra", especie: "bovino", sexo: "F", status: "ativo", data_nascimento: "2026-03-01", lote_id: null, ...stamp },
    { id: "male", fazenda_id: "farm", identificacao: "Macho", especie: "bovino", sexo: "M", status: "ativo", data_nascimento: "2026-03-01", lote_id: null, ...stamp },
    { id: "foreign", fazenda_id: "other", identificacao: "Outra fazenda", especie: "bovino", sexo: "F", status: "ativo", data_nascimento: "2026-03-01", lote_id: null, ...stamp },
  ] as never[]);
}
async function draftFor(itemId = "b19-item"): Promise<SanitaryAutomationDraftV2> {
  const source = await loadSanitaryProtocolWindowSourceV2("farm");
  const selected = source.catalog.items.find((entry) => entry.id === itemId)!;
  const selectedProtocol = source.catalog.protocols.find((entry) => entry.id === selected.protocolId)!;
  return { rules: [selectSanitaryAutomationRuleV2(selectedProtocol, selected)], context: EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2 };
}
async function activate(draft?: SanitaryAutomationDraftV2, expectedRevision = 0) {
  return saveSanitaryAutomationPlanV2({ fazendaId: "farm", actorId: "producer", expectedRevision,
    draft: draft ?? await draftFor(), enabled: true, confirmed: true });
}
const generate = () => generateSanitaryAutomaticAgendasV2({ fazendaId: "farm", referenceDate: date });
async function clear() { await Promise.all(db.tables.map((table) => table.clear())); }

async function seedSpecificRule(protocolId: string, familyCode: string, itemId: string, key: string, booster = {}) {
  await db.catalog_sanitario_protocolos_v2.put({ ...protocol, id: protocolId, family_code: familyCode, name: familyCode });
  await db.catalog_sanitario_protocolo_itens_versions_v2.put({
    ...item, id: itemId, protocol_id: protocolId, logical_item_key: key, product_requirement_kind: "specific_product",
    product_id: "technical-product", product_class: "vacina_teste", booster_rule: booster,
    operational_window_rule: { anchor: "previous_dose", min_offset_days: 21, max_offset_days: 40 },
    dose_rule: { quantity: 5, unit: "mL" }, route_rule: { route: "SC" },
    eligibility_rule: { species: ["bovino"] },
  });
  await db.catalog_sanitario_produtos_v2.put({ id: "technical-product", nome_comercial: "Fertiguard Selenium Max — fixture", registro_numero: "registro-sintetico",
    principio_ativo: "IBR, BVD e Leptospira — fixture", classe: "vacina_teste", status_curatorial: "ativo", ...stamp } as never);
  await db.catalog_sanitario_produto_especie_autorizacao_v2.put({ id: "species", product_id: "technical-product", species_code: "bovino", aptitude: "all", authorization_status: "SIM_BULA", sexo: null, ...stamp } as never);
}

async function seedPreviousDose(protocolId: string, previousKey: string) {
  await db.catalog_sanitario_protocolo_itens_versions_v2.put({ ...item, id: "previous-item", protocol_id: protocolId, logical_item_key: previousKey, product_id: "technical-product" });
  await db.event_eventos.put({ id: "dose1", fazenda_id: "farm", dominio: "sanitario", animal_id: "female", occurred_at: "2026-06-01", payload: {}, ...stamp } as never);
  await db.event_eventos_sanitario.put({ evento_id: "dose1", fazenda_id: "farm", produto_veterinario_id: "technical-product", protocol_item_logical_key: previousKey, protocol_item_version_id: "previous-item",
    protocol_item_snapshot: { protocolId, itemKey: previousKey }, payload: {}, ...stamp } as never);
}

describe("plano sanitário automático persistente", () => {
  beforeEach(async () => {
    vi.stubGlobal("localStorage", { getItem: () => "fixture-client", setItem: vi.fn() });
    await db.open(); await clear(); await seed();
  });
  afterEach(async () => { vi.restoreAllMocks(); await clear(); vi.unstubAllGlobals(); });

  it("persiste no payload canônico via gesture, com confirmação, revisão e contexto", async () => {
    const plan = await activate();
    const config = await db.state_fazenda_sanidade_config.get("farm");
    expect(readSanitaryAutomationPlanV2(config)).toEqual(plan);
    expect(config?.payload.unrelated).toBe("preserved");
    expect(plan).toMatchObject({ enabled: true, revision: 1, confirmedBy: "producer" });
    expect((await db.queue_ops.toArray()).map((op) => op.table)).toEqual(["fazenda_sanidade_config"]);
    db.close(); await db.open();
    expect(readSanitaryAutomationPlanV2(await db.state_fazenda_sanidade_config.get("farm"))?.enabled).toBe(true);
  });
  it("exige confirmação apenas para ativar, gera B19 elegível sem produto e exclui macho", async () => {
    const draft = await draftFor();
    await expect(saveSanitaryAutomationPlanV2({ fazendaId: "farm", actorId: "producer", expectedRevision: 0, draft, enabled: true, confirmed: false })).rejects.toThrow(/Confirme/);
    await activate(draft);
    const preview = previewSanitaryAutomaticPlanV2(await loadSanitaryProtocolWindowSourceV2("farm"), draft, date);
    expect(preview.toCreate).toBe(1);
    expect(preview.entries.find((entry) => entry.animalId === "male")?.eligible).toBe(false);
    expect(await generate()).toMatchObject({ created: 1, failures: [] });
    const agenda = (await db.ops_sanitario_agenda_v2.toArray())[0];
    expect(agenda).toMatchObject({ produto_veterinario_id: null, execution_evento_id: null });
    expect(agenda.protocol_item_snapshot).toMatchObject({ generationMode: "automatic", planningKind: "avaliacao_manejo_generica" });
    expect(agenda.metadata.automationPlanRevision).toBe(1);
    expect(await db.event_eventos.count()).toBe(0);
    expect(await db.state_insumo_movimentacoes.count()).toBe(0);
  });
  it("B19 em Santa Catarina não gera intenção", async () => {
    await db.state_fazenda_sanidade_config.update("farm", { uf: "SC" });
    await activate();
    expect((await generate()).created).toBe(0);
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(0);
  });
  it("não promove item sem allows_agenda_auto", async () => {
    await db.catalog_sanitario_protocolo_itens_versions_v2.update("b19-item", { allows_agenda_auto: false });
    await expect(activate()).rejects.toThrow(/sem autorização/);
    expect(await db.queue_ops.count()).toBe(0);
  });
  it("revogação técnica posterior à ativação impede nova intenção", async () => {
    await activate();
    await db.catalog_sanitario_protocolo_itens_versions_v2.update("b19-item", { allows_agenda_auto: false });
    expect((await generate()).created).toBe(0);
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(0);
  });
  it("concorrência, clique repetido e retry convergem para uma identidade persistente", async () => {
    await activate();
    const results = await Promise.all([generate(), generate(), generate()]);
    expect(results.reduce((total, result) => total + result.created, 0)).toBe(1);
    const before = await db.ops_sanitario_agenda_v2.toArray();
    db.close(); await db.open();
    expect((await generate()).created).toBe(0);
    expect(await db.ops_sanitario_agenda_v2.toArray()).toEqual(before);
  });
  it("falha intermediária reverte intenção e permite retry mantendo plano ativo", async () => {
    await activate();
    vi.spyOn(db.ops_sanitario_agenda_animais_v2, "bulkPut").mockRejectedValueOnce(new Error("falha local"));
    expect((await generate()).failures).toContain("falha local");
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(0);
    vi.restoreAllMocks();
    expect((await generate()).created).toBe(1);
  });
  it("preserva reagendamento e cancelamento após reativação/restart", async () => {
    await activate(); await generate();
    const agenda = (await db.ops_sanitario_agenda_v2.toArray())[0];
    await rescheduleLocalSanitaryAgendaV2({ agendaId: agenda.id, fazendaId: "farm", plannedFor: "2026-07-20" });
    await generate();
    expect((await db.ops_sanitario_agenda_v2.get(agenda.id))?.data_programada).toBe("2026-07-20");
    await cancelLocalSanitaryAgendaV2({ agendaId: agenda.id, fazendaId: "farm" });
    await activate(undefined, 1);
    db.close(); await db.open(); await generate();
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(1);
    expect((await db.ops_sanitario_agenda_v2.get(agenda.id))?.status).toBe("cancelada");
  });
  it("desativação impede nova geração sem apagar Agendas", async () => {
    const original = await activate(); await generate();
    const disabled = await saveSanitaryAutomationPlanV2({ fazendaId: "farm", actorId: "other-producer", expectedRevision: 1, draft: await draftFor(), enabled: false, confirmed: false });
    expect(disabled.confirmedBy).toBe(original.confirmedBy);
    expect(disabled.confirmedAt).toBe(original.confirmedAt);
    expect((await generate()).enabled).toBe(false);
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(1);
  });
  it("troca de fazenda isola plano e alvos", async () => {
    await activate();
    expect((await generateSanitaryAutomaticAgendasV2({ fazendaId: "other", referenceDate: date })).enabled).toBe(false);
    await generate();
    expect((await db.ops_sanitario_agenda_animais_v2.toArray()).map((link) => link.animal_id)).toEqual(["female"]);
  });
  it("revalida a ativação sob o lock do writer após um preview desatualizado", async () => {
    const plan = await activate();
    const preview = previewSanitaryAutomaticPlanV2(await loadSanitaryProtocolWindowSourceV2("farm"), plan, date);
    await saveSanitaryAutomationPlanV2({ fazendaId: "farm", actorId: "producer", expectedRevision: 1, draft: plan, enabled: false, confirmed: false });
    await expect(createGroupedManualSanitaryAgendasV2({ fazendaId: "farm", plannedFor: date,
      planRevision: plan.revision, rows: preview.entries.filter((entry) => entry.eligible).map((entry) => entry.row!) })).rejects.toThrow(/desativado ou alterado/);
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(0);
  });
  it("alteração de versão exige nova confirmação e preserva Agendas anteriores", async () => {
    await activate(); await generate();
    const before = await db.ops_sanitario_agenda_v2.toArray();
    await db.catalog_sanitario_protocolos_v2.update("b19", { version: 2 });
    expect((await generate()).created).toBe(0);
    expect(await db.ops_sanitario_agenda_v2.toArray()).toEqual(before);
    const plan = readSanitaryAutomationPlanV2(await db.state_fazenda_sanidade_config.get("farm"))!;
    expect(previewSanitaryAutomaticPlanV2(await loadSanitaryProtocolWindowSourceV2("farm"), plan, date).entries[0].reason).toMatch(/Versão/);
  });
  it("revisões concorrentes não sobrescrevem configuração mais recente", async () => {
    const results = await Promise.allSettled([activate(), activate()]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(readSanitaryAutomationPlanV2(await db.state_fazenda_sanidade_config.get("farm"))?.revision).toBe(1);
  });
  it("segunda dose exige esquema selecionado e primeira dose factual do mesmo produto", async () => {
    await seedSpecificRule("clost", "clostridioses", "dose2", "clostridial_primovac_dose2", { previous_logical_item_key: "clostridial_primovac_dose1" });
    await activate(await draftFor("dose2"));
    expect((await generate()).created).toBe(0);
    await seedPreviousDose("clost", "clostridial_primovac_dose1");
    await db.event_eventos_sanitario.update("dose1", { produto_veterinario_id: "other-product" });
    expect((await generate()).created).toBe(0);
    await db.event_eventos_sanitario.update("dose1", { produto_veterinario_id: "technical-product" });
    expect(await generate()).toMatchObject({ created: 1, failures: [] });
    expect(await db.event_eventos.count()).toBe(1);
    expect(await db.state_insumo_movimentacoes.count()).toBe(0);
  });
  it("produto polivalente compatível não cria duas aplicações sem contrato factual múltiplo", async () => {
    await seedSpecificRule("ibr", "ibr_bvd", "ibr-item", "ibr_bvd_primovac_dose1");
    await seedSpecificRule("lepto", "leptospirose", "lepto-item", "lepto_primovac_dose1");
    await db.catalog_sanitario_protocolo_itens_versions_v2.update("ibr-item", { operational_window_rule: {} });
    await db.catalog_sanitario_protocolo_itens_versions_v2.update("lepto-item", { operational_window_rule: {} });
    const first = await draftFor("ibr-item"); const second = await draftFor("lepto-item");
    await activate({ ...first, rules: [...first.rules, ...second.rules] });
    const source = await loadSanitaryProtocolWindowSourceV2("farm");
    const plan = readSanitaryAutomationPlanV2(source.farmConfig)!;
    expect(previewSanitaryAutomaticPlanV2(source, plan, date).toCreate).toBe(0);
    expect((await generate()).created).toBe(0);
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(0);
  });
  it.each(["raiva_primovac_dose1", "raiva_primovac_reforco_30d", "raiva_reforco_anual_area_risco"])("respeita no_agenda_auto em %s", async (key) => {
    await db.catalog_sanitario_protocolos_v2.update("b19", { family_code: "raiva_herbivoros" });
    await db.catalog_sanitario_protocolo_itens_versions_v2.update("b19-item", { logical_item_key: key, limitations: ["no_agenda_auto"] });
    await expect(activate()).rejects.toThrow(/sem autorização/);
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(0);
  });
});
