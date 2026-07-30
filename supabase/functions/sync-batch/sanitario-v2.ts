export const SANITARIO_SYNC_V2_DOMAIN = "sanitario_v2" as const;
export const SANITARIO_SYNC_V2_MAX_TARGETS = 500;
export const SANITARIO_SYNC_V2_MAX_PAYLOAD_BYTES = 1024 * 1024;

export type SanitarioSyncV2Command =
  | "create_agenda"
  | "replace_agenda_animals"
  | "apply_factual_core"
  | "close_agenda";

export type SanitarioSyncV2Status =
  | "APPLIED"
  | "RETRYABLE"
  | "REJECTED"
  | "CONFLICT"
  | "BLOCKED_DEPENDENCY";

export interface SanitarioAgendaInput {
  id: string;
  dedup_key?: string | null;
  source_demand_key?: string | null;
  preview_group_id?: string | null;
  protocolo_id?: string | null;
  protocol_item_version_id?: string | null;
  protocol_item_snapshot?: Record<string, unknown> | null;
  janela_inicio?: string | null;
  janela_fim?: string | null;
  data_programada?: string | null;
  lote_id?: string | null;
  produto_snapshot?: Record<string, unknown> | null;
  produto_classe?: string | null;
  acao_sanitaria?: string | null;
  metadata?: Record<string, unknown> | null;
  client_recorded_at?: string | null;
}

export interface SanitarioEventInput {
  id: string;
  source_sanitario_agenda_v2_id?: string | null;
  natureza: "primary_execution" | "correction" | "standalone_fact";
  occurred_at: string;
  animal_id?: string | null;
  lote_id?: string | null;
  corrige_evento_id?: string | null;
  observacoes?: string | null;
  payload?: Record<string, unknown> | null;
  client_recorded_at?: string | null;
}

export interface SanitarioDetailInput {
  tipo: string;
  produto_sanitario_v2_id?: string | null;
  insumo_id?: string | null;
  estoque_lote_id?: string | null;
  produto_nome_snapshot?: string | null;
  produto_snapshot?: Record<string, unknown> | null;
  estoque_lote_codigo_snapshot?: string | null;
  lote_fabricante?: string | null;
  validade_produto?: string | null;
  dose_quantidade?: number | null;
  dose_unidade?: string | null;
  via_aplicacao?: string | null;
  responsavel_nome?: string | null;
  responsavel_tipo?: string | null;
  carencia_carne_dias?: number | null;
  carencia_leite_dias?: number | null;
  carencia_carne_ate?: string | null;
  carencia_leite_ate?: string | null;
  custo_unitario_snapshot?: number | null;
  custo_total_snapshot?: number | null;
  payload?: Record<string, unknown> | null;
}

export interface SanitarioEventAnimalInput {
  id: string;
  animal_id: string;
}

