import type {
  SanitarioAgendaAnimalLocalV2,
  SanitarioAgendaLocalV2,
} from "@/lib/offline/types";
import type { SanitaryEligibilityStatus } from "@/lib/sanitario/eligibility/sanitaryEligibility";

type ManualAgendaTargetV2 = {
  scope: "animal" | "lote";
  id: string;
  fazendaId: string;
  animalIds?: string[];
};

export type ManualAgendaProductRequirementKindV2 =
  | "specific_product"
  | "product_class"
  | "product_class_group"
  | "none"
  | string;

export type CreateManualSanitaryAgendaInputV2 = {
  target: ManualAgendaTargetV2;
  source: {
    kind: "sanitary_precheck_preview_v2";
    protocolId: string;
    familyCode: string;
    itemKey: string;
    itemLabel: string;
    protocolName: string;
    precheckStatus: SanitaryEligibilityStatus;
    reasons?: string[];
    blockers?: string[];
    warnings?: string[];
    productRequirementKind?: ManualAgendaProductRequirementKindV2;
    productClass?: string | null;
    productClassGroupId?: string | null;
    productClassGroupName?: string | null;
  };
  plannedFor: string;
  notes?: string;
  createdBy?: string;
  clientOpId: string;
  confirmed: boolean;
  now?: string;
};

export type ManualSanitaryAgendaResultV2 = {
  agendaId: string;
  clientOpId: string;
  status: "scheduled";
  created: boolean;
  createsEvent: false;
  createsStockMovement: false;
  createsActiveWithdrawal: false;
};

export type ManualSanitaryAgendaRejectionCodeV2 =
  | "missing_confirmation"
  | "missing_fazenda_id"
  | "missing_target"
  | "invalid_target_scope"
  | "missing_client_op_id"
  | "missing_planned_for"
  | "invalid_planned_for"
  | "source_not_preview_v2"
  | "status_not_allowed"
  | "blocked_item"
  | "execution_payload_forbidden";

export type ManualSanitaryAgendaValidationV2 = {
  ok: boolean;
  rejected: ManualSanitaryAgendaRejectionCodeV2[];
};

export type ManualSanitaryAgendaLocalDbV2 = {
  ops_sanitario_agenda_v2: {
    where(index: "client_op_id"): {
      equals(value: string): {
        first(): Promise<SanitarioAgendaLocalV2 | undefined>;
      };
    };
    put(record: SanitarioAgendaLocalV2): Promise<unknown>;
  };
  ops_sanitario_agenda_animais_v2: {
    bulkPut(records: SanitarioAgendaAnimalLocalV2[]): Promise<unknown>;
  };
  transaction<T>(
    mode: "rw",
    stores: unknown[],
    callback: () => Promise<T>,
  ): Promise<T>;
};

const ALLOWED_STATUSES = new Set<SanitaryEligibilityStatus>([
  "eligible_soon",
  "in_action_window",
  "near_deadline",
  "overdue",
]);

const OPERATIONAL_FALSE_FLAGS = {
  createsEvent: false,
  createsStockMovement: false,
  createsActiveWithdrawal: false,
} as const;

function toDateKey(value: string | undefined): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value ?? "");
  if (!match) return null;
  const dateKey = match[1];
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString().slice(0, 10) === dateKey ? dateKey : null;
}

function normalizeOptionalText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function uniqueSorted(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)))
    .sort();
}

function agendaIdFromClientOpId(clientOpId: string): string {
  return `manual-sanitary-agenda-v2:${clientOpId}`;
}

function buildDedupKey(input: CreateManualSanitaryAgendaInputV2): string {
  return [
    "manual-sanitary-agenda-v2",
    `target:${input.target.scope}:${input.target.id}`,
    `protocol:${input.source.protocolId}`,
    `item:${input.source.itemKey}`,
    `planned:${toDateKey(input.plannedFor) ?? "invalid"}`,
    `client:${input.clientOpId}`,
  ].join("|");
}

