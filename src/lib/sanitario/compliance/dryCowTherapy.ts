import { buildAnimalTaxonomyFactsPayload } from "@/lib/animals/taxonomy";
import type {
  Animal,
  AnimalStatusEnum,
  ProtocoloSanitarioItem,
  SexoEnum,
} from "@/lib/offline/types";
import { buildSanitaryDedupKey } from "@/lib/sanitario/engine/dedup";
import type { ClinicalProtocolRef } from "@/lib/sanitario/compliance/clinicalProtocols";

export const DRY_COW_THERAPY_PROTOCOL_ID = "med-mastite-seca";
export const DRY_COW_THERAPY_ITEM_ID = "secagem-intramamario";
export const DRY_COW_THERAPY_PAYLOAD_KEY = "dry_cow_therapy";
export const DRY_COW_THERAPY_SCHEMA_VERSION = 1;
export const DRY_COW_THERAPY_MATERIALIZATION_CONTRACT_VERSION = 1;
export const DRY_COW_THERAPY_DEFAULT_DUE_DAYS_BEFORE_CALVING = 60;

export type DryCowTherapyAgendaDecision =
  | "keep_as_clinical_protocol"
  | "candidate_for_future_agenda_contract";

export type DryCowTherapyBlockReason =
  | "animal_not_active"
  | "animal_not_female"
  | "not_in_lactation"
  | "already_dried_off"
  | "missing_expected_calving_date"
  | "outside_dry_off_window"
  | "invalid_reference_date";

export type DryCowTherapyReadinessInput = {
  animal: Pick<Animal, "sexo" | "status" | "payload">;
  referenceDate: string;
  dryOffWindowStartDaysBeforeCalving?: number;
  dryOffWindowEndDaysBeforeCalving?: number;
};

export type DryCowTherapyReadiness = {
  protocolId: typeof DRY_COW_THERAPY_PROTOCOL_ID;
  itemId: typeof DRY_COW_THERAPY_ITEM_ID;
  decision: DryCowTherapyAgendaDecision;
  agendaMaterializationAllowed: false;
  isCandidate: boolean;
  blockReasons: DryCowTherapyBlockReason[];
  daysUntilExpectedCalving: number | null;
  expectedCalvingDate: string | null;
  anchorDate: string | null;
  explanation: string;
};

export type DryCowTherapyMaterializationContract = {
  capabilityId: "sanitario.agenda.vaca_seca";
  contractVersion: typeof DRY_COW_THERAPY_MATERIALIZATION_CONTRACT_VERSION;
  status: "sql_contract_implemented_activation_required";
  sqlOwner: "sanitario_recompute_agenda_core";
  sqlImplementationMigration: "20260524000000_dry_cow_therapy_agenda_recompute.sql";
  protocolId: typeof DRY_COW_THERAPY_PROTOCOL_ID;
  itemId: typeof DRY_COW_THERAPY_ITEM_ID;
  familyCode: "terapia_vaca_seca";
  itemCode: typeof DRY_COW_THERAPY_ITEM_ID;
  materializationAllowedInCurrentRuntime: true;
  materializationRequiresOperationalActivation: true;
  schedule: {
    anchorFact: "taxonomy_facts.data_prevista_parto";
    dueDateRule: "max(as_of, data_prevista_parto - 60 days)";
    candidateWindowDaysBeforeCalving: {
      start: 75;
      end: 45;
    };
    dedupPeriodMode: "window";
    dedupPeriodKey: "data_prevista_parto";
  };
  requiredEligibilityFacts: string[];
  requiredSqlGates: string[];
  completionSignals: string[];
  antiZombieRules: string[];
  prohibitedEffects: string[];
};

export type DryCowTherapyAgendaCandidatePreview = {
  contract_version: typeof DRY_COW_THERAPY_MATERIALIZATION_CONTRACT_VERSION;
  protocol_id: typeof DRY_COW_THERAPY_PROTOCOL_ID;
  item_id: typeof DRY_COW_THERAPY_ITEM_ID;
  family_code: "terapia_vaca_seca";
  item_code: typeof DRY_COW_THERAPY_ITEM_ID;
  animal_id: string;
  due_date: string;
  expected_calving_date: string;
  dry_off_target_date: string;
  dry_off_dedup_key: string;
  agenda_materialization_allowed: false;
  payload: {
    family_code: "terapia_vaca_seca";
    item_code: typeof DRY_COW_THERAPY_ITEM_ID;
    protocol_id: typeof DRY_COW_THERAPY_PROTOCOL_ID;
    materialization_contract_version: typeof DRY_COW_THERAPY_MATERIALIZATION_CONTRACT_VERSION;
    anchor_fact: "taxonomy_facts.data_prevista_parto";
    expected_calving_date: string;
    dry_off_target_date: string;
    dry_off_dedup_key: string;
    agenda_materialization_allowed: false;
    source: "dry_cow_therapy_sql_contract_preview";
  };
};

