import { describe, expect, it, vi } from "vitest";
import type { SanitaryProtocolWindowSourceV2 } from "../../windows/sanitaryProtocolWindowsV2";
import { projectStrategicCycleV1 } from "../strategicCycleV1";

vi.mock("../../windows/sanitaryProtocolWindowsV2", () => ({
  buildSanitaryProtocolWindowV2: ({ itemId }: { itemId: string }) => {
    const month = { maio: "05", julho: "07", setembro: "09" }[itemId] ?? "05";
    return { rows: [{ animalId: "animal", canSelect: true, blockers: [], documentaryPending: false,
      status: "in_action_window", temporalWindow: itemId === "no-window" ? undefined : { resolution: "determined", intervals: [{ startDate: `2026-${month}-01`, endDate: `2026-${month}-28` }] } }] };
  },
}));
const family = "controle_parasitario_recria_5_7_9";
function source(): SanitaryProtocolWindowSourceV2 {
  return { fazendaId: "farm", catalog: { protocols: [{ id: "protocol", familyCode: family, status: "active", fazendaId: null }],
    items: ["maio", "julho", "setembro"].map(name => ({ id: name, protocolId: "protocol", logicalItemKey: `recria_${name}`, version: 1, status: "active" })) },
    animals: [{ id: "animal", fazenda_id: "farm", data_entrada: "2026-06-01", deleted_at: null }], lots: [],
    agendas: [], agendaAnimals: [], contextEvents: [], assessmentEventAnimals: [], executedHistory: [], executedEvents: [] } as unknown as SanitaryProtocolWindowSourceV2;
}
const project = (s = source(), variant: "5-7-9" | "5-6-9" | null = "5-7-9") => projectStrategicCycleV1({ source: s, animalId: "animal", cycleYear: 2026, variant, configRevision: variant ? 1 : null, evaluatedAt: "2026-08-01" });
const fact = (id: string, result: string, correction: string | null = null) => ({ id, fazenda_id: "farm", dominio: "sanitario", occurred_at: "2026-05-10T12:00:00Z", corrige_evento_id: correction, deleted_at: null,
  payload: { schema: "sanitary_assessment_v1", assessment: { schema_version: 1, result, protocol_id: "protocol", item_id: "maio", item_version: 1, cycle_key: "2026", responsible_name: "Ana" } } });