function targetAnimalRows(input: CreateManualSanitaryAgendaInputV2) {
  if (input.target.scope === "animal") return [input.target.id];
  return uniqueSorted(input.target.animalIds);
}

function hasExecutionPayload(input: CreateManualSanitaryAgendaInputV2): boolean {
  const source = input.source as Record<string, unknown>;
  return (
    source.productId != null ||
    source.executedProductId != null ||
    source.dose != null ||
    source.executedDose != null ||
    source.withdrawal != null ||
    source.activeWithdrawal != null ||
    source.stockLotId != null
  );
}

export function validateManualSanitaryAgendaV2(
  input: CreateManualSanitaryAgendaInputV2,
): ManualSanitaryAgendaValidationV2 {
  const rejected: ManualSanitaryAgendaRejectionCodeV2[] = [];

  if (!input.confirmed) rejected.push("missing_confirmation");
  if (!input.target.fazendaId) rejected.push("missing_fazenda_id");
  if (!input.target.id) rejected.push("missing_target");
  if (input.target.scope !== "animal" && input.target.scope !== "lote") {
    rejected.push("invalid_target_scope");
  }
  if (!input.clientOpId) rejected.push("missing_client_op_id");
  if (!input.plannedFor) rejected.push("missing_planned_for");
  if (input.plannedFor && !toDateKey(input.plannedFor)) {
    rejected.push("invalid_planned_for");
  }
  if (input.source.kind !== "sanitary_precheck_preview_v2") {
    rejected.push("source_not_preview_v2");
  }
  if (!ALLOWED_STATUSES.has(input.source.precheckStatus)) {
    rejected.push("status_not_allowed");
  }
  if ((input.source.blockers ?? []).length > 0) rejected.push("blocked_item");
  if (hasExecutionPayload(input)) rejected.push("execution_payload_forbidden");

  return {
    ok: rejected.length === 0,
    rejected,
  };
}

