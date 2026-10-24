import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/offline/db";
import { generateSanitaryAutomaticAgendasV2 } from "../sanitaryAutomaticGenerationV2";
import { saveSanitaryAutomationPlanV2 } from "../sanitaryAutomationPlanV2";
import { blockedItemKeys, normalizedDraft, normalizedItems, seedPublishedCatalogFixture, normalizedDate } from "./fixtures/sanitaryNormalizedFixtureV2";

vi.mock("@/lib/offline/localReadBoundary", () => ({ requireTenantSensitiveRead: vi.fn().mockResolvedValue(undefined),
  requireTenantSensitiveWrite: vi.fn().mockResolvedValue(undefined), requireTenantSensitiveAccess: vi.fn().mockResolvedValue(undefined) }));
// Consume publication evidence from the RPC harness or a read-only remote export.
const catalogPath = process.env.SANITARIO_APPROVED_CATALOG;
const catalog = catalogPath ? JSON.parse(readFileSync(catalogPath, "utf8")) : null;
const keys = ["b19_femeas_3_8_meses", "recria_maio", "recria_julho", "recria_setembro", "pre_desmama_situacional", "pre_confinamento_dose_unica", "matrizes_pre_parto_antiparasitario"];
const clear = () => Promise.all(db.tables.map(table => table.clear()));
const generate = (date = normalizedDate) => generateSanitaryAutomaticAgendasV2({ fazendaId: "farm", referenceDate: date });
async function activate(selected: string[], date = normalizedDate) {
  const draft = await normalizedDraft("farm", selected, date);
  const approvedIds = new Set(catalog.items.filter((item: { allows_agenda_auto: boolean }) => item.allows_agenda_auto).map((item: { id: string }) => item.id));
  draft.rules = draft.rules.filter(rule => approvedIds.has(rule.itemId));
  for (const context of Object.values(draft.ruleContexts ?? {})) if (context.preWeaningBasis) context.preWeaningBasis = { kind: "intensive_dairy", reference: "Sistema intensivo/leiteiro declarado na fixture local" };
  await saveSanitaryAutomationPlanV2({ fazendaId: "farm", actorId: "fixture-producer", expectedRevision: 0, draft, enabled: true, confirmed: true });
}

describe.skipIf(!catalog)("catálogo publicado pela RPC real → plano existente → Agendas locais", () => {
  beforeEach(async () => {
    vi.stubGlobal("localStorage", { getItem: () => "fixture-client", setItem: vi.fn() });
    await db.open(); await clear(); await seedPublishedCatalogFixture("farm", catalog);
  });
  afterEach(async () => { await clear(); vi.unstubAllGlobals(); });
  it.each(keys)("gera avaliação somente para versão efetivamente aprovada: %s", async key => {
    const original = normalizedItems.find(item => item.logical_item_key === key)!;
    const months = original.operational_window_rule.calendar_months as number[] | undefined;
    const date = months ? `2026-${String(months[0]).padStart(2, "0")}-04` : normalizedDate;
    await activate([key], date);
    expect((await generate(date)).created).toBeGreaterThan(0);
    expect((await generate(date)).created).toBe(0);
    const agendas = await db.ops_sanitario_agenda_v2.toArray();
    const approved = catalog.items.find((item: { logical_item_key: string; allows_agenda_auto: boolean }) => item.logical_item_key === key && item.allows_agenda_auto);
    expect(agendas.every(agenda => agenda.protocol_item_version_id === approved.id)).toBe(true);
    expect(await db.event_eventos.count()).toBe(0);
    expect(await db.state_insumo_movimentacoes.count()).toBe(0);
  });
  it("gera cinco regras aplicáveis em julho na mesma fazenda, com concorrência e retomada", async () => {
    await activate(keys);
    await Promise.all([generate(), generate()]);
    const agendas = await db.ops_sanitario_agenda_v2.toArray();
    expect([...new Set(agendas.map(agenda => agenda.protocol_item_snapshot.itemKey))].sort()).toEqual(keys.filter(key => !["recria_maio", "recria_setembro"].includes(key)).sort());
    expect(new Set(agendas.map(agenda => agenda.metadata.automationKey)).size).toBe(agendas.length);
    db.close(); await db.open();
    expect((await generate()).created).toBe(0);
    // R04B can add reviewed class schemes; the six permanent restrictions remain.
    const restricted = catalog.items.filter((item: { logical_item_key: string; status: string }) =>
      item.status !== "retired" && (item.logical_item_key.startsWith("raiva_") || blockedItemKeys.includes(item.logical_item_key)));
    expect(restricted).toHaveLength(6);
    expect(restricted.every((item: { allows_agenda_auto: boolean }) => !item.allows_agenda_auto)).toBe(true);
    expect(await db.event_eventos.count()).toBe(0);
    expect(await db.state_insumo_movimentacoes.count()).toBe(0);
  });
  it.each(keys.filter(key => key !== "b19_femeas_3_8_meses"))("decisão regional não permite extrapolar avaliação para outra UF: %s", async key => {
    await activate([key]);
    await db.state_fazenda_sanidade_config.update("farm", { uf: "GO" });
    expect((await generate()).created).toBe(0);
  });
  it("carimbo sem decisão correspondente ou com campo diferente não substitui aprovação", async () => {
    const item = catalog.items.find((row: { logical_item_key: string; allows_agenda_auto: boolean }) => row.logical_item_key === "recria_julho" && row.allows_agenda_auto);
    await db.catalog_sanitario_protocolo_itens_versions_v2.update(item.id, { snapshot_template: { ...item.snapshot_template, metadata: { ...item.snapshot_template.metadata, catalog_decision_reference: "sanitary-v2:wrong" } } });
    await expect(activate(["recria_julho"])).rejects.toThrow(/sem autorização/);
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(0);
  });
});