describe("controle estratégico por animal e ciclo", () => {
  it("utiliza etapas reais, temporalidade e entrada tardia sem fabricar execução", () => {
    const result = project();
    expect(result.stages.map(s => [s.stage, s.itemId, s.month, s.temporal, s.lateEntry])).toEqual([
      ["may", "maio", 5, "overdue", true], ["middle", "julho", 7, "overdue", false], ["september", "setembro", 9, "future", false],
    ]);
    expect(result.stages[0]).toMatchObject({ assessment: "not_done", application: "unknown" });
  });
  it("distingue avaliação, indicação, informação insuficiente e correção sem promover dose", () => {
    const s = source();
    s.contextEvents = [fact("a", "no_treatment_indicated"), fact("b", "treatment_indicated", "a")] as never;
    s.assessmentEventAnimals = ["a", "b"].map(evento_id => ({ evento_id, fazenda_id: "farm", animal_id: "animal" })) as never;
    expect(project(s).stages[0]).toMatchObject({ assessment: "treatment_indicated", application: "unknown", evidenceEventIds: ["b"] });
    s.contextEvents!.push(fact("c", "insufficient_data") as never);
    s.assessmentEventAnimals!.push({ evento_id: "c", fazenda_id: "farm", animal_id: "animal" } as never);
    expect(project(s).stages[0].assessment).toBe("conflict");
  });
  it("isola fazenda e participantes e identifica aplicação V3 efetivamente comprovada", () => {
    const s = source();
    s.contextEvents = [fact("a", "no_treatment_indicated"), { id: "dose", fazenda_id: "farm", dominio: "sanitario", occurred_at: "2026-05-10T12:00:00Z", sanitario_sync_v2_nature: "primary_execution", sanitario_v3_confirmation: "confirmed", deleted_at: null, payload: {} }] as never;
    s.assessmentEventAnimals = [{ evento_id: "a", fazenda_id: "other", animal_id: "animal" }] as never;
    s.executedHistory = [{ animalId: "animal", events: [{ eventId: "dose", protocolId: "protocol", familyCode: family, itemKey: "recria_maio", executedAt: "2026-05-10T12:00:00Z", productId: "produto", doseQuantity: 2, doseUnit: "mL", route: "SC", source: "event" }] }];
    expect(project(s).stages[0]).toMatchObject({ assessment: "not_done", application: "proven", applicationEventIds: ["dose"] });
    s.contextEvents![1].fazenda_id = "other";
    expect(project(s).stages[0].application).toBe("unknown");
  });
  it("5-6-9 não cria item de junho, preserva e sinaliza Agenda de julho", () => {
    const s = source();
    s.agendas = [{ id: "agenda-julho", fazenda_id: "farm", status: "programada", protocolo_id: "protocol", protocol_item_version_id: "julho", protocol_item_snapshot: { itemKey: "recria_julho" }, data_programada: "2026-07-10", deleted_at: null }] as never;
    s.agendaAnimals = [{ agenda_id: "agenda-julho", animal_id: "animal", fazenda_id: "farm", planned_status: "planned" }] as never;
    const middle = project(s, "5-6-9").stages[1];
    expect(middle).toMatchObject({ month: 6, itemId: null, window: null, canPlan: false, variantConflict: true, agendaIds: ["agenda-julho"] });
    expect(s.agendas[0].protocol_item_version_id).toBe("julho");
    expect(project(s, null).stages[1]).toMatchObject({ itemId: null, agendaIds: ["agenda-julho"] });
  });
  it("não inventa configuração nem participação histórica derivada de lote", () => {
    const s = source();
    s.agendas = [{ id: "legacy", fazenda_id: "farm", status: "programada", protocolo_id: "protocol", protocol_item_version_id: "maio", protocol_item_snapshot: { itemKey: "recria_maio" }, data_programada: "2026-05-10", lote_id: "lot", deleted_at: null }] as never;
    expect(project(s, null).stages[0]).toMatchObject({ canPlan: false, agendaIds: [], legacyAgendaIds: ["legacy"] });
    expect(project(s, null).stages[1]).toMatchObject({ month: null, itemId: null });
  });
  it("mantém desconhecida a avaliação quando a fonte factual está indisponível", () => {
    const s = source(); s.contextEvents = undefined;
    expect(project(s).stages[0].assessment).toBe("unknown");
  });
  it("usa o mês curatorial explícito quando o pré-check não retorna intervalo", () => {
    const s = source();
    Object.assign(s.catalog.items[0], { id: "no-window", operationalWindowRule: { type: "calendar", calendar_months: [5] } });
    const result = projectStrategicCycleV1({ source: s, animalId: "animal", cycleYear: 2025, variant: "5-7-9", configRevision: 1, evaluatedAt: "2026-08-01" });
    expect(result.stages[0]).toMatchObject({ window: { startDate: "2025-05-01", endDate: "2025-05-31" }, canPlan: false });
  });
  it("usa a data civil da fazenda para aplicação próxima à meia-noite UTC", () => {
    const s = source();
    s.contextEvents = [{ id: "dose", fazenda_id: "farm", dominio: "sanitario", occurred_at: "2026-05-29T01:00:00Z", sanitario_sync_v2_nature: "primary_execution", sanitario_v3_confirmation: "confirmed", deleted_at: null, payload: {} }] as never;
    s.executedHistory = [{ animalId: "animal", events: [{ eventId: "dose", protocolId: "protocol", familyCode: family, itemKey: "recria_maio", executedAt: "2026-05-29T01:00:00Z", productId: "p", doseQuantity: 2, doseUnit: "mL", route: "SC", source: "event" }] }];
    expect(project(s).stages[0].application).toBe("proven");
  });
  it("mantém ciclo original após reagendamento e sinaliza Agenda legada sem ciclo", () => {
    const s = source();
    s.agendas = [{ id: "rescheduled", fazenda_id: "farm", status: "programada", protocolo_id: "protocol", protocol_item_version_id: "maio", protocol_item_snapshot: { itemKey: "recria_maio" }, data_programada: "2027-05-10", strategic_cycle_year_v1: 2026, strategic_family_v1: family, strategic_stage_v1: "may", deleted_at: null }, { id: "legacy", fazenda_id: "farm", status: "programada", protocolo_id: "protocol", protocol_item_version_id: "maio", protocol_item_snapshot: { itemKey: "recria_maio" }, data_programada: "2022-05-10", strategic_cycle_year_v1: null, deleted_at: null }] as never;
    s.agendaAnimals = [{ agenda_id: "rescheduled", animal_id: "animal", fazenda_id: "farm" }] as never;
    expect(project(s).stages[0]).toMatchObject({ agendaIds: ["rescheduled"], legacyAgendaIds: ["legacy"] });
  });
  it("localiza Agenda pela identidade imutável após mudança ou retirada do catálogo", () => {
    const s = source();
    Object.assign(s.catalog.protocols[0], { familyCode: "outra_familia", status: "retired" });
    s.agendas = [{ id: "confirmed", fazenda_id: "farm", status: "programada", protocolo_id: "protocol", protocol_item_version_id: "julho", protocol_item_snapshot: { itemKey: "recria_julho" }, data_programada: "2026-07-10", strategic_cycle_year_v1: 2026, strategic_family_v1: family, strategic_stage_v1: "middle", deleted_at: null }] as never;
    s.agendaAnimals = [{ agenda_id: "confirmed", animal_id: "animal", fazenda_id: "farm" }] as never;
    expect(project(s, null).stages[1].agendaIds).toEqual(["confirmed"]);
  });
});
