import { db } from "./db";
import type {
  Evento,
  EventoAnimalLocalV2,
  EventoSanitario,
  Gesture,
  Operation,
  SanitarioAgendaClosureLocalV2,
  SanitarioAgendaLocalV2,
  SanitarioV2CutoverManifest,
} from "./types";

export const SANITARIO_V2_CONTRACT_VERSION = 2;
export const SANITARIO_V2_STAGING_PROJECT_REF = "zqloazqzhwauamcejmuz";
const FEATURE_FLAG_KEY = "rebanhosync:sanitario-v2-push";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SanitarioV2CutoverReconcile = (fazendaId: string) => Promise<void>;
export interface SanitarioV2CutoverOptions {
  contractVersion?: number;
  backfillExternalHistory?: {
    clientId: string;
    projectRef: string;
  };
}
export interface SanitarioV2ExternalHistoryBackfillResult {
  candidates: number;
  enqueued: number;
  replayed: number;
  skippedLegacyIncomplete: number;
}
export interface SanitarioV2OperationIdentity {
  clientTxId: string;
  clientOpId: string;
  domainOpId: string;
}
export interface SanitarioV2QueuedOperation {
  client_op_id: string;
  client_tx_id: string;
  domain_op_id: string;
  domain: "sanitario_v2";
  contract_version: number;
  command:
    | "create_agenda"
    | "replace_agenda_animals"
    | "apply_factual_core"
    | "close_agenda";
  expected_revision?: number;
  payload: Record<string, unknown>;
}

function requireUuid(value: string, field: string) {
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`SANITARIO_V2_INVALID_UUID:${field}`);
  }
  return value;
}
function requireRevision(value: number | undefined) {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new Error("SANITARIO_V2_EXPECTED_REVISION_REQUIRED");
  }
  return Number(value);
}
function requireIdentity(identity: SanitarioV2OperationIdentity) {
  requireUuid(identity.clientTxId, "client_tx_id");
  requireUuid(identity.clientOpId, "client_op_id");
  requireUuid(identity.domainOpId, "domain_op_id");
}
function manifestKey(fazendaId: string, contractVersion: number) {
  return `${fazendaId}:${contractVersion}`;
}
function storageAvailable() {
  return typeof localStorage !== "undefined";
}

export function isSanitarioV2PushEnabled(projectRef: string) {
  return (
    projectRef === SANITARIO_V2_STAGING_PROJECT_REF &&
    storageAvailable() &&
    localStorage.getItem(FEATURE_FLAG_KEY) === projectRef
  );
}
export function setSanitarioV2PushEnabled(
  enabled: boolean,
  projectRef: string,
) {
  if (!storageAvailable()) {
    throw new Error("SANITARIO_V2_LOCAL_STORAGE_UNAVAILABLE");
  }
  if (!enabled) {
    localStorage.removeItem(FEATURE_FLAG_KEY);
    return;
  }
  if (projectRef !== SANITARIO_V2_STAGING_PROJECT_REF) {
    throw new Error("SANITARIO_V2_STAGING_ONLY");
  }
  localStorage.setItem(FEATURE_FLAG_KEY, projectRef);
}
export function createSanitarioV2Identity(
  clientTxId = crypto.randomUUID(),
): SanitarioV2OperationIdentity {
  requireUuid(clientTxId, "client_tx_id");
  return {
    clientTxId,
    clientOpId: crypto.randomUUID(),
    domainOpId: crypto.randomUUID(),
  };
}
function baseOperation(
  identity: SanitarioV2OperationIdentity,
  command: SanitarioV2QueuedOperation["command"],
): Omit<SanitarioV2QueuedOperation, "payload"> {
  requireIdentity(identity);
  return {
    client_op_id: identity.clientOpId,
    client_tx_id: identity.clientTxId,
    domain_op_id: identity.domainOpId,
    domain: "sanitario_v2",
    contract_version: SANITARIO_V2_CONTRACT_VERSION,
    command,
  };
}

