import { prepareSanitaryCommandV3 } from "@/lib/sanitario/execution/sanitaryAdmissionV3";
import { db } from "./db";
import backendTargets from "../../../config/backend-targets.json";
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

export const SANITARIO_V2_CONTRACT_VERSION = 3;
// Legacy export retained; controlled preview also requires an explicit, default-OFF rollout decision.
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
  fazenda_id?: string;
  client_op_id: string;
  client_tx_id: string;
  domain_op_id: string;
  domain: "sanitario_v2";
  contract_version: number;
  command:
    | "manage_agenda"
    | "create_agenda"
    | "replace_agenda_animals"
    | "apply_factual_core"
    | "close_agenda"
    | "set_automation_plan"
    | "reschedule_agenda";
  expected_revision?: number;
  payload: Record<string, unknown>;
}

export interface SanitarioV2InventoryMovementQueueInput {
  identity: SanitarioV2OperationIdentity;
  event: Evento;
  detail: EventoSanitario;
  movement: import("./types").InsumoMovimentacao;
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
    isSanitarioBackendAllowed(projectRef) &&
    storageAvailable() &&
    localStorage.getItem(FEATURE_FLAG_KEY) === projectRef
  );
}
function isControlledSanitarioBackend(projectRef: string, url: URL) {
  const controlled = backendTargets.existing_backend_homologation;
  return controlled.client_rollout_enabled === true && !!controlled.reuse_decision_reference &&
    projectRef === controlled.project_ref &&
    backendTargets.production_project_refs.includes(projectRef) &&
    url.href === `https://${projectRef}.supabase.co/`;
}
function isExclusiveSanitarioBackend(projectRef: string, url: URL) {
  if (projectRef === SANITARIO_V2_STAGING_PROJECT_REF) return false;
  if (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)) return projectRef === "local";
  return url.protocol === "https:" && import.meta.env.VITE_BACKEND_ENV === "homologation" &&
    projectRef === url.hostname.split(".")[0] && (backendTargets.homologation_project_refs as string[]).includes(projectRef);
}
function isSanitarioBackendAllowed(projectRef: string) {
  try {
    const url = new URL(import.meta.env.VITE_SUPABASE_URL ?? "");
    if (import.meta.env.VITE_BACKEND_ENV === "controlled-homologation") {
      return isControlledSanitarioBackend(projectRef, url);
    }
    return isExclusiveSanitarioBackend(projectRef, url);
  } catch { return false; }
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
  if (!isSanitarioBackendAllowed(projectRef)) {
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
    fazenda_id: agenda.fazenda_id,
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
  return prepareSanitaryCommandV3({
    ...baseOperation(identity, "apply_factual_core"),
    fazenda_id: event.fazenda_id,
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
  });
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
    fazenda_id: closure.fazenda_id,
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

export async function validateSanitarioV2Enqueue(input: {
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
  for (const op of input.operations) {
    const existing = await db.queue_ops.get(op.client_op_id);
    if (existing && !sameQueuedEnvelope(existing, op)) throw new Error("SANITARIO_V2_IDENTITY_REUSE_DIVERGENT_PAYLOAD");
    if (op.contract_version !== 3) throw new Error("SANITARIO_CLIENT_CONTRACT_OUTDATED");
    prepareSanitaryCommandV3({ ...op, fazenda_id: input.fazendaId });
    requireIdentity({
      clientTxId: op.client_tx_id,
      clientOpId: op.client_op_id,
      domainOpId: op.domain_op_id,
    });
  }
}

function sameQueuedOperation(existing: Operation, incoming: Operation) {
  return (
    existing.client_tx_id === incoming.client_tx_id &&
    existing.domain_op_id === incoming.domain_op_id &&
    existing.table === incoming.table &&
    existing.action === incoming.action &&
    JSON.stringify(existing.record) === JSON.stringify(incoming.record)
  );
}

export function buildSanitarioV2InventoryMovementOperation(
  input: SanitarioV2InventoryMovementQueueInput,
): Operation {
  requireIdentity(input.identity);
  const { event, detail, movement } = input;
  const product = event.payload.product;
  const productRecord = product && typeof product === "object" &&
      !Array.isArray(product)
    ? product as Record<string, unknown>
    : {};
  if (
    event.sanitario_sync_v2_nature !== "primary_execution" ||
    event.payload.schema !== "sanitary_agenda_execution_v2" ||
    event.fazenda_id !== detail.fazenda_id ||
    event.fazenda_id !== movement.fazenda_id ||
    detail.evento_id !== event.id ||
    movement.source_evento_id !== event.id ||
    movement.source_evento_dominio !== "sanitario" ||
    movement.tipo !== "consumo_sanitario" ||
    !detail.produto_sanitario_v2_id ||
    productRecord.productId !== detail.produto_sanitario_v2_id ||
    !detail.insumo_id ||
    detail.insumo_id !== movement.insumo_id ||
    !detail.estoque_lote_id ||
    detail.estoque_lote_id !== movement.insumo_lote_id ||
    !Number.isFinite(movement.quantidade_base) ||
    movement.quantidade_base <= 0 ||
    !movement.unidade_base
  ) {
    throw new Error("SANITARIO_V2_INVENTORY_MOVEMENT_INELIGIBLE");
  }
  const historySource = event.payload.entry_history_source;
  if (
    historySource === "external_declared" ||
    historySource === "external_documented"
  ) {
    throw new Error("SANITARIO_V2_INVENTORY_MOVEMENT_EXTERNAL_FORBIDDEN");
  }
  const record = {
    ...movement,
    client_op_id: input.identity.clientOpId,
    client_tx_id: input.identity.clientTxId,
    domain_op_id: input.identity.domainOpId,
  };
  return {
    client_op_id: input.identity.clientOpId,
    client_tx_id: input.identity.clientTxId,
    op_order: 1,
    table: "state_insumo_movimentacoes",
    action: "INSERT",
    record,
    domain_op_id: input.identity.domainOpId,
    sync_state: "PENDING",
    created_at: movement.created_at,
  };
}

export async function writeSanitarioV2Queue(input: {
  fazendaId: string;
  clientId: string;
  operations: readonly SanitarioV2QueuedOperation[];
  companionOperations?: readonly Operation[];
}) {
  if (input.operations.length === 0) return;
  for (const op of input.operations) {
    if (op.contract_version !== 3) throw new Error("SANITARIO_CLIENT_CONTRACT_OUTDATED");
    prepareSanitaryCommandV3({ ...op, fazenda_id: input.fazendaId });
  }
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
  for (const companion of input.companionOperations ?? []) {
    requireIdentity({
      clientTxId: companion.client_tx_id,
      clientOpId: companion.client_op_id,
      domainOpId: companion.domain_op_id ?? "",
    });
    if (
      companion.client_tx_id !== clientTxId ||
      companion.table !== "state_insumo_movimentacoes" ||
      companion.action !== "INSERT"
    ) {
      throw new Error("SANITARIO_V2_COMPANION_OPERATION_INVALID");
    }
    const existing = await db.queue_ops.get(companion.client_op_id);
    if (existing) {
      if (!sameQueuedOperation(existing, companion)) {
        throw new Error("SANITARIO_V2_IDENTITY_REUSE_DIVERGENT_PAYLOAD");
      }
      continue;
    }
    newOperations.push(companion);
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

  // Without the original persisted envelope there is no authoritative replay.
  // Preserve local-only history; recovery never manufactures a send from a fact.
  return { candidates: candidates.length, enqueued: 0, replayed: 0, skippedLegacyIncomplete: candidates.length };
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
