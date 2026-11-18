type Event = { id: string; fazenda_id: string; dominio: string; occurred_at: string; occurred_on?: string | null; deleted_at?: string | null; corrige_evento_id?: string | null; sanitario_v3_confirmation?: string | null; payload: Record<string, unknown> };
type Relation = { evento_id: string; animal_id: string; fazenda_id: string };
type Outcome = "no_treatment_indicated" | "treatment_indicated" | "insufficient_data";
export type AssessmentEvidenceV1 = { eventId: string; result: Outcome; occurredAt: string; responsibleName: string; observation: string | null };
type Projection = { state: Outcome; eventId?: string; evidence?: AssessmentEvidenceV1[] } | { state: "conflict"; evidence: AssessmentEvidenceV1[] } | null;

function civilDate(event: Event): string | null {
  if (event.occurred_on && /^\d{4}-\d{2}-\d{2}$/.test(event.occurred_on)) return event.occurred_on;
  if (/^\d{4}-\d{2}-\d{2}$/.test(event.occurred_at)) return event.occurred_at;
  const date = new Date(event.occurred_at);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date) : null;
}

export function projectSanitaryAssessmentV1(input: {
  events: readonly Event[]; relations: readonly Relation[]; farmId: string; animalId: string;
  protocolId: string; itemId: string; itemVersion: number; cycleKey: string; cycleKeys?: readonly string[]; asOf: string;
  windows?: readonly { startDate?: string; endDate?: string }[];
}): Projection {
  const participants = new Set(input.relations.filter(r => r.fazenda_id === input.farmId && r.animal_id === input.animalId).map(r => r.evento_id));
  const candidates = input.events.flatMap(event => {
    if (event.fazenda_id !== input.farmId || event.dominio !== "sanitario" || event.deleted_at ||
        (event.sanitario_v3_confirmation != null && event.sanitario_v3_confirmation !== "confirmed") ||
        !participants.has(event.id) || !civilDate(event) || civilDate(event)! > input.asOf ||
        event.payload?.schema !== "sanitary_assessment_v1") return [];
    const raw = event.payload.assessment;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const value = raw as Record<string, unknown>;
    if (value.schema_version !== 1 || value.protocol_id !== input.protocolId || value.item_id !== input.itemId ||
        value.item_version !== input.itemVersion || !(input.cycleKeys ?? [input.cycleKey]).includes(String(value.cycle_key)) ||
        !["no_treatment_indicated", "treatment_indicated", "insufficient_data"].includes(String(value.result))) return [];
    return [{ event, result: value.result as Outcome, responsibleName: typeof value.responsible_name === "string" ? value.responsible_name : "Responsável não informado", observation: typeof value.observation === "string" ? value.observation : null }];
  });
  const known = new Set(candidates.map(candidate => candidate.event.id));
  if (candidates.some(candidate => candidate.event.corrige_evento_id && !known.has(candidate.event.corrige_evento_id))) return { state: "conflict", evidence: [] };
  if (input.windows && input.windows.length === 0 && candidates.length) return { state: "conflict", evidence: [] };
  const byId = new Map(candidates.map(candidate => [candidate.event.id, candidate]));
  const relevant = candidates.filter(candidate => {
    if (!input.windows) return true;
    let root = candidate;
    const visited = new Set<string>();
    while (root.event.corrige_evento_id) {
      if (visited.has(root.event.id)) return true;
      visited.add(root.event.id);
      root = byId.get(root.event.corrige_evento_id)!;
    }
    const date = civilDate(root.event)!;
    return input.windows.some(window => (!window.startDate || date >= window.startDate) && (!window.endDate || date <= window.endDate));
  });
  const corrected = new Set(relevant.map(candidate => candidate.event.corrige_evento_id).filter(Boolean));
  const latest = relevant.filter(candidate => !corrected.has(candidate.event.id));
  if (latest.length === 0) return relevant.length ? { state: "conflict", evidence: [] } : null;
  if (latest.length !== 1) {
    const evidence = latest.map(({ event, result, responsibleName, observation }) => ({ eventId: event.id, result, occurredAt: event.occurred_at, responsibleName, observation }));
    return latest.every(candidate => candidate.result === latest[0].result) ? { state: latest[0].result, evidence } : { state: "conflict", evidence };
  }
  return { state: latest[0].result, eventId: latest[0].event.id };
}