export function buildCreateAgendaOperation(
  identity: SanitarioV2OperationIdentity,
  agenda: SanitarioAgendaLocalV2,
  animalIds: readonly string[],
): SanitarioV2QueuedOperation {
  requireUuid(agenda.id, "agenda.id");
  animalIds.forEach((id) => requireUuid(id, "animal_ids"));
  return {
    ...baseOperation(identity, "create_agenda"),
    payload: {
      agenda: {
        id: agenda.id,
        dedup_key: agenda.dedup_key,
        source_demand_key: agenda.source_demand_key,
        preview_group_id: agenda.preview_group_id,
        protocolo_id: agenda.protocolo_id,
        protocol_item_version_id: agenda.protocol_item_version_id,
        protocol_item_snapshot: agenda.protocol_item_snapshot,
        janela_inicio: agenda.janela_inicio,
        janela_fim: agenda.janela_fim,
        data_programada: agenda.data_programada,
        lote_id: agenda.lote_id,
        produto_snapshot: agenda.produto_snapshot,
        produto_classe: agenda.produto_classe,
        acao_sanitaria: agenda.acao_sanitaria,
        metadata: agenda.metadata,
        client_recorded_at: agenda.client_recorded_at,
      },
      animal_ids: [...animalIds],
    },
  };
}

export function buildReplaceAgendaAnimalsOperation(
  identity: SanitarioV2OperationIdentity,
  agendaId: string,
  expectedRevision: number | undefined,
  animalIds: readonly string[],
): SanitarioV2QueuedOperation {
  requireUuid(agendaId, "agenda_id");
  animalIds.forEach((id) => requireUuid(id, "animal_ids"));
  return {
    ...baseOperation(identity, "replace_agenda_animals"),
    expected_revision: requireRevision(expectedRevision),
    payload: { agenda_id: agendaId, animal_ids: [...animalIds] },
  };
}

export function buildApplyFactualCoreOperation(
  identity: SanitarioV2OperationIdentity,
  event: Evento,
  detail: EventoSanitario,
  eventAnimals: readonly EventoAnimalLocalV2[],
  expectedRevision?: number,
): SanitarioV2QueuedOperation {
  requireUuid(event.id, "event.id");
  const agendaId = event.source_sanitario_agenda_v2_id ?? null;
  if (agendaId) requireUuid(agendaId, "event.source_sanitario_agenda_v2_id");
  if (event.sanitario_sync_v2_nature === "primary_execution" && agendaId) {
    requireRevision(expectedRevision);
  }
  eventAnimals.forEach((item) => {
    requireUuid(item.id, "event_animals.id");
    requireUuid(item.animal_id, "event_animals.animal_id");
    if (item.evento_id !== event.id || item.fazenda_id !== event.fazenda_id) {
      throw new Error("SANITARIO_V2_EVENT_ANIMAL_SCOPE_MISMATCH");
    }
  });
  return {
    ...baseOperation(identity, "apply_factual_core"),
    ...(expectedRevision === undefined
      ? {}
      : { expected_revision: requireRevision(expectedRevision) }),
    payload: {
      event: {
        id: event.id,
        source_sanitario_agenda_v2_id: agendaId,
        natureza: event.sanitario_sync_v2_nature ?? "standalone_fact",
        occurred_at: event.occurred_at,
        animal_id: event.animal_id,
        lote_id: event.lote_id,
        corrige_evento_id: event.corrige_evento_id,
        observacoes: event.observacoes,
        payload: event.payload,
        client_recorded_at: event.client_recorded_at,
      },
      detail: {
        tipo: detail.tipo,
        produto_sanitario_v2_id:
          detail.produto_sanitario_v2_id ??
          detail.produto_veterinario_id ??
          null,
        insumo_id: detail.insumo_id ?? null,
        estoque_lote_id: detail.estoque_lote_id ?? null,
        produto_nome_snapshot: detail.produto_nome_snapshot ?? null,
        produto_snapshot: detail.produto_snapshot ?? null,
        estoque_lote_codigo_snapshot:
          detail.estoque_lote_codigo_snapshot ?? null,
        lote_fabricante: detail.lote_fabricante ?? null,
        validade_produto: detail.validade_produto ?? null,
        dose_quantidade: detail.dose_quantidade ?? null,
        dose_unidade: detail.dose_unidade ?? null,
        via_aplicacao: detail.via_aplicacao ?? null,
        responsavel_nome: detail.responsavel_nome ?? null,
        responsavel_tipo: detail.responsavel_tipo ?? null,
        carencia_carne_dias: detail.carencia_carne_dias ?? null,
        carencia_leite_dias: detail.carencia_leite_dias ?? null,
        carencia_carne_ate: detail.carencia_carne_ate ?? null,
        carencia_leite_ate: detail.carencia_leite_ate ?? null,
        custo_unitario_snapshot: detail.custo_unitario_snapshot ?? null,
        custo_total_snapshot: detail.custo_total_snapshot ?? null,
        payload: detail.payload,
      },
      event_animals: eventAnimals.map(({ id, animal_id }) => ({
        id,
        animal_id,
      })),
    },
  };
}