export interface SanitarioClosureInput {
  id: string;
  agenda_id: string;
  closure_type: "cancelled" | "dismissed";
  dedup_key?: string | null;
  client_recorded_at?: string | null;
  closed_at?: string | null;
  reason?: string | null;
  partial_payload?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

interface SanitarioSyncV2OperationBase {
  client_op_id: string;
  client_tx_id: string;
  domain_op_id: string;
  domain: typeof SANITARIO_SYNC_V2_DOMAIN;
  contract_version: number;
  command: SanitarioSyncV2Command;
  expected_revision?: number | null;
  fazenda_id?: string;
  actor_user_id?: never;
}

export interface CreateAgendaOperation extends SanitarioSyncV2OperationBase {
  command: "create_agenda";
  payload: {
    agenda: SanitarioAgendaInput;
    animal_ids: string[];
  };
}

export interface ReplaceAgendaAnimalsOperation
  extends SanitarioSyncV2OperationBase {
  command: "replace_agenda_animals";
  expected_revision: number;
  payload: {
    agenda_id: string;
    animal_ids: string[];
  };
}

export interface ApplyFactualCoreOperation
  extends SanitarioSyncV2OperationBase {
  command: "apply_factual_core";
  payload: {
    event: SanitarioEventInput;
    detail: SanitarioDetailInput;
    event_animals: SanitarioEventAnimalInput[];
  };
}

export interface CloseAgendaOperation extends SanitarioSyncV2OperationBase {
  command: "close_agenda";
  expected_revision: number;
  payload: {
    closure: SanitarioClosureInput;
  };
}

export type SanitarioSyncV2Operation =
  | CreateAgendaOperation
  | ReplaceAgendaAnimalsOperation
  | ApplyFactualCoreOperation
  | CloseAgendaOperation;

export interface SanitarioSyncV2Gate {
  enabled: boolean;
  minimum_contract_version: number;
  maximum_contract_version: number;
  allowed_user_ids: string[] | null;
  allowed_client_ids: string[] | null;
  rollout_percentage: number;
  valid_from: string | null;
  valid_until: string | null;
}

export interface SanitarioSyncV2Context {
  actorUserId: string;
  fazendaId: string;
  clientId: string;
  clientTxId: string;
  membershipRole: string;
  now?: Date;
}

export interface SanitarioDbError {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}

export interface SanitarioRpcCall {
  functionName:
    | "internal_sanitario_sync_v2_create_agenda"
    | "internal_sanitario_sync_v2_replace_agenda_animals"
    | "internal_sanitario_sync_v2_apply_factual_core"
    | "internal_sanitario_sync_v2_close_agenda";
  args: Record<string, unknown>;
}

export interface SanitarioSyncV2Result {
  op_id: string;
  client_op_id: string;
  domain_op_id?: string;
  status: SanitarioSyncV2Status;
  reason_code?: string;
  canonical_entity_id?: string;
  current_revision?: number;
  canonical_status?: string;
  retryable: boolean;
  canonical_result?: Record<string, unknown>;
}

export interface SanitarioSyncV2Dependencies {
  loadGate: (
    fazendaId: string,
  ) => Promise<
    { data: SanitarioSyncV2Gate | null; error: SanitarioDbError | null }
  >;
  callRpc: (
    call: SanitarioRpcCall,
  ) => Promise<{ data: unknown; error: SanitarioDbError | null }>;
}

export function validateSanitarioSyncV2Envelope(
  context: Pick<
    SanitarioSyncV2Context,
    "fazendaId" | "clientId" | "clientTxId"
  >,
): string | null {
  if (!isUuid(context.fazendaId)) return "SANITARIO_FAZENDA_CONTEXT_INVALID";
  if (!isUuid(context.clientTxId)) return "SANITARIO_CLIENT_TX_CONTEXT_INVALID";
  if (
    typeof context.clientId !== "string" ||
    context.clientId.trim().length === 0 ||
    context.clientId.length > 128
  ) {
    return "SANITARIO_CLIENT_CONTEXT_INVALID";
  }
  return null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const COMMANDS = new Set<SanitarioSyncV2Command>([
  "create_agenda",
  "replace_agenda_animals",
  "apply_factual_core",
  "close_agenda",
]);

const COMMAND_ALLOWED_ROLES: Record<
  SanitarioSyncV2Command,
  ReadonlySet<string>
> = {
  create_agenda: new Set(["owner", "manager"]),
  replace_agenda_animals: new Set(["owner", "manager"]),
  apply_factual_core: new Set(["owner", "manager", "cowboy"]),
  close_agenda: new Set(["owner", "manager"]),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function payloadSize(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function findUntrustedContext(
  value: unknown,
  context: SanitarioSyncV2Context,
): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const issue = findUntrustedContext(item, context);
      if (issue) return issue;
    }
    return null;
  }
  if (!isRecord(value)) return null;

  if ("actor_user_id" in value) return "SANITARIO_ACTOR_MUST_COME_FROM_JWT";
  if ("fazenda_id" in value && value.fazenda_id !== context.fazendaId) {
    return "SANITARIO_FAZENDA_CONTEXT_MISMATCH";
  }
  if ("client_id" in value && value.client_id !== context.clientId) {
    return "SANITARIO_CLIENT_CONTEXT_MISMATCH";
  }
  if ("client_tx_id" in value && value.client_tx_id !== context.clientTxId) {
    return "SANITARIO_CLIENT_TX_CONTEXT_MISMATCH";
  }

  for (const nested of Object.values(value)) {
    const issue = findUntrustedContext(nested, context);
    if (issue) return issue;
  }
  return null;
}

function validateTargets(ids: unknown): string | null {
  if (
    !Array.isArray(ids) || ids.length === 0 ||
    ids.length > SANITARIO_SYNC_V2_MAX_TARGETS
  ) {
    return "SANITARIO_TARGETS_LIMIT_EXCEEDED";
  }
  if (!ids.every(isUuid) || new Set(ids).size !== ids.length) {
    return "SANITARIO_TARGETS_INVALID";
  }
  return null;
}

function reject(
  raw: unknown,
  reasonCode: string,
  status: Exclude<SanitarioSyncV2Status, "APPLIED" | "RETRYABLE"> = "REJECTED",
): SanitarioSyncV2Result {
  const record = isRecord(raw) ? raw : {};
  const clientOpId = typeof record.client_op_id === "string"
    ? record.client_op_id
    : "";
  return {
    op_id: clientOpId,
    client_op_id: clientOpId,
    domain_op_id: typeof record.domain_op_id === "string"
      ? record.domain_op_id
      : undefined,
    status,
    reason_code: reasonCode,
    retryable: false,
  };
}

export function isSanitarioSyncV2Operation(
  value: unknown,
): value is SanitarioSyncV2Operation {
  return isRecord(value) && value.domain === SANITARIO_SYNC_V2_DOMAIN;
}

function validateSanitarioSyncV2Routing(
  raw: unknown,
  context: SanitarioSyncV2Context,
): { ok: true; operation: SanitarioSyncV2Operation } | {
  ok: false;
  result: SanitarioSyncV2Result;
} {
  if (!isRecord(raw) || raw.domain !== SANITARIO_SYNC_V2_DOMAIN) {
    return { ok: false, result: reject(raw, "SANITARIO_DOMAIN_INVALID") };
  }
  if (
    typeof raw.command !== "string" ||
    !COMMANDS.has(raw.command as SanitarioSyncV2Command)
  ) {
    return {
      ok: false,
      result: reject(raw, "SANITARIO_COMMAND_NOT_ALLOWLISTED"),
    };
  }
  if (!isUuid(raw.client_op_id) || !isUuid(raw.domain_op_id)) {
    return { ok: false, result: reject(raw, "SANITARIO_OPERATION_ID_INVALID") };
  }
  if (!isUuid(raw.client_tx_id) || raw.client_tx_id !== context.clientTxId) {
    return {
      ok: false,
      result: reject(raw, "SANITARIO_CLIENT_TX_CONTEXT_MISMATCH"),
    };
  }
  if ("actor_user_id" in raw) {
    return {
      ok: false,
      result: reject(raw, "SANITARIO_ACTOR_MUST_COME_FROM_JWT"),
    };
  }
  if ("fazenda_id" in raw && raw.fazenda_id !== context.fazendaId) {
    return {
      ok: false,
      result: reject(raw, "SANITARIO_FAZENDA_CONTEXT_MISMATCH"),
    };
  }
  if (
    !Number.isSafeInteger(raw.contract_version) ||
    Number(raw.contract_version) <= 0
  ) {
    return {
      ok: false,
      result: reject(raw, "SANITARIO_CONTRACT_VERSION_INVALID"),
    };
  }
  if (!isRecord(raw.payload)) {
    return { ok: false, result: reject(raw, "SANITARIO_PAYLOAD_INVALID") };
  }

  const contextIssue = findUntrustedContext(raw.payload, context);
  if (contextIssue) return { ok: false, result: reject(raw, contextIssue) };
  return { ok: true, operation: raw as unknown as SanitarioSyncV2Operation };
}

export function validateSanitarioSyncV2Operation(
  value: unknown,
  context: SanitarioSyncV2Context,
): { ok: true; operation: SanitarioSyncV2Operation } | {
  ok: false;
  result: SanitarioSyncV2Result;
} {
  const routing = validateSanitarioSyncV2Routing(value, context);
  if (!routing.ok) return routing;
  const raw = routing.operation as unknown as Record<string, unknown>;
  const payload = raw.payload as Record<string, unknown>;

  if (payloadSize(payload) > SANITARIO_SYNC_V2_MAX_PAYLOAD_BYTES) {
    return {
      ok: false,
      result: reject(raw, "SANITARIO_PAYLOAD_LIMIT_EXCEEDED"),
    };
  }

  const command = raw.command as SanitarioSyncV2Command;
  if (command === "create_agenda") {
    if (!isRecord(payload.agenda) || !isUuid(payload.agenda.id)) {
      return {
        ok: false,
        result: reject(raw, "SANITARIO_AGENDA_PAYLOAD_INVALID"),
      };
    }
    const targetsIssue = validateTargets(payload.animal_ids);
    if (targetsIssue) return { ok: false, result: reject(raw, targetsIssue) };
  }

  if (command === "replace_agenda_animals") {
    if (!isRevision(raw.expected_revision)) {
      return {
        ok: false,
        result: reject(raw, "SANITARIO_EXPECTED_REVISION_REQUIRED"),
      };
    }
    if (!isUuid(payload.agenda_id)) {
      return { ok: false, result: reject(raw, "SANITARIO_AGENDA_ID_INVALID") };
    }
    const targetsIssue = validateTargets(payload.animal_ids);
    if (targetsIssue) return { ok: false, result: reject(raw, targetsIssue) };
  }

  if (command === "apply_factual_core") {
    if (
      !isRecord(payload.event) ||
      !isUuid(payload.event.id) ||
      !isRecord(payload.detail) ||
      !Array.isArray(payload.event_animals)
    ) {
      return {
        ok: false,
        result: reject(raw, "SANITARIO_FACTUAL_PAYLOAD_INVALID"),
      };
    }
    const event = payload.event;
    if (
      event.natureza === "primary_execution" &&
      event.source_sanitario_agenda_v2_id != null &&
      !isRevision(raw.expected_revision)
    ) {
      return {
        ok: false,
        result: reject(raw, "SANITARIO_EXPECTED_REVISION_REQUIRED"),
      };
    }
    const eventAnimals = payload.event_animals as unknown[];
    const animalIds = eventAnimals.map((item) =>
      isRecord(item) ? item.animal_id : null
    );
    const relationIds = eventAnimals.map((item) =>
      isRecord(item) ? item.id : null
    );
    const targetsIssue = validateTargets(animalIds);
    if (
      targetsIssue ||
      !relationIds.every(isUuid) ||
      new Set(relationIds).size !== relationIds.length
    ) {
      return {
        ok: false,
        result: reject(raw, "SANITARIO_EVENT_ANIMALS_INVALID"),
      };
    }
  }

  if (command === "close_agenda") {
    if (!isRevision(raw.expected_revision)) {
      return {
        ok: false,
        result: reject(raw, "SANITARIO_EXPECTED_REVISION_REQUIRED"),
      };
    }
    const closure = payload.closure;
    if (
      !isRecord(closure) ||
      !isUuid(closure.id) ||
      !isUuid(closure.agenda_id) ||
      (closure.closure_type !== "cancelled" &&
        closure.closure_type !== "dismissed")
    ) {
      return {
        ok: false,
        result: reject(raw, "SANITARIO_CLOSURE_PAYLOAD_INVALID"),
      };
    }
  }

  return { ok: true, operation: raw as unknown as SanitarioSyncV2Operation };
}

function sanitizeCompositeRecord<T extends object>(
  value: T,
  context?: Pick<SanitarioSyncV2Context, "clientId" | "clientTxId">,
): Record<string, unknown> {
  const source = value as Record<string, unknown>;

  const {
    actor_user_id: _actorUserId,
    fazenda_id: _fazendaId,
    client_id: _clientId,
    client_tx_id: _clientTxId,
    ...safe
  } = source;
  return context
    ? { ...safe, client_id: context.clientId, client_tx_id: context.clientTxId }
    : safe;
}

export function buildSanitarioSyncV2RpcCall(
  operation: SanitarioSyncV2Operation,
  context: SanitarioSyncV2Context,
): SanitarioRpcCall {
  const common = {
    actor_user_id: context.actorUserId,
    fazenda_id: context.fazendaId,
    contract_version: operation.contract_version,
    client_op_id: operation.client_op_id,
    domain_op_id: operation.domain_op_id,
  };

  switch (operation.command) {
    case "create_agenda":
      return {
        functionName: "internal_sanitario_sync_v2_create_agenda",
        args: {
          ...common,
          payload: sanitizeCompositeRecord(operation.payload.agenda, context),
          animal_ids: operation.payload.animal_ids,
        },
      };
    case "replace_agenda_animals":
      return {
        functionName: "internal_sanitario_sync_v2_replace_agenda_animals",
        args: {
          ...common,
          expected_revision: operation.expected_revision,
          agenda_id: operation.payload.agenda_id,
          client_id: context.clientId,
          animal_ids: operation.payload.animal_ids,
        },
      };
    case "apply_factual_core":
      return {
        functionName: "internal_sanitario_sync_v2_apply_factual_core",
        args: {
          ...common,
          expected_revision: operation.expected_revision ?? null,
          event_payload: sanitizeCompositeRecord(
            operation.payload.event,
            context,
          ),
          detail_payload: sanitizeCompositeRecord(operation.payload.detail),
          event_animals: operation.payload.event_animals.map((
            { id, animal_id },
          ) => ({
            id,
            animal_id,
          })),
        },
      };
    case "close_agenda":
      return {
        functionName: "internal_sanitario_sync_v2_close_agenda",
        args: {
          ...common,
          expected_revision: operation.expected_revision,
          payload: sanitizeCompositeRecord(operation.payload.closure, context),
        },
      };
  }
}

function extractDatabaseReason(error: SanitarioDbError): string | null {
  const message = [error.message, error.details, error.hint].filter(Boolean)
    .join(" ");
  return message.match(/SANITARIO_[A-Z0-9_]+/)?.[0] ?? null;
}

function extractCurrentRevision(error: SanitarioDbError): number | undefined {
  const message = [error.message, error.details].filter(Boolean).join(" ");
  const match = message.match(/current_revision=(\d+)/);
  return match ? Number(match[1]) : undefined;
}

function isTimeoutError(error: SanitarioDbError): boolean {
  const message = [error.message, error.details].filter(Boolean).join(" ");
  return error.code === "57014" || /timeout|timed out|abort/i.test(message);
}

function isDependencyError(error: SanitarioDbError): boolean {
  return ["42883", "42P01", "42704", "PGRST202", "PGRST205"].includes(
    error.code ?? "",
  );
}

function normalizeCanonicalResult(
  operation: SanitarioSyncV2Operation,
  data: unknown,
): SanitarioSyncV2Result {
  if (!isRecord(data)) {
    return reject(
      operation,
      "SANITARIO_RPC_RESULT_INVALID",
      "BLOCKED_DEPENDENCY",
    );
  }
  const canonicalEntityId = typeof data.agenda_id === "string"
    ? data.agenda_id
    : typeof data.evento_id === "string"
    ? data.evento_id
    : typeof data.closure_id === "string"
    ? data.closure_id
    : undefined;
  const canonicalStatus = typeof data.status === "string"
    ? data.status
    : typeof data.agenda_status === "string"
    ? data.agenda_status
    : undefined;
  return {
    op_id: operation.client_op_id,
    client_op_id: operation.client_op_id,
    domain_op_id: operation.domain_op_id,
    status: "APPLIED",
    canonical_entity_id: canonicalEntityId,
    current_revision: typeof data.revision === "number"
      ? data.revision
      : undefined,
    canonical_status: canonicalStatus,
    retryable: false,
    canonical_result: data,
  };
}

export function classifySanitarioSyncV2Error(
  operation: SanitarioSyncV2Operation,
  error: SanitarioDbError,
): SanitarioSyncV2Result {
  const databaseReason = extractDatabaseReason(error);
  if (isTimeoutError(error)) {
    return {
      ...reject(operation, databaseReason ?? "SANITARIO_RPC_TIMEOUT"),
      status: "RETRYABLE",
      retryable: true,
    };
  }
  if (isDependencyError(error)) {
    return reject(
      operation,
      "SANITARIO_SYNC_V2_DEPENDENCY_UNAVAILABLE",
      "BLOCKED_DEPENDENCY",
    );
  }
  if (
    error.code === "40001" ||
    error.code === "23505" ||
    databaseReason === "SANITARIO_AGENDA_NOT_EXECUTABLE"
  ) {
    return {
      ...reject(
        operation,
        databaseReason ?? "SANITARIO_DATABASE_CONFLICT",
        "CONFLICT",
      ),
      current_revision: extractCurrentRevision(error),
    };
  }
  return reject(operation, databaseReason ?? "SANITARIO_RPC_REJECTED");
}

function evaluateGate(
  operation: SanitarioSyncV2Operation,
  context: SanitarioSyncV2Context,
  gate: SanitarioSyncV2Gate | null,
): SanitarioSyncV2Result | null {
  if (!gate || !gate.enabled) {
    return reject(operation, "SANITARIO_SYNC_DISABLED");
  }
  if (
    operation.contract_version < gate.minimum_contract_version ||
    operation.contract_version > gate.maximum_contract_version
  ) {
    return reject(operation, "SANITARIO_CLIENT_CONTRACT_OUTDATED");
  }
  const now = context.now ?? new Date();
  if (
    (gate.valid_from && now < new Date(gate.valid_from)) ||
    (gate.valid_until && now >= new Date(gate.valid_until)) ||
    gate.rollout_percentage <= 0
  ) {
    return reject(operation, "SANITARIO_SYNC_NOT_ENABLED_FOR_FARM");
  }
  if (
    (gate.allowed_user_ids?.length &&
      !gate.allowed_user_ids.includes(context.actorUserId)) ||
    (gate.allowed_client_ids?.length &&
      !gate.allowed_client_ids.includes(context.clientId))
  ) {
    return reject(operation, "SANITARIO_SYNC_NOT_ENABLED_FOR_FARM");
  }
  return null;
}

export async function executeSanitarioSyncV2Operation(
  raw: unknown,
  context: SanitarioSyncV2Context,
  dependencies: SanitarioSyncV2Dependencies,
): Promise<SanitarioSyncV2Result> {
  const routing = validateSanitarioSyncV2Routing(raw, context);
  if (!routing.ok) return routing.result;
  const routedOperation = routing.operation;

  if (
    !COMMAND_ALLOWED_ROLES[routedOperation.command].has(context.membershipRole)
  ) {
    return reject(routedOperation, "SANITARIO_ROLE_NOT_ALLOWED");
  }

  let gateResponse: Awaited<
    ReturnType<SanitarioSyncV2Dependencies["loadGate"]>
  >;
  try {
    gateResponse = await dependencies.loadGate(context.fazendaId);
  } catch (error) {
    return classifySanitarioSyncV2Error(routedOperation, {
      message: error instanceof Error ? error.message : String(error),
    });
  }
  if (gateResponse.error) {
    return classifySanitarioSyncV2Error(routedOperation, gateResponse.error);
  }
  const gateResult = evaluateGate(routedOperation, context, gateResponse.data);
  if (gateResult) return gateResult;

  const validation = validateSanitarioSyncV2Operation(raw, context);
  if (!validation.ok) return validation.result;
  const operation = validation.operation;

  const rpcCall = buildSanitarioSyncV2RpcCall(operation, context);
  try {
    const rpcResponse = await dependencies.callRpc(rpcCall);
    if (rpcResponse.error) {
      return classifySanitarioSyncV2Error(operation, rpcResponse.error);
    }
    return normalizeCanonicalResult(operation, rpcResponse.data);
  } catch (error) {
    return classifySanitarioSyncV2Error(operation, {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

export function sanitarioSyncV2DependencyBlocked(
  raw: unknown,
): SanitarioSyncV2Result {
  return reject(
    raw,
    "SANITARIO_SERVICE_ROLE_UNAVAILABLE",
    "BLOCKED_DEPENDENCY",
  );
}

export function sanitarioSyncV2EnvelopeRejected(
  raw: unknown,
  reasonCode: string,
): SanitarioSyncV2Result {
  return reject(raw, reasonCode);
}
