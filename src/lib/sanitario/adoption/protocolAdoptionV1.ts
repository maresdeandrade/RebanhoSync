import type { FazendaSanidadeConfig } from "@/lib/offline/types";
import type { SanitaryTriageEvaluationV2 } from "../triage/sanitaryTriageV2";

export const ADOPTION_KEY = "sanitary_protocol_adoption_v1";
export const SANITARY_PROTOCOL_PACKAGES = [
  { id: "legal", label: "Legal", families: [
    { code: "brucelose_b19", label: "Brucelose B19", badge: "Legal" },
    { code: "febre_aftosa", label: "Febre aftosa", badge: "Bloqueado" },
  ] },
  { id: "base", label: "Sanidade Base", families: [
    { code: "clostridioses", label: "Clostridioses", badge: "Recomendado" },
    { code: "raiva_herbivoros", label: "Raiva dos herbívoros", badge: "Condicional" },
  ] },
  { id: "reprodutivo", label: "Reprodutivo", families: [
    { code: "ibr_bvd", label: "IBR/BVD", badge: "Condicional" },
    { code: "leptospirose", label: "Leptospirose", badge: "Condicional" },
  ] },
  { id: "parasitario", label: "Controle Parasitário", families: [
    { code: "vermifugacao_pre_desmama", label: "Pré-desmama", badge: "Situacional" },
    { code: "matrizes_pre_parto", label: "Pré-parto", badge: "Condicional" },
    { code: "controle_parasitario_recria_5_7_9", label: "Controle estratégico", badge: "Estratégico" },
    { code: "vermifugacao_pre_confinamento_pasto_vedado", label: "Pré-confinamento / pasto vedado", badge: "Opcional" },
  ] },
] as const;

export const SANITARY_FAMILY_CODES = SANITARY_PROTOCOL_PACKAGES.flatMap(pack =>
  pack.families.map(family => family.code)).filter(code => code !== "febre_aftosa");

export type ProtocolAdoptionFamiliesV1 = Record<string, { monitoringEnabled: boolean }>;
export type ProtocolAdoptionV1 = {
  schemaVersion: 1;
  revision: number;
  families: ProtocolAdoptionFamiliesV1;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

// Only reconciled config is authoritative. Queue intents never mutate this namespace locally.
export function readProtocolAdoptionV1(config: FazendaSanidadeConfig | undefined | null, farmId: string): ProtocolAdoptionV1 | null {
  if (!config || config.fazenda_id !== farmId || config.deleted_at) return null;
  const saved = record(config.payload?.[ADOPTION_KEY]);
  if (!saved || saved.schemaVersion !== 1 || !Number.isSafeInteger(saved.revision) || Number(saved.revision) < 1) return null;
  const families = record(saved.families);
  if (!families || Object.keys(families).length !== SANITARY_FAMILY_CODES.length ||
    !SANITARY_FAMILY_CODES.every(code => typeof record(families[code])?.monitoringEnabled === "boolean")) return null;
  return saved as unknown as ProtocolAdoptionV1;
}

export function defaultProtocolFamiliesV1(): ProtocolAdoptionFamiliesV1 {
  return Object.fromEntries(SANITARY_FAMILY_CODES.map(code => [code, {
    monitoringEnabled: code !== "vermifugacao_pre_confinamento_pasto_vedado",
  }]));
}

export function isProtocolMonitoringEnabledV1(config: FazendaSanidadeConfig | undefined | null, farmId: string, familyCode: string): boolean {
  if (familyCode === "febre_aftosa") return false;
  return readProtocolAdoptionV1(config, farmId)?.families[familyCode]?.monitoringEnabled ?? true;
}

export type ProtocolStageCountsV1 = {
  eligible: number; future: number; overdue: number; insufficient: number;
  completed: number; restricted: number; scheduled: number;
};
type Bucket = keyof ProtocolStageCountsV1;
const priority: Bucket[] = ["insufficient", "restricted", "completed", "scheduled", "overdue", "eligible", "future"];

function bucket(row: SanitaryTriageEvaluationV2): Bucket | null {
  if (row.documentaryPending || row.status === "insufficient_data" || row.disposition === "insufficient_data") return "insufficient";
  if (row.blockers.length || row.disposition === "restricted") return "restricted";
  if (row.status === "completed" || row.disposition === "factual_completed" || row.disposition === "assessment_completed") return "completed";
  if (row.alreadyPlanned || row.disposition === "scheduled") return "scheduled";
  if (row.disposition === "outside_period") return null;
  if (row.disposition === "opportunity_in_window" || row.disposition === "treatment_indicated") return row.status === "overdue" ? "overdue" : "eligible";
  return row.disposition === "future_opportunity" ? "future" : null;
}

// The caller scopes one canonical stage; competing rows never inflate eligible totals.
export function countProtocolStageAnimalsV1(evaluations: SanitaryTriageEvaluationV2[]): ProtocolStageCountsV1 {
  const animals = new Map<string, Bucket>();
  for (const evaluation of evaluations) {
    const category = bucket(evaluation);
    if (!category) continue;
    const existing = animals.get(evaluation.animalId);
    if (!existing || priority.indexOf(category) < priority.indexOf(existing)) animals.set(evaluation.animalId, category);
  }
  const result: ProtocolStageCountsV1 = { eligible: 0, future: 0, overdue: 0, insufficient: 0, completed: 0, restricted: 0, scheduled: 0 };
  for (const category of animals.values()) result[category] += 1;
  return result;
}