export function buildCloseAgendaOperation(
  identity: SanitarioV2OperationIdentity,
  closure: SanitarioAgendaClosureLocalV2,
  expectedRevision: number | undefined,
): SanitarioV2QueuedOperation {
  requireUuid(closure.id, "closure.id");
  requireUuid(closure.agenda_id, "closure.agenda_id");
  if (
    closure.closure_type !== "cancelled" &&
    closure.closure_type !== "dismissed"
  ) {
    throw new Error("SANITARIO_V2_CLOSE_TYPE_UNSUPPORTED");
  }
  return {
    ...baseOperation(identity, "close_agenda"),
    expected_revision: requireRevision(expectedRevision),
    payload: {
      closure: {
        id: closure.id,
        agenda_id: closure.agenda_id,
        closure_type: closure.closure_type,
        dedup_key: closure.dedup_key,
        client_recorded_at: closure.client_recorded_at,
        closed_at: closure.closed_at,
        reason: closure.reason,
        partial_payload: closure.partial_payload,
        metadata: closure.metadata,
      },
    },
  };
}

export async function prepareSanitarioV2Cutover(
  fazendaId: string,
  contractVersion = SANITARIO_V2_CONTRACT_VERSION,
) {
  requireUuid(fazendaId, "fazenda_id");
  const key = manifestKey(fazendaId, contractVersion);
  const existing = await db.sync_sanitario_v2_cutovers.get(key);
  if (existing?.status === "APPLIED") return existing;
  const now = new Date().toISOString();
  const manifest: SanitarioV2CutoverManifest = {
    key,
    fazenda_id: fazendaId,
    contract_version: contractVersion,
    status: "PREPARED",
    prepared_at: existing?.prepared_at ?? now,
    applying_at: null,
    applied_at: null,
    failed_at: null,
    last_error: null,
    updated_at: now,
  };
  await db.sync_sanitario_v2_cutovers.put(manifest);
  return manifest;
}

export async function applySanitarioV2Cutover(
  fazendaId: string,
  reconcile: SanitarioV2CutoverReconcile,
  options: number | SanitarioV2CutoverOptions = SANITARIO_V2_CONTRACT_VERSION,
) {
  const contractVersion =
    typeof options === "number"
      ? options
      : (options.contractVersion ?? SANITARIO_V2_CONTRACT_VERSION);
  const backfill =
    typeof options === "number" ? undefined : options.backfillExternalHistory;
  const prepared = await prepareSanitarioV2Cutover(fazendaId, contractVersion);
  if (prepared.status === "APPLIED") {
    if (backfill) {
      await backfillSanitarioV2ExternalHistory({
        fazendaId,
        ...backfill,
      });
    }
    return prepared;
  }
  const applyingAt = new Date().toISOString();
  await db.sync_sanitario_v2_cutovers.update(prepared.key, {
    status: "APPLYING",
    applying_at: applyingAt,
    failed_at: null,
    last_error: null,
    updated_at: applyingAt,
  });
  try {
    await reconcile(fazendaId);
    const appliedAt = new Date().toISOString();
    await db.sync_sanitario_v2_cutovers.update(prepared.key, {
      status: "APPLIED",
      applied_at: appliedAt,
      failed_at: null,
      last_error: null,
      updated_at: appliedAt,
    });
    if (backfill) {
      await backfillSanitarioV2ExternalHistory({
        fazendaId,
        ...backfill,
      });
    }
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error(String(cause));
    const failedAt = new Date().toISOString();
    await db.sync_sanitario_v2_cutovers.update(prepared.key, {
      status: "FAILED",
      failed_at: failedAt,
      last_error: error.message,
      updated_at: failedAt,
    });
    throw error;
  }
  const applied = await db.sync_sanitario_v2_cutovers.get(prepared.key);
  if (!applied) throw new Error("SANITARIO_V2_CUTOVER_MANIFEST_MISSING");
  return applied;
}

function sameQueuedEnvelope(
  existing: Operation,
  incoming: SanitarioV2QueuedOperation,
) {
  return (
    existing.client_tx_id === incoming.client_tx_id &&
    existing.domain_op_id === incoming.domain_op_id &&
    JSON.stringify(existing.record) === JSON.stringify(incoming)
  );
}

