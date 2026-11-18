import { buildSanitaryProtocolWindowV2, type SanitaryOperationalContextV2, type SanitaryProtocolWindowSourceV2 } from "../windows/sanitaryProtocolWindowsV2";
import { projectSanitaryAssessmentV1 } from "../triage/sanitaryAssessmentProjectionV1";
import type { StrategicVariantV1 } from "../calendar/strategicCalendarPreferenceV1";
import { sanitaryCalendarMonthWindowV1 } from "../windows/sanitaryCalendarWindowV1";

const FAMILY = "controle_parasitario_recria_5_7_9";
type Stage = "may" | "middle" | "september";
type Interval = { startDate?: string; endDate?: string };
export type StrategicStageV1 = { stage: Stage; month: number | null; itemId: string | null; window: Interval | null; temporal: "current" | "future" | "overdue" | "unknown"; lateEntry: boolean | "unknown"; assessment: "not_done" | "no_treatment_indicated" | "treatment_indicated" | "insufficient_data" | "conflict" | "unknown"; application: "proven" | "unknown"; evidenceEventIds: string[]; applicationEventIds: string[]; agendaIds: string[]; legacyAgendaIds: string[]; variantConflict: boolean; blockers: string[]; planningEligible: boolean; canPlan: false };

export function projectStrategicCycleV1(input: { source: SanitaryProtocolWindowSourceV2; animalId: string; cycleYear: number; variant: StrategicVariantV1 | null; configRevision: number | null; evaluatedAt: string; context?: SanitaryOperationalContextV2 }) {
  const { source, animalId, cycleYear, variant, configRevision, evaluatedAt } = input;
  const farmId = source.fazendaId ?? "";
  const animal = source.animals.find(entry => entry.id === animalId && entry.fazenda_id === farmId && !entry.deleted_at);
  const protocols = source.catalog.protocols.filter(entry => entry.familyCode === FAMILY && (!entry.fazendaId || entry.fazendaId === farmId) && entry.status !== "retired");
  const protocolIds = new Set(protocols.map(entry => entry.id));
  const definitions: Array<{ stage: Stage; key: string | null; month: number | null }> = [
    { stage: "may", key: "recria_maio", month: 5 },
    { stage: "middle", key: variant === "5-7-9" ? "recria_julho" : null, month: variant === "5-6-9" ? 6 : variant === "5-7-9" ? 7 : null },
    { stage: "september", key: "recria_setembro", month: 9 },
  ];
  const stages = definitions.map(({ stage, key, month }): StrategicStageV1 => {
    const matching = source.catalog.items.filter(item => protocolIds.has(item.protocolId) && item.logicalItemKey === key && item.status !== "retired").sort((a,b) => b.version-a.version);
    const item = matching.length && (matching.length === 1 || matching[0].version !== matching[1].version) ? matching[0] : undefined;
    const row = item && animal ? buildSanitaryProtocolWindowV2({ source, protocolId: item.protocolId, itemId: item.id, evaluatedAt, ...(input.context ? { operationalContext: input.context } : {}) })?.rows.find(entry => entry.animalId === animalId) : undefined;
    const intervals = row?.temporalWindow?.resolution === "determined" ? row.temporalWindow.intervals.filter(interval => (!interval.startDate || interval.startDate.slice(0,4) <= String(cycleYear)) && (!interval.endDate || interval.endDate.slice(0,4) >= String(cycleYear))) : [];
    // The pre-check currently evaluates calendar_months but does not emit an
    // interval for them. This is a calendar window, not proof of eligibility.
    const calendarWindow = sanitaryCalendarMonthWindowV1(item?.operationalWindowRule, cycleYear, month);
    const window = intervals.length === 1 ? intervals[0] : !row?.temporalWindow && row ? calendarWindow : null;
    const temporal = !window ? "unknown" : window.startDate && evaluatedAt < window.startDate ? "future" : window.endDate && evaluatedAt > window.endDate ? "overdue" : "current";
    const lateEntry = animal?.data_entrada && window?.endDate ? animal.data_entrada > window.endDate : "unknown";
    const assessment = item && farmId && window ? projectSanitaryAssessmentV1({ events: source.contextEvents ?? [], relations: source.assessmentEventAnimals ?? [], farmId, animalId, protocolId: item.protocolId, itemId: item.id, itemVersion: item.version, cycleKey: String(cycleYear), asOf: evaluatedAt, windows: [window] }) : null;
    const assessmentState = !item || !window || !source.contextEvents || !source.assessmentEventAnimals ? "unknown" : assessment?.state ?? "not_done";
    const evidenceEventIds = assessment ? assessment.state === "conflict" ? assessment.evidence.map(e => e.eventId) : assessment.eventId ? [assessment.eventId] : (assessment.evidence ?? []).map(e => e.eventId) : [];
    const applicationEventIds = item && window ? (source.executedHistory.find(entry => entry.animalId === animalId)?.events ?? []).filter(event => {
      const recorded = source.contextEvents?.find(entry => entry.id === event.eventId && entry.fazenda_id === farmId && !entry.deleted_at);
      const instant = new Date(event.executedAt);
      const date = recorded?.occurred_on ?? (Number.isFinite(instant.getTime()) ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(instant) : "");
      return /^\d{4}-\d{2}-\d{2}$/.test(date) && event.protocolId === item.protocolId && event.itemKey === item.logicalItemKey && event.source === "event" && !!event.productId && !!event.doseQuantity && !!event.doseUnit && !!event.route && recorded?.sanitario_sync_v2_nature === "primary_execution" && recorded.sanitario_v3_confirmation === "confirmed" && date <= evaluatedAt && (!window.startDate || date >= window.startDate) && (!window.endDate || date <= window.endDate);
    }).map(event => event.eventId) : [];
    const candidateAgendas = source.agendas.filter(agenda => {
      if (agenda.fazenda_id !== farmId || agenda.deleted_at || agenda.status !== "programada" || (agenda.strategic_cycle_year_v1 != null && agenda.strategic_cycle_year_v1 !== cycleYear)) return false;
      const snapshot = agenda.protocol_item_snapshot as Record<string, unknown> | null;
      const currentProtocol = source.catalog.protocols.find(entry => entry.id === agenda.protocolo_id && (!entry.fazendaId || entry.fazendaId === farmId));
      const agendaItem = source.catalog.items.find(entry => entry.id === agenda.protocol_item_version_id);
      const immutable = agenda.strategic_cycle_year_v1 != null;
      const agendaFamily = immutable ? agenda.strategic_family_v1 : currentProtocol?.familyCode === FAMILY || snapshot?.familyCode === FAMILY ? FAMILY : currentProtocol?.familyCode ?? snapshot?.familyCode;
      const itemKey = agendaItem?.logicalItemKey ?? snapshot?.itemKey;
      const itemDisagrees = agendaItem?.logicalItemKey && snapshot?.itemKey && agendaItem.logicalItemKey !== snapshot.itemKey;
      const agendaStage = immutable ? agenda.strategic_stage_v1 : itemDisagrees ? null : itemKey === "recria_maio" ? "may" : itemKey === "recria_julho" || itemKey === "declared_june" ? "middle" : itemKey === "recria_setembro" ? "september" : null;
      return (agendaFamily == null || agendaFamily === FAMILY) && (agendaStage == null || agendaStage === stage);
    });
    const agendaIds = candidateAgendas.filter(agenda => source.agendaAnimals.some(target => target.fazenda_id === farmId && target.agenda_id === agenda.id && target.animal_id === animalId)).map(agenda => agenda.id);
    const legacyAgendaIds = candidateAgendas.filter(agenda => !source.agendaAnimals.some(target => target.fazenda_id === farmId && target.agenda_id === agenda.id)).map(agenda => agenda.id);
    const variantConflict = variant === "5-6-9" && stage === "middle" && (agendaIds.length > 0 || legacyAgendaIds.length > 0);
    const blockers = [...(row?.blockers ?? [])];
    if (!variant) blockers.push("Variante ainda não configurada.");
    if (variant === "5-6-9" && stage === "middle") blockers.push("Junho contextual sem janela técnica validada; planejamento indisponível.");
    if (!animal) blockers.push("Animal indisponível na fazenda.");
    if (legacyAgendaIds.length) blockers.push("Agenda anterior sem participantes explícitos exige revisão.");
    if (candidateAgendas.some(agenda => agenda.strategic_cycle_year_v1 == null && (agendaIds.includes(agenda.id) || legacyAgendaIds.includes(agenda.id)))) blockers.push("Agenda anterior sem ciclo comprovado exige revisão.");
    if (variantConflict) blockers.push("Agenda intermediária existente exige revisão da variante.");
    if (!variant && stage === "middle" && (agendaIds.length || legacyAgendaIds.length)) blockers.push("Agenda intermediária existente exige revisão da variante desconhecida.");
    return { stage, month, itemId: item?.id ?? null, window, temporal, lateEntry, assessment: assessmentState, application: applicationEventIds.length ? "proven" : "unknown", evidenceEventIds, applicationEventIds, agendaIds, legacyAgendaIds, variantConflict, blockers, planningEligible: Boolean(row?.canSelect && !blockers.length && !row.documentaryPending), canPlan: false };
  });
  return { farmId, animalId, cycleYear, variant, configRevision, stages };
}
