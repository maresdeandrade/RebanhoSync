// Disposable test data only. Never imported by runtime or a catalogue publisher.
import canonical from "../../../../../../tests/codex/fixtures/sanitario-v2-before-r03.json";
import { db } from "@/lib/offline/db";
import type { SanitarioProtocoloItemVersionLocalV2, SanitarioProtocoloLocalV2 } from "@/lib/offline/types";
import { EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2, loadSanitaryProtocolWindowSourceV2, type SanitaryOperationalContextV2 } from "../../../windows/sanitaryProtocolWindowsV2";
import { selectSanitaryAutomationRuleV2, type SanitaryAutomationDraftV2 } from "../../sanitaryAutomationPlanV2";

export const normalizedProtocols = canonical.payload.sanitario_protocolos_v2.rows;
export const normalizedItems = canonical.payload.sanitario_protocolo_itens_versions_v2.rows;
export const normalizedDate = "2026-07-04";
const stamp = { created_at: normalizedDate, updated_at: normalizedDate, deleted_at: null };
export const blockedItemKeys = ["lepto_primovac_dose2", "fmd_historico_contingencia", "fmd_bloqueio_vacinacao_rotina"];
export const automaticItemKeys = normalizedItems.map((item) => item.logical_item_key)
  .filter((key) => !key.startsWith("raiva_") && !blockedItemKeys.includes(key));
const fields = ["eligibility_rule", "operational_window", "product_requirement", "dose", "route", "species_authorization"];
const fixtureSources = Object.fromEntries(fields.map((field) => [field, [{ kind: "norma_oficial", title: "FIXTURE — aprovação sintética isolada; não autoriza catálogo real",
  strength: "forte", evidenceStatus: "SIM_NORMA", fieldKeys: [field] }]]));

export function fixtureContext(itemKey: string, date = normalizedDate): SanitaryOperationalContextV2 {
  const context: SanitaryOperationalContextV2 = { ...EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2, riskContext: true, rabiesRiskArea: true };
  if (itemKey.startsWith("recria_")) return { ...context, management: "rearing", regionalCalendar: { uf: "DF", months: [Number(date.slice(5, 7))] } };
  if (itemKey.startsWith("pre_desmama")) return { ...context, management: "pre_weaning", preWeaningBasis: { kind: "veterinarian", reference: "Indicação MV sintética — FIXTURE" } };
  if (itemKey.startsWith("pre_confinamento")) return { ...context, management: "pre_feedlot", scheduledContext: { date, reference: "Entrada programada — fixture", animalIds: ["adult"] } };
  if (itemKey.startsWith("matrizes_")) return { ...context, reproductiveContext: "prepartum", scheduledContext: { date, reference: "Avaliar intervenção pré-parto — fixture", animalIds: ["adult"] } };
  return context;
}

export async function seedNormalizedFixture(farmId = "farm", approved = true) {
  await db.state_fazenda_sanidade_config.put({ fazenda_id: farmId, uf: "DF", payload: {}, ...stamp } as never);
  await db.state_animais.bulkPut([
    { id: "calf", fazenda_id: farmId, identificacao: "Bezerra integral", especie: "bovino", sexo: "F", status: "ativo", data_nascimento: "2026-03-01", lote_id: null, payload: {}, ...stamp },
    { id: "rearing", fazenda_id: farmId, identificacao: "Recria integral", especie: "bovino", sexo: "M", status: "ativo", data_nascimento: "2025-05-01", lote_id: null, payload: { lifecycle: { estagio_vida: "recria" } }, ...stamp },
    { id: "adult", fazenda_id: farmId, identificacao: "Matriz integral", especie: "bovino", sexo: "F", status: "ativo", data_nascimento: "2022-01-01", lote_id: null, payload: {}, ...stamp },
    { id: "ineligible", fazenda_id: farmId, identificacao: "Espécie fora da regra", especie: "ovino", sexo: "M", status: "ativo", data_nascimento: "2022-01-01", lote_id: null, payload: {}, ...stamp },
  ] as never[]);
  await db.catalog_sanitario_protocolos_v2.bulkPut(normalizedProtocols.map((row) => ({ ...row, ...stamp,
    status: approved && row.family_code !== "febre_aftosa" ? "active" : row.status,
    approval_status: approved ? "approved" : row.approval_status,
    metadata: approved ? { ...row.metadata, agenda_allowed: true, approved_for_catalog: true } : row.metadata,
  })) as unknown as SanitarioProtocoloLocalV2[]);
  await db.catalog_sanitario_protocolo_itens_versions_v2.bulkPut(normalizedItems.map((row) => fixtureItem(row, approved)));
  for (const family of ["clostridioses", "ibr_bvd", "leptospirose"]) {
    const id = `fixture-product-${family}`;
    await db.catalog_sanitario_produtos_v2.put({ id, nome_comercial: `Produto ${family} — FIXTURE`, registro_numero: "fixture", principio_ativo: "Componente isolado sintético", classe: "vacina", status_curatorial: "ativo", ...stamp } as never);
    await db.catalog_sanitario_produto_especie_autorizacao_v2.put({ id: `species-${family}`, product_id: id, species_code: "bovino", aptitude: "all", authorization_status: "SIM_BULA", sexo: null, ...stamp } as never);
  }
}