async function validateSanitarioV2Enqueue(input: {
  fazendaId: string;
  projectRef: string;
  operations: readonly SanitarioV2QueuedOperation[];
}) {
  if (!isSanitarioV2PushEnabled(input.projectRef)) {
    throw new Error("SANITARIO_V2_PUSH_DISABLED");
  }
  if (input.operations.length === 0) return;
  const manifest = await db.sync_sanitario_v2_cutovers.get(
    manifestKey(input.fazendaId, SANITARIO_V2_CONTRACT_VERSION),
  );
  if (manifest?.status !== "APPLIED") {
    throw new Error("SANITARIO_V2_CUTOVER_NOT_APPLIED");
  }
  const clientTxIds = new Set(input.operations.map((op) => op.client_tx_id));
  if (clientTxIds.size !== 1) {
    throw new Error("SANITARIO_V2_SINGLE_GESTURE_REQUIRED");
  }
  input.operations.forEach((op) =>
    requireIdentity({
      clientTxId: op.client_tx_id,
      clientOpId: op.client_op_id,
      domainOpId: op.domain_op_id,
    }),
  );
}

async function writeSanitarioV2Queue(input: {
  fazendaId: string;
  clientId: string;
  operations: readonly SanitarioV2QueuedOperation[];
}) {
  if (input.operations.length === 0) return;
  const clientTxId = input.operations[0].client_tx_id;
  const createdAt = new Date().toISOString();
  const existingGesture = await db.queue_gestures.get(clientTxId);
  if (
    existingGesture &&
    (existingGesture.fazenda_id !== input.fazendaId ||
      existingGesture.client_id !== input.clientId)
  ) {
    throw new Error("SANITARIO_V2_GESTURE_SCOPE_MISMATCH");
  }
  const newOperations: Operation[] = [];
  for (const [index, envelope] of input.operations.entries()) {
    const existing = await db.queue_ops.get(envelope.client_op_id);
    if (existing) {
      if (!sameQueuedEnvelope(existing, envelope)) {
        throw new Error("SANITARIO_V2_IDENTITY_REUSE_DIVERGENT_PAYLOAD");
      }
      continue;
    }
    newOperations.push({
      client_op_id: envelope.client_op_id,
      client_tx_id: envelope.client_tx_id,
      op_order: index,
      table: "sanitario_v2",
      action: "INSERT",
      record: envelope,
      domain_op_id: envelope.domain_op_id,
      sync_state: "PENDING",
      created_at: createdAt,
    });
  }
  if (!existingGesture) {
    const gesture: Gesture = {
      client_tx_id: clientTxId,
      fazenda_id: input.fazendaId,
      client_id: input.clientId,
      status: "PENDING",
      created_at: createdAt,
    };
    await db.queue_gestures.add(gesture);
  }
  if (newOperations.length > 0) await db.queue_ops.bulkAdd(newOperations);
}

export async function enqueueSanitarioV2Operations(input: {
  fazendaId: string;
  clientId: string;
  projectRef: string;
  operations: readonly SanitarioV2QueuedOperation[];
}) {
  await validateSanitarioV2Enqueue(input);
  if (input.operations.length === 0) return;
  await db.transaction("rw", [db.queue_gestures, db.queue_ops], async () => {
    await writeSanitarioV2Queue(input);
  });
}

function readExternalHistorySource(event: Evento) {
  const source = event.payload.entry_history_source;
  return source === "external_declared" || source === "external_documented"
    ? source
    : null;
}

function isPushableExternalHistory(event: Evento, detail: EventoSanitario) {
  const source = readExternalHistorySource(event);
  if (
    !source ||
    event.payload.schema !== "sanitary_entry_history_v2" ||
    event.sanitario_sync_v2_nature !== "standalone_fact" ||
    !event.client_tx_id ||
    !event.domain_op_id ||
    detail.domain_op_id !== event.domain_op_id
  ) {
    return false;
  }
  const reference =
    detail.payload.evidence_reference ?? event.payload.evidence_reference;
  const coverage =
    detail.payload.evidence_covered_fields ??
    event.payload.evidence_covered_fields;
  if (source === "external_documented") {
    return (
      typeof reference === "string" &&
      reference.trim().length > 0 &&
      Array.isArray(coverage) &&
      coverage.length > 0
    );
  }
  return Array.isArray(coverage) && coverage.length === 0;
}

function gestureAlreadyApplied(
  gesture: Gesture | undefined,
  clientOpId: string,
  domainOpId: string,
) {
  if (
    !gesture ||
    gesture.status !== "DONE" ||
    gesture.sync_result !== "APPLIED"
  ) {
    return false;
  }
  const results = gesture.operation_results ?? [];
  return (
    results.length === 0 ||
    results.some(
      (result) =>
        result.status === "APPLIED" &&
        result.op_id === clientOpId &&
        (!result.domain_op_id || result.domain_op_id === domainOpId),
    )
  );
}