export function buildManualSanitaryAgendaRecordsV2(
  input: CreateManualSanitaryAgendaInputV2,
): {
  agenda: SanitarioAgendaLocalV2;
  animals: SanitarioAgendaAnimalLocalV2[];
} {
  const plannedFor = toDateKey(input.plannedFor);
  if (!plannedFor) {
    throw new Error("invalid plannedFor for manual sanitary agenda");
  }

  const now = input.now ?? new Date().toISOString();
  const agendaId = agendaIdFromClientOpId(input.clientOpId);
  const animalIds = targetAnimalRows(input);
  const targetAnimalScope =
    input.target.scope === "lote" && animalIds.length === 0
      ? "lote_sem_animais_explicitos"
      : "animais_explicitos";
  const metadata = {
    source: "sanitary_precheck_preview_v2",
    target: input.target,
    targetAnimalIds: animalIds,
    targetAnimalScope,
    previewStatus: input.source.precheckStatus,
    protocolName: input.source.protocolName,
    itemLabel: input.source.itemLabel,
    reasons: input.source.reasons ?? [],
    blockers: input.source.blockers ?? [],
    warnings: input.source.warnings ?? [],
    notes: normalizeOptionalText(input.notes),
    createdBy: normalizeOptionalText(input.createdBy),
    productRequirementKind: input.source.productRequirementKind ?? null,
    productClass: input.source.productClass ?? null,
    productClassGroupId: input.source.productClassGroupId ?? null,
    productClassGroupName: input.source.productClassGroupName ?? null,
    createsEvent: false,
    createsStockMovement: false,
    createsActiveWithdrawal: false,
  };

  const agenda: SanitarioAgendaLocalV2 = {
    id: agendaId,
    fazenda_id: input.target.fazendaId,
    status: "programada",
    dedup_key: buildDedupKey(input),
    client_id: input.createdBy ?? "manual-local",
    client_op_id: input.clientOpId,
    client_tx_id: null,
    client_recorded_at: now,
    server_received_at: now,
    source_demand_key: `sanitary_precheck_preview_v2:${input.source.protocolId}:${input.source.itemKey}`,
    preview_group_id: `${input.target.scope}:${input.target.id}:${input.source.protocolId}:${input.source.itemKey}`,
    protocolo_id: input.source.protocolId,
    protocol_item_version_id: null,
    protocol_item_snapshot: {
      sourceKind: input.source.kind,
      familyCode: input.source.familyCode,
      itemKey: input.source.itemKey,
      itemLabel: input.source.itemLabel,
      protocolName: input.source.protocolName,
      precheckStatus: input.source.precheckStatus,
      reasons: input.source.reasons ?? [],
      warnings: input.source.warnings ?? [],
      productRequirementKind: input.source.productRequirementKind ?? null,
      productClass: input.source.productClass ?? null,
      productClassGroupId: input.source.productClassGroupId ?? null,
      productClassGroupName: input.source.productClassGroupName ?? null,
    },
    janela_inicio: plannedFor,
    janela_fim: null,
    data_programada: plannedFor,
    lote_id: input.target.scope === "lote" ? input.target.id : null,
    produto_veterinario_id: null,
    produto_snapshot: {
      planningOnly: true,
      realProductDefinedOnlyAtExecution: true,
      doseDefinedOnlyAtExecution: true,
      withdrawalDefinedOnlyAtExecution: true,
      productRequirementKind: input.source.productRequirementKind ?? null,
      productClass: input.source.productClass ?? null,
      productClassGroupId: input.source.productClassGroupId ?? null,
      productClassGroupName: input.source.productClassGroupName ?? null,
    },
    produto_classe:
      input.source.productRequirementKind === "product_class"
        ? (input.source.productClass ?? null)
        : null,
    acao_sanitaria: "agenda_manual_sanitaria",
    execution_evento_id: null,
    metadata,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  const animals: SanitarioAgendaAnimalLocalV2[] = animalIds.map((animalId) => ({
    agenda_id: agendaId,
    fazenda_id: input.target.fazendaId,
    animal_id: animalId,
    planned_status: "planejado",
    execution_evento_id: null,
    not_executed_reason: null,
    metadata: {
      source: "sanitary_precheck_preview_v2",
      targetScope: input.target.scope,
      createsEvent: false,
    },
    created_at: now,
    updated_at: now,
  }));

  return { agenda, animals };
}

async function getDefaultLocalDb(): Promise<ManualSanitaryAgendaLocalDbV2> {
  const { db } = await import("@/lib/offline/db");
  return db as unknown as ManualSanitaryAgendaLocalDbV2;
}

export async function createManualSanitaryAgendaV2(
  input: CreateManualSanitaryAgendaInputV2,
  localDb?: ManualSanitaryAgendaLocalDbV2,
): Promise<ManualSanitaryAgendaResultV2> {
  const validation = validateManualSanitaryAgendaV2(input);
  if (!validation.ok) {
    throw new Error(`MANUAL_SANITARY_AGENDA_REJECTED:${validation.rejected.join(",")}`);
  }

  const db = localDb ?? (await getDefaultLocalDb());
  const existing = await db.ops_sanitario_agenda_v2
    .where("client_op_id")
    .equals(input.clientOpId)
    .first();

  if (existing) {
    return {
      agendaId: existing.id,
      clientOpId: existing.client_op_id,
      status: "scheduled",
      created: false,
      ...OPERATIONAL_FALSE_FLAGS,
    };
  }

  const records = buildManualSanitaryAgendaRecordsV2(input);

  await db.transaction(
    "rw",
    [db.ops_sanitario_agenda_v2, db.ops_sanitario_agenda_animais_v2],
    async () => {
      await db.ops_sanitario_agenda_v2.put(records.agenda);
      if (records.animals.length > 0) {
        await db.ops_sanitario_agenda_animais_v2.bulkPut(records.animals);
      }
    },
  );

  return {
    agendaId: records.agenda.id,
    clientOpId: input.clientOpId,
    status: "scheduled",
    created: true,
    ...OPERATIONAL_FALSE_FLAGS,
  };
}