export type DryCowTherapyEventPayload = {
  schema_version: typeof DRY_COW_THERAPY_SCHEMA_VERSION;
  protocol_id: typeof DRY_COW_THERAPY_PROTOCOL_ID;
  item_id: typeof DRY_COW_THERAPY_ITEM_ID;
  performed_at: string;
  expected_calving_date: string | null;
  days_until_expected_calving: number | null;
  readiness_decision: DryCowTherapyAgendaDecision;
  agenda_materialization_allowed: false;
  dry_off_dedup_key: string | null;
  source: "manual_dry_off_event";
};

export type BuildDryCowTherapyEventPayloadInput = {
  animalId: string;
  performedAt: string;
  readiness: DryCowTherapyReadiness;
};

export type BuildDryCowTherapyAnimalPayloadInput = {
  animal: Pick<Animal, "payload">;
  performedAt: string;
};

export type BuildDryCowTherapyAgendaCandidatePreviewInput = {
  animalId: string | null | undefined;
  asOf: string;
  readiness: DryCowTherapyReadiness;
};

export type DryCowTherapyAgendaActivationPayload = {
  mode: "dry_off_reproductive_window";
  source: "farm_protocol_explicit_activation";
  contract_version: typeof DRY_COW_THERAPY_MATERIALIZATION_CONTRACT_VERSION;
};