export async function backfillSanitarioV2ExternalHistory(input: {
  fazendaId: string;
  clientId: string;
  projectRef: string;
}): Promise<SanitarioV2ExternalHistoryBackfillResult> {
  requireUuid(input.fazendaId, "fazenda_id");
  const candidates = await db.event_eventos
    .where("fazenda_id")
    .equals(input.fazendaId)
    .filter(
      (event) =>
        event.dominio === "sanitario" &&
        !event.deleted_at &&
        event.payload.schema === "sanitary_entry_history_v2" &&
        readExternalHistorySource(event) !== null,
    )
    .toArray();
  if (candidates.length === 0) {
    return {
      candidates: 0,
      enqueued: 0,
      replayed: 0,
      skippedLegacyIncomplete: 0,
    };
  }

  const eventIds = candidates.map((event) => event.id);
  const [details, relations] = await Promise.all([
    db.event_eventos_sanitario.where("evento_id").anyOf(eventIds).toArray(),
    db.event_eventos_animais.where("evento_id").anyOf(eventIds).toArray(),
  ]);
  const detailsByEvent = new Map(
    details
      .filter(
        (detail) => detail.fazenda_id === input.fazendaId && !detail.deleted_at,
      )
      .map((detail) => [detail.evento_id, detail]),
  );
  const relationsByEvent = new Map<string, EventoAnimalLocalV2[]>();
  for (const relation of relations) {
    if (relation.fazenda_id !== input.fazendaId) continue;
    const current = relationsByEvent.get(relation.evento_id) ?? [];
    current.push(relation);
    relationsByEvent.set(relation.evento_id, current);
  }

  let enqueued = 0;
  let replayed = 0;
  let skippedLegacyIncomplete = 0;
  for (const event of candidates) {
    const detail = detailsByEvent.get(event.id);
    const eventAnimals = relationsByEvent.get(event.id) ?? [];
    if (
      !detail ||
      eventAnimals.length === 0 ||
      !isPushableExternalHistory(event, detail)
    ) {
      skippedLegacyIncomplete += 1;
      continue;
    }
    const identity = {
      clientTxId: event.client_tx_id as string,
      clientOpId: event.client_op_id,
      domainOpId: event.domain_op_id as string,
    };
    const operation = buildApplyFactualCoreOperation(
      identity,
      event,
      detail,
      eventAnimals,
    );
    const [existingOperation, existingGesture] = await Promise.all([
      db.queue_ops.get(operation.client_op_id),
      db.queue_gestures.get(operation.client_tx_id),
    ]);
    if (
      !existingOperation &&
      gestureAlreadyApplied(
        existingGesture,
        operation.client_op_id,
        operation.domain_op_id,
      )
    ) {
      replayed += 1;
      continue;
    }
    await enqueueSanitarioV2Operations({
      fazendaId: input.fazendaId,
      clientId: input.clientId,
      projectRef: input.projectRef,
      operations: [operation],
    });
    if (existingOperation) replayed += 1;
    else enqueued += 1;
  }
  return {
    candidates: candidates.length,
    enqueued,
    replayed,
    skippedLegacyIncomplete,
  };
}

export async function persistSanitarioV2FactualCore(input: {
  fazendaId: string;
  clientId: string;
  projectRef: string;
  event: Evento;
  detail: EventoSanitario;
  eventAnimal: EventoAnimalLocalV2;
  operation: SanitarioV2QueuedOperation;
}) {
  if (
    input.operation.command !== "apply_factual_core" ||
    input.event.fazenda_id !== input.fazendaId ||
    input.detail.fazenda_id !== input.fazendaId ||
    input.eventAnimal.fazenda_id !== input.fazendaId ||
    input.detail.evento_id !== input.event.id ||
    input.eventAnimal.evento_id !== input.event.id
  ) {
    throw new Error("SANITARIO_V2_FACTUAL_LOCAL_SCOPE_MISMATCH");
  }
  await validateSanitarioV2Enqueue({
    fazendaId: input.fazendaId,
    projectRef: input.projectRef,
    operations: [input.operation],
  });
  await db.transaction(
    "rw",
    [
      db.event_eventos,
      db.event_eventos_sanitario,
      db.event_eventos_animais,
      db.queue_gestures,
      db.queue_ops,
    ],
    async () => {
      await db.event_eventos.add(input.event);
      await db.event_eventos_sanitario.add(input.detail);
      await db.event_eventos_animais.add(input.eventAnimal);
      await writeSanitarioV2Queue({
        fazendaId: input.fazendaId,
        clientId: input.clientId,
        operations: [input.operation],
      });
    },
  );
}