function fixtureItem(row: typeof normalizedItems[number], approved: boolean): SanitarioProtocoloItemVersionLocalV2 {
  const family = normalizedProtocols.find((protocol) => protocol.id === row.protocol_id)!.family_code;
  const specific = ["clostridioses", "ibr_bvd", "leptospirose"].includes(family);
  if (!approved) return { ...row, ...stamp, dose_rule: {}, route_rule: {} } as unknown as SanitarioProtocoloItemVersionLocalV2;
  const binding = specific ? { dose_rule: { quantity: 2, unit: "mL" }, route_rule: { route: "SC" }, product_id: `fixture-product-${family}`, product_requirement_kind: "specific_product" } : { dose_rule: {}, route_rule: {} };
  return { ...row, ...stamp, ...binding, version: row.version + 1, status: "active",
    source_refs_by_field: fixtureSources, allows_agenda_auto: automaticItemKeys.includes(row.logical_item_key),
  } as unknown as SanitarioProtocoloItemVersionLocalV2;
}

export async function seedNormalizedHistory(key: string, farmId = "farm", date = normalizedDate) {
  const row = normalizedItems.find((item) => item.logical_item_key === key)!;
  const recurrence = row.booster_rule.recurrenceRule.kind;
  const previous = row.operational_window_rule.anchor === "previous_dose";
  const annual = recurrence.startsWith("annual");
  if (!previous && !annual) return;
  const previousRow = previous ? normalizedItems.find((item) => item.protocol_id === row.protocol_id && item.booster_rule.recurrenceRule.kind === "primovaccination_dose_1")! : row;
  const dayOffset = previous ? Number(row.operational_window_rule.min_offset_days) + 1 : 365;
  const occurred = new Date(`${date}T00:00:00Z`); occurred.setUTCDate(occurred.getUTCDate() - dayOffset);
  const localItem = await db.catalog_sanitario_protocolo_itens_versions_v2.get(previousRow.id);
  const eventId = `fixture-fact-${key}`;
  await db.event_eventos.put({ id: eventId, fazenda_id: farmId, dominio: "sanitario", animal_id: annual ? "adult" : "calf", occurred_at: occurred.toISOString(), payload: {}, ...stamp } as never);
  await db.event_eventos_sanitario.put({ evento_id: eventId, fazenda_id: farmId,
    produto_veterinario_id: localItem?.product_id, protocol_item_version_id: previousRow.id,
    protocol_item_logical_key: previousRow.logical_item_key, protocol_item_snapshot: { protocolId: row.protocol_id, itemKey: previousRow.logical_item_key }, payload: {}, ...stamp } as never);
}

export async function normalizedDraft(farmId = "farm", keys = automaticItemKeys, date = normalizedDate): Promise<SanitaryAutomationDraftV2> {
  const source = await loadSanitaryProtocolWindowSourceV2(farmId);
  const items = source.catalog.items.filter((item) => keys.includes(item.logicalItemKey));
  return { context: { ...EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2 },
    rules: items.map((item) => selectSanitaryAutomationRuleV2(source.catalog.protocols.find((protocol) => protocol.id === item.protocolId)!, item)),
    ruleContexts: Object.fromEntries(items.map((item) => [item.id, fixtureContext(item.logicalItemKey, date)])),
  };
}

// Read-only publication evidence replaces synthetic catalog approvals verbatim.
// Animals/configuration stay disposable; this helper never publishes remotely.
export async function seedPublishedCatalogFixture(farmId: string, catalog: {
  protocols: unknown[]; items: unknown[]; groups?: unknown[]; groupMembers?: unknown[];
  sources?: unknown[]; coverage?: unknown[];
}) {
  await seedNormalizedFixture(farmId, false);
  await db.catalog_sanitario_protocolos_v2.clear();
  await db.catalog_sanitario_protocolo_itens_versions_v2.clear();
  await db.catalog_sanitario_produtos_v2.clear();
  await db.catalog_sanitario_produto_especie_autorizacao_v2.clear();
  await db.catalog_sanitario_protocolos_v2.bulkPut(catalog.protocols as never[]);
  await db.catalog_sanitario_protocolo_itens_versions_v2.bulkPut(catalog.items as never[]);
  await db.catalog_sanitario_product_class_groups_v2.bulkPut((catalog.groups ?? []) as never[]);
  await db.catalog_sanitario_product_class_group_members_v2.bulkPut((catalog.groupMembers ?? []) as never[]);
  await db.catalog_sanitario_fontes_tecnicas_v2.bulkPut((catalog.sources ?? []) as never[]);
  await db.catalog_sanitario_fonte_cobertura_campos_v2.bulkPut((catalog.coverage ?? []) as never[]);
}