export const DRY_COW_THERAPY_MATERIALIZATION_CONTRACT: DryCowTherapyMaterializationContract =
  {
    capabilityId: "sanitario.agenda.vaca_seca",
    contractVersion: DRY_COW_THERAPY_MATERIALIZATION_CONTRACT_VERSION,
    status: "sql_contract_implemented_activation_required",
    sqlOwner: "sanitario_recompute_agenda_core",
    sqlImplementationMigration:
      "20260524000000_dry_cow_therapy_agenda_recompute.sql",
    protocolId: DRY_COW_THERAPY_PROTOCOL_ID,
    itemId: DRY_COW_THERAPY_ITEM_ID,
    familyCode: "terapia_vaca_seca",
    itemCode: DRY_COW_THERAPY_ITEM_ID,
    materializationAllowedInCurrentRuntime: true,
    materializationRequiresOperationalActivation: true,
    schedule: {
      anchorFact: "taxonomy_facts.data_prevista_parto",
      dueDateRule: "max(as_of, data_prevista_parto - 60 days)",
      candidateWindowDaysBeforeCalving: {
        start: 75,
        end: 45,
      },
      dedupPeriodMode: "window",
      dedupPeriodKey: "data_prevista_parto",
    },
    requiredEligibilityFacts: [
      "animais.status = ativo",
      "animais.sexo = F",
      "taxonomy_facts.em_lactacao = true",
      "taxonomy_facts.secagem_realizada is not true",
      "taxonomy_facts.data_prevista_parto is valid date",
      "as_of is between 75 and 45 days before data_prevista_parto",
    ],
    requiredSqlGates: [
      "protocolos_sanitarios_itens.gera_agenda = true",
      "family_code = terapia_vaca_seca",
      "item_code = secagem-intramamario",
      "agenda_activation.mode = dry_off_reproductive_window",
      "standard clinical item remains gera_agenda=false unless converted to explicit farm operational protocol",
    ],
    completionSignals: [
      "eventos.dominio = sanitario",
      "eventos.animal_id matches candidate animal",
      "eventos.payload.dry_cow_therapy.schema_version = 1",
      "eventos.payload.dry_cow_therapy.dry_off_dedup_key equals candidate dedup",
      "animais.payload.taxonomy_facts.secagem_realizada = true",
    ],
    antiZombieRules: [
      "cancel open automatic agenda when eligibility facts become invalid",
      "do not create agenda when secagem_realizada is true",
      "do not create agenda outside the 75-45 day active window",
      "do not recreate agenda when matching dry_cow_therapy event already exists",
      "do not recreate agenda when concluded agenda has a valid linked event",
    ],
    prohibitedEffects: [
      "do not create event from recompute",
      "do not update animal taxonomy from recompute",
      "do not move inventory from agenda materialization",
      "do not bypass fazenda_id isolation or RLS validation",
    ],
  };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readPayloadString(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function isDryCowTherapyProtocolItem(
  item: Pick<ProtocoloSanitarioItem, "payload">,
) {
  const payload = asRecord(item.payload);
  const regimen = asRecord(payload.regime_sanitario);
  const familyCode =
    readPayloadString(payload, "family_code") ??
    readPayloadString(regimen, "family_code");
  const itemCode =
    readPayloadString(payload, "item_code") ??
    readPayloadString(regimen, "item_code");
  const protocolId =
    readPayloadString(payload, "standard_id") ??
    readPayloadString(payload, "protocol_id");

  return (
    familyCode === "terapia_vaca_seca" &&
    itemCode === DRY_COW_THERAPY_ITEM_ID &&
    (!protocolId || protocolId === DRY_COW_THERAPY_PROTOCOL_ID)
  );
}

export function buildDryCowTherapyOperationalAgendaItemPayload(
  basePayload: Record<string, unknown> | null | undefined,
) {
  const payload = asRecord(basePayload);

  return {
    ...payload,
    family_code: "terapia_vaca_seca",
    item_code: DRY_COW_THERAPY_ITEM_ID,
    protocol_id: DRY_COW_THERAPY_PROTOCOL_ID,
    materialization_contract_version:
      DRY_COW_THERAPY_MATERIALIZATION_CONTRACT_VERSION,
    agenda_activation: {
      ...asRecord(payload.agenda_activation),
      mode: "dry_off_reproductive_window",
      source: "farm_protocol_explicit_activation",
      contract_version: DRY_COW_THERAPY_MATERIALIZATION_CONTRACT_VERSION,
    } satisfies DryCowTherapyAgendaActivationPayload,
    dry_cow_therapy: {
      ...asRecord(payload[DRY_COW_THERAPY_PAYLOAD_KEY]),
      activation_status: "operational_agenda_enabled",
      materialization_contract_version:
        DRY_COW_THERAPY_MATERIALIZATION_CONTRACT_VERSION,
    },
  };
}

export function buildDryCowTherapyClinicalSupportItemPayload(
  basePayload: Record<string, unknown> | null | undefined,
) {
  const payload = asRecord(basePayload);
  const { agenda_activation: _agendaActivation, ...payloadWithoutActivation } =
    payload;

  return {
    ...payloadWithoutActivation,
    family_code: "terapia_vaca_seca",
    item_code: DRY_COW_THERAPY_ITEM_ID,
    protocol_id: DRY_COW_THERAPY_PROTOCOL_ID,
    dry_cow_therapy: {
      ...asRecord(payload[DRY_COW_THERAPY_PAYLOAD_KEY]),
      activation_status: "clinical_support_only",
      materialization_contract_version:
        DRY_COW_THERAPY_MATERIALIZATION_CONTRACT_VERSION,
    },
  };
}

function readTaxonomyFacts(payload: Record<string, unknown>) {
  const facts = asRecord(payload.taxonomy_facts);

  return {
    emLactacao:
      typeof facts.em_lactacao === "boolean"
        ? facts.em_lactacao
        : typeof payload.em_lactacao === "boolean"
          ? payload.em_lactacao
          : null,
    secagemRealizada:
      typeof facts.secagem_realizada === "boolean"
        ? facts.secagem_realizada
        : typeof payload.secagem_realizada === "boolean"
          ? payload.secagem_realizada
          : null,
    dataPrevistaParto:
      typeof facts.data_prevista_parto === "string"
        ? facts.data_prevista_parto.slice(0, 10)
        : typeof payload.data_prevista_parto === "string"
          ? payload.data_prevista_parto.slice(0, 10)
          : null,
  };
}

function parseDateKey(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeDateKey(value: string | null | undefined): string | null {
  const dateKey = value?.slice(0, 10);
  return parseDateKey(dateKey) ? dateKey! : null;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(dateKey: string, days: number): string | null {
  const date = parseDateKey(dateKey);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
}

function maxDateKey(first: string, second: string): string {
  return first >= second ? first : second;
}

export function isDryCowTherapyClinicalRef(
  ref: ClinicalProtocolRef | null | undefined,
) {
  if (!ref) return false;
  return (
    ref.protocolId === DRY_COW_THERAPY_PROTOCOL_ID &&
    (!ref.itemId || ref.itemId === DRY_COW_THERAPY_ITEM_ID)
  );
}

function daysBetween(start: Date, end: Date) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.round((end.getTime() - start.getTime()) / millisecondsPerDay);
}

function buildExplanation(input: {
  isCandidate: boolean;
  blockReasons: DryCowTherapyBlockReason[];
}) {
  if (input.isCandidate) {
    return "Sinais minimos encontrados; agenda automatica exige protocolo operacional ativado e recompute SQL, nao nasce apenas da leitura clinica.";
  }

  if (input.blockReasons.length === 0) {
    return "Sem criterio suficiente para agenda; manter como roteiro clinico read-only.";
  }

  return "Nao ha base suficiente para agenda automatica de Vaca Seca; manter como roteiro clinico read-only.";
}

export function evaluateDryCowTherapyReadiness(
  input: DryCowTherapyReadinessInput,
): DryCowTherapyReadiness {
  const windowStart = input.dryOffWindowStartDaysBeforeCalving ?? 75;
  const windowEnd = input.dryOffWindowEndDaysBeforeCalving ?? 45;
  const payload = asRecord(input.animal.payload);
  const facts = readTaxonomyFacts(payload);
  const referenceDate = parseDateKey(input.referenceDate);
  const expectedCalvingDate = parseDateKey(facts.dataPrevistaParto);
  const blockReasons: DryCowTherapyBlockReason[] = [];

  if (!referenceDate) {
    blockReasons.push("invalid_reference_date");
  }

  if ((input.animal.status as AnimalStatusEnum) !== "ativo") {
    blockReasons.push("animal_not_active");
  }

  if ((input.animal.sexo as SexoEnum) !== "F") {
    blockReasons.push("animal_not_female");
  }

  if (facts.emLactacao !== true) {
    blockReasons.push("not_in_lactation");
  }

  if (facts.secagemRealizada === true) {
    blockReasons.push("already_dried_off");
  }

  if (!expectedCalvingDate) {
    blockReasons.push("missing_expected_calving_date");
  }

  const daysUntilExpectedCalving =
    referenceDate && expectedCalvingDate
      ? daysBetween(referenceDate, expectedCalvingDate)
      : null;

  if (
    daysUntilExpectedCalving !== null &&
    (daysUntilExpectedCalving > windowStart ||
      daysUntilExpectedCalving < windowEnd)
  ) {
    blockReasons.push("outside_dry_off_window");
  }

  const isCandidate = blockReasons.length === 0;

  return {
    protocolId: DRY_COW_THERAPY_PROTOCOL_ID,
    itemId: DRY_COW_THERAPY_ITEM_ID,
    decision: isCandidate
      ? "candidate_for_future_agenda_contract"
      : "keep_as_clinical_protocol",
    agendaMaterializationAllowed: false,
    isCandidate,
    blockReasons,
    daysUntilExpectedCalving,
    expectedCalvingDate: facts.dataPrevistaParto,
    anchorDate: facts.dataPrevistaParto,
    explanation: buildExplanation({ isCandidate, blockReasons }),
  };
}

export function buildDryCowTherapyDedupKey(input: {
  animalId: string | null | undefined;
  expectedCalvingDate: string | null | undefined;
}): string | null {
  const animalId = input.animalId?.trim();
  const expectedCalvingDate = normalizeDateKey(input.expectedCalvingDate);
  if (!animalId || !expectedCalvingDate) return null;

  return buildSanitaryDedupKey({
    scopeType: "animal",
    scopeId: animalId,
    familyCode: "terapia_vaca_seca",
    itemCode: DRY_COW_THERAPY_ITEM_ID,
    regimenVersion: DRY_COW_THERAPY_SCHEMA_VERSION,
    mode: "janela_etaria",
    periodKey: expectedCalvingDate,
  });
}

export function buildDryCowTherapyEventPayload(
  input: BuildDryCowTherapyEventPayloadInput,
): Record<typeof DRY_COW_THERAPY_PAYLOAD_KEY, DryCowTherapyEventPayload> {
  const dryOffDedupKey = buildDryCowTherapyDedupKey({
    animalId: input.animalId,
    expectedCalvingDate: input.readiness.expectedCalvingDate,
  });

  return {
    [DRY_COW_THERAPY_PAYLOAD_KEY]: {
      schema_version: DRY_COW_THERAPY_SCHEMA_VERSION,
      protocol_id: DRY_COW_THERAPY_PROTOCOL_ID,
      item_id: DRY_COW_THERAPY_ITEM_ID,
      performed_at: input.performedAt,
      expected_calving_date: input.readiness.expectedCalvingDate,
      days_until_expected_calving: input.readiness.daysUntilExpectedCalving,
      readiness_decision: input.readiness.decision,
      agenda_materialization_allowed: false,
      dry_off_dedup_key: dryOffDedupKey,
      source: "manual_dry_off_event",
    },
  };
}

export function validateDryCowTherapyMaterializationContract(
  contract: DryCowTherapyMaterializationContract = DRY_COW_THERAPY_MATERIALIZATION_CONTRACT,
): string[] {
  const violations: string[] = [];

  if (!contract.materializationAllowedInCurrentRuntime) {
    violations.push("materializacao SQL deve estar implementada no runtime atual");
  }

  if (!contract.materializationRequiresOperationalActivation) {
    violations.push("materializacao deve exigir ativacao operacional explicita");
  }

  if (contract.sqlOwner !== "sanitario_recompute_agenda_core") {
    violations.push("owner SQL deve ser sanitario_recompute_agenda_core");
  }

  if (contract.familyCode !== "terapia_vaca_seca") {
    violations.push("familyCode deve ser terapia_vaca_seca");
  }

  if (contract.itemCode !== DRY_COW_THERAPY_ITEM_ID) {
    violations.push("itemCode deve ser secagem-intramamario");
  }

  if (contract.schedule.anchorFact !== "taxonomy_facts.data_prevista_parto") {
    violations.push("ancora deve ser taxonomy_facts.data_prevista_parto");
  }

  if (
    contract.schedule.candidateWindowDaysBeforeCalving.start <=
    contract.schedule.candidateWindowDaysBeforeCalving.end
  ) {
    violations.push("janela deve iniciar antes do parto com valor maior que o fim");
  }

  if (!contract.antiZombieRules.some((rule) => rule.includes("secagem_realizada"))) {
    violations.push("contrato deve bloquear agenda quando secagem ja foi realizada");
  }

  if (!contract.completionSignals.some((signal) => signal.includes("dry_off_dedup_key"))) {
    violations.push("contrato deve exigir sinal de conclusao por dry_off_dedup_key");
  }

  return violations;
}

export function buildDryCowTherapyAgendaCandidatePreview(
  input: BuildDryCowTherapyAgendaCandidatePreviewInput,
): DryCowTherapyAgendaCandidatePreview | null {
  const animalId = input.animalId?.trim();
  const asOf = normalizeDateKey(input.asOf);
  const expectedCalvingDate = normalizeDateKey(input.readiness.expectedCalvingDate);

  if (!animalId || !asOf || !expectedCalvingDate || !input.readiness.isCandidate) {
    return null;
  }

  const dryOffTargetDate = addDays(
    expectedCalvingDate,
    -DRY_COW_THERAPY_DEFAULT_DUE_DAYS_BEFORE_CALVING,
  );
  if (!dryOffTargetDate) return null;

  const dryOffDedupKey = buildDryCowTherapyDedupKey({
    animalId,
    expectedCalvingDate,
  });
  if (!dryOffDedupKey) return null;

  const dueDate = maxDateKey(asOf, dryOffTargetDate);

  return {
    contract_version: DRY_COW_THERAPY_MATERIALIZATION_CONTRACT_VERSION,
    protocol_id: DRY_COW_THERAPY_PROTOCOL_ID,
    item_id: DRY_COW_THERAPY_ITEM_ID,
    family_code: "terapia_vaca_seca",
    item_code: DRY_COW_THERAPY_ITEM_ID,
    animal_id: animalId,
    due_date: dueDate,
    expected_calving_date: expectedCalvingDate,
    dry_off_target_date: dryOffTargetDate,
    dry_off_dedup_key: dryOffDedupKey,
    agenda_materialization_allowed: false,
    payload: {
      family_code: "terapia_vaca_seca",
      item_code: DRY_COW_THERAPY_ITEM_ID,
      protocol_id: DRY_COW_THERAPY_PROTOCOL_ID,
      materialization_contract_version:
        DRY_COW_THERAPY_MATERIALIZATION_CONTRACT_VERSION,
      anchor_fact: "taxonomy_facts.data_prevista_parto",
      expected_calving_date: expectedCalvingDate,
      dry_off_target_date: dryOffTargetDate,
      dry_off_dedup_key: dryOffDedupKey,
      agenda_materialization_allowed: false,
      source: "dry_cow_therapy_sql_contract_preview",
    },
  };
}

export function buildDryCowTherapyAnimalPayload(
  input: BuildDryCowTherapyAnimalPayloadInput,
) {
  const performedDate = normalizeDateKey(input.performedAt);

  return buildAnimalTaxonomyFactsPayload(
    input.animal.payload,
    {
      secagem_realizada: true,
      ...(performedDate ? { data_secagem: performedDate } : {}),
      em_lactacao: false,
    },
    "manual",
  );
}
