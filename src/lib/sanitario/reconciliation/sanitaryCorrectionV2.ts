import { db as defaultDb, type OfflineDB } from "@/lib/offline/db";
import {
  buildApplyFactualCoreOperation,
  SANITARIO_V2_CONTRACT_VERSION,
  validateSanitarioV2Enqueue,
  writeSanitarioV2Queue,
  type SanitarioV2OperationIdentity,
} from "@/lib/offline/sanitarioV2Cutover";
import type {
  Evento,
  EventoAnimalLocalV2,
  EventoSanitario,
} from "@/lib/offline/types";
import { buildExecutedProductTechnicalSnapshotV2 } from "@/lib/sanitario/execution/executedProductTechnicalSnapshotV2";
import type { SanitaryCorrectionType } from "./sanitaryCorrections";

export type SanitaryCorrectionChangesV2 = {
  executed_at?: string;
  produto_sanitario_v2_id?: string | null;
  produto_nome_snapshot?: string | null;
  dose_quantidade?: number | null;
  dose_unidade?: string | null;
  via_aplicacao?: string | null;
  responsavel_nome?: string | null;
  responsavel_tipo?: string | null;
  insumo_id?: string | null;
  estoque_lote_id?: string | null;
  estoque_lote_codigo_snapshot?: string | null;
  lote_fabricante?: string | null;
  validade_produto?: string | null;
  custo_unitario_snapshot?: number | null;
  custo_total_snapshot?: number | null;
};

export type CreateSanitaryCorrectionInputV2 = {
  fazendaId: string;
  correctedEventId: string;
  correctionEventId: string;
  correctionType: SanitaryCorrectionType;
  reason: string;
  occurredAt: string;
  createdBy?: string | null;
  changes?: SanitaryCorrectionChangesV2;
  sync?: {
    clientId: string;
    projectRef: string;
    clientTxId?: string;
    domainOpId?: string;
  };
};

export type SanitaryCorrectionDbV2 = Pick<
  OfflineDB,
  | "event_eventos"
  | "event_eventos_sanitario"
  | "event_eventos_animais"
  | "state_animais"
  | "catalog_sanitario_produtos_v2"
  | "catalog_sanitario_fontes_tecnicas_v2"
  | "catalog_sanitario_fonte_cobertura_campos_v2"
  | "catalog_sanitario_produto_fontes_v2"
  | "catalog_sanitario_produto_dose_rules_v2"
  | "catalog_sanitario_produto_especie_autorizacao_v2"
  | "sync_sanitario_v2_cutovers"
  | "queue_gestures"
  | "queue_ops"
  | "transaction"
>;

export type SanitaryCorrectionProjectionV2 =
  | {
      status: "resolved";
      rootEventId: string;
      currentEvent: Evento;
      currentDetail: EventoSanitario;
      effectiveOccurredAt: string;
      chainEventIds: string[];
    }
  | {
      status: "conflict" | "invalid";
      rootEventId: string;
      chainEventIds: string[];
      conflictingEventIds: string[];
      reason: string;
    };

const TECHNICAL_FIELDS = new Set<keyof SanitaryCorrectionChangesV2>([
  "produto_sanitario_v2_id",
  "produto_nome_snapshot",
  "dose_quantidade",
  "dose_unidade",
  "via_aplicacao",
]);
const SPECIALIZED_GESTURE_TYPES = new Set<SanitaryCorrectionType>([
  "estorno_baixa_estoque",
  "contra_lancamento_estoque",
  "resolucao_ocorrencia_biosseguranca",
  "cancelamento_ocorrencia_biosseguranca",
  "encerramento_pendencia_corretiva",
]);
const ALLOWED_FIELDS: Record<
  SanitaryCorrectionType,
  ReadonlySet<keyof SanitaryCorrectionChangesV2>
> = {
  complemento_rastreabilidade: new Set([
    "executed_at",
    "produto_sanitario_v2_id",
    "produto_nome_snapshot",
    "dose_quantidade",
    "dose_unidade",
    "via_aplicacao",
    "responsavel_nome",
    "responsavel_tipo",
    "lote_fabricante",
    "validade_produto",
  ]),
  correcao_custo: new Set(["custo_unitario_snapshot", "custo_total_snapshot"]),
  correcao_lote_estoque: new Set([
    "insumo_id",
    "estoque_lote_id",
    "estoque_lote_codigo_snapshot",
    "lote_fabricante",
    "validade_produto",
  ]),
  estorno_baixa_estoque: new Set(),
  contra_lancamento_estoque: new Set(),
  resolucao_ocorrencia_biosseguranca: new Set(),
  cancelamento_ocorrencia_biosseguranca: new Set(),
  encerramento_pendencia_corretiva: new Set(),
};

function uuid() {
  const value = globalThis.crypto?.randomUUID?.();
  if (!value) throw new Error("SANITARY_CORRECTION_UUID_UNAVAILABLE");
  return value;
}

function iso(value: string, code: string) {
  const parsed = new Date(value);
  if (!value || !Number.isFinite(parsed.getTime())) throw new Error(code);
  return parsed.toISOString();
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value: unknown) {
  const text = stable(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function correctionPayload(event: Evento) {
  const raw = event.payload.sanitary_correction;
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : null;
}

function validateChanges(
  type: SanitaryCorrectionType,
  changes: SanitaryCorrectionChangesV2,
) {
  if (SPECIALIZED_GESTURE_TYPES.has(type)) {
    throw new Error("SANITARY_CORRECTION_SPECIALIZED_GESTURE_REQUIRED");
  }
  const keys = Object.keys(changes) as Array<keyof SanitaryCorrectionChangesV2>;
  const unsupported = keys.filter((key) => !ALLOWED_FIELDS[type].has(key));
  if (unsupported.length > 0) {
    throw new Error(
      `SANITARY_CORRECTION_FIELDS_UNSUPPORTED:${unsupported.sort().join(",")}`,
    );
  }
  if (type === "complemento_rastreabilidade" && keys.length === 0) {
    throw new Error("SANITARY_CORRECTION_CHANGES_REQUIRED");
  }
  if (
    changes.dose_quantidade != null &&
    (!Number.isFinite(changes.dose_quantidade) || changes.dose_quantidade <= 0)
  ) {
    throw new Error("SANITARY_CORRECTION_DOSE_INVALID");
  }
  for (const key of [
    "custo_unitario_snapshot",
    "custo_total_snapshot",
  ] as const) {
    const value = changes[key];
    if (value != null && (!Number.isFinite(value) || value < 0)) {
      throw new Error("SANITARY_CORRECTION_COST_INVALID");
    }
  }
}

function rootEventId(event: Evento) {
  return typeof correctionPayload(event)?.evento_origem_id === "string"
    ? String(correctionPayload(event)?.evento_origem_id)
    : event.id;
}

function sourceSnapshot(event: Evento, detail: EventoSanitario) {
  return {
    event: {
      id: event.id,
      root_event_id: rootEventId(event),
      occurred_at: event.occurred_at,
      effective_occurred_at:
        typeof event.payload.effective_occurred_at === "string"
          ? event.payload.effective_occurred_at
          : event.occurred_at,
      animal_id: event.animal_id,
      lote_id: event.lote_id,
    },
    detail: {
      tipo: detail.tipo,
      produto_sanitario_v2_id: detail.produto_sanitario_v2_id ?? null,
      produto_nome_snapshot: detail.produto_nome_snapshot ?? null,
      produto_snapshot: detail.produto_snapshot ?? null,
      insumo_id: detail.insumo_id ?? null,
      estoque_lote_id: detail.estoque_lote_id ?? null,
      estoque_lote_codigo_snapshot: detail.estoque_lote_codigo_snapshot ?? null,
      lote_fabricante: detail.lote_fabricante ?? null,
      validade_produto: detail.validade_produto ?? null,
      dose_quantidade: detail.dose_quantidade ?? null,
      dose_unidade: detail.dose_unidade ?? null,
      via_aplicacao: detail.via_aplicacao ?? null,
      responsavel_nome: detail.responsavel_nome ?? null,
      responsavel_tipo: detail.responsavel_tipo ?? null,
      custo_unitario_snapshot: detail.custo_unitario_snapshot ?? null,
      custo_total_snapshot: detail.custo_total_snapshot ?? null,
    },
  };
}

async function buildTechnicalSnapshot(input: {
  db: SanitaryCorrectionDbV2;
  eventId: string;
  fazendaId: string;
  detail: EventoSanitario;
  relations: EventoAnimalLocalV2[];
}) {
  const productId = input.detail.produto_sanitario_v2_id;
  const productName = input.detail.produto_nome_snapshot?.trim();
  const dose = input.detail.dose_quantidade;
  const doseUnit = input.detail.dose_unidade?.trim();
  const route = input.detail.via_aplicacao?.trim();
  if (!productId || !productName || !dose || !doseUnit || !route) {
    throw new Error("SANITARY_CORRECTION_TECHNICAL_FACT_INCOMPLETE");
  }
  const [product, productSources, doseRules, authorizations, animals] =
    await Promise.all([
      input.db.catalog_sanitario_produtos_v2.get(productId),
      input.db.catalog_sanitario_produto_fontes_v2
        .where("product_id")
        .equals(productId)
        .toArray(),
      input.db.catalog_sanitario_produto_dose_rules_v2
        .where("product_id")
        .equals(productId)
        .toArray(),
      input.db.catalog_sanitario_produto_especie_autorizacao_v2
        .where("product_id")
        .equals(productId)
        .toArray(),
      input.db.state_animais.bulkGet(
        input.relations.map((entry) => entry.animal_id),
      ),
    ]);
  const sourceIds = Array.from(
    new Set(productSources.map((entry) => entry.source_id)),
  );
  const [sources, coverages] = await Promise.all([
    input.db.catalog_sanitario_fontes_tecnicas_v2.bulkGet(sourceIds),
    sourceIds.length
      ? input.db.catalog_sanitario_fonte_cobertura_campos_v2
          .where("source_id")
          .anyOf(sourceIds)
          .toArray()
      : Promise.resolve([]),
  ]);
  return buildExecutedProductTechnicalSnapshotV2({
    eventId: input.eventId,
    fazendaId: input.fazendaId,
    executedProductId: productId,
    executedProductName: productName,
    executedDose: { quantity: dose, unit: doseUnit },
    executedRoute: route,
    animals: input.relations.map((relation, index) => ({
      animalId: relation.animal_id,
      speciesCode:
        animals[index]?.fazenda_id === input.fazendaId
          ? (animals[index]?.especie ?? null)
          : null,
    })),
    product: product ?? null,
    productSources,
    sources: sources.filter((entry): entry is NonNullable<typeof entry> =>
      Boolean(entry),
    ),
    coverages,
    doseRules,
    speciesAuthorizations: authorizations,
  });
}

export function resolveSanitaryCorrectionChainV2(input: {
  fazendaId: string;
  rootEventId: string;
  events: readonly Evento[];
  details: readonly EventoSanitario[];
}): SanitaryCorrectionProjectionV2 {
  const events = input.events.filter(
    (event) => event.fazenda_id === input.fazendaId && !event.deleted_at,
  );
  const byId = new Map(events.map((event) => [event.id, event]));
  const details = new Map(
    input.details
      .filter(
        (detail) => detail.fazenda_id === input.fazendaId && !detail.deleted_at,
      )
      .map((detail) => [detail.evento_id, detail]),
  );
  const root = byId.get(input.rootEventId);
  const rootDetail = details.get(input.rootEventId);
  if (!root || !rootDetail || root.corrige_evento_id) {
    return {
      status: "invalid",
      rootEventId: input.rootEventId,
      chainEventIds: [],
      conflictingEventIds: [],
      reason: "root_fact_missing_or_invalid",
    };
  }
  const chain = [root.id];
  const visited = new Set(chain);
  let current = root;
  while (true) {
    const children = events.filter(
      (event) => event.corrige_evento_id === current.id,
    );
    if (children.length > 1) {
      return {
        status: "conflict",
        rootEventId: root.id,
        chainEventIds: chain,
        conflictingEventIds: children.map((event) => event.id).sort(),
        reason: "branched_correction_chain",
      };
    }
    if (children.length === 0) break;
    const next = children[0];
    if (visited.has(next.id)) {
      return {
        status: "invalid",
        rootEventId: root.id,
        chainEventIds: chain,
        conflictingEventIds: [next.id],
        reason: "cyclic_correction_chain",
      };
    }
    if (
      next.sanitario_sync_v2_nature !== "correction" ||
      rootEventId(next) !== root.id ||
      !details.has(next.id)
    ) {
      return {
        status: "invalid",
        rootEventId: root.id,
        chainEventIds: chain,
        conflictingEventIds: [next.id],
        reason: "invalid_correction_fact",
      };
    }
    visited.add(next.id);
    chain.push(next.id);
    current = next;
  }
  const effectiveOccurredAt =
    typeof current.payload.effective_occurred_at === "string"
      ? current.payload.effective_occurred_at
      : root.occurred_at;
  return {
    status: "resolved",
    rootEventId: root.id,
    currentEvent: current,
    currentDetail: details.get(current.id)!,
    effectiveOccurredAt,
    chainEventIds: chain,
  };
}

export async function createSanitaryCorrectionV2(
  input: CreateSanitaryCorrectionInputV2,
  localDb: SanitaryCorrectionDbV2 = defaultDb,
) {
  const reason = input.reason.trim();
  if (!reason) throw new Error("SANITARY_CORRECTION_REASON_REQUIRED");
  const occurredAt = iso(
    input.occurredAt,
    "SANITARY_CORRECTION_OCCURRED_AT_INVALID",
  );
  const changes = input.changes ?? {};
  validateChanges(input.correctionType, changes);
  const intentFingerprint = fingerprint({
    fazendaId: input.fazendaId,
    correctedEventId: input.correctedEventId,
    correctionEventId: input.correctionEventId,
    correctionType: input.correctionType,
    reason,
    occurredAt,
    createdBy: input.createdBy ?? null,
    changes,
  });
  const existing = await localDb.event_eventos.get(input.correctionEventId);
  if (existing) {
    if (
      existing.fazenda_id !== input.fazendaId ||
      correctionPayload(existing)?.request_fingerprint !== intentFingerprint
    ) {
      throw new Error("SANITARY_CORRECTION_IDENTITY_CONFLICT");
    }
    return {
      eventId: existing.id,
      replayed: true,
      chainRootEventId: rootEventId(existing),
    };
  }
  const corrected = await localDb.event_eventos.get(input.correctedEventId);
  const correctedDetail = await localDb.event_eventos_sanitario.get(
    input.correctedEventId,
  );
  if (
    !corrected ||
    !correctedDetail ||
    corrected.deleted_at ||
    correctedDetail.deleted_at
  ) {
    throw new Error("SANITARY_CORRECTION_SOURCE_NOT_FOUND");
  }
  if (
    corrected.fazenda_id !== input.fazendaId ||
    correctedDetail.fazenda_id !== input.fazendaId
  ) {
    throw new Error("SANITARY_CORRECTION_TENANT_MISMATCH");
  }
  if (corrected.dominio !== "sanitario")
    throw new Error("SANITARY_CORRECTION_SOURCE_NOT_SANITARY");
  if (corrected.id === input.correctionEventId)
    throw new Error("SANITARY_CORRECTION_CYCLE");
  const child = await localDb.event_eventos
    .filter(
      (event) => event.corrige_evento_id === corrected.id && !event.deleted_at,
    )
    .first();
  if (child) throw new Error("SANITARY_CORRECTION_CHAIN_BRANCH_CONFLICT");
  const relations = await localDb.event_eventos_animais
    .where("evento_id")
    .equals(corrected.id)
    .toArray();
  if (
    !relations.length ||
    relations.some((relation) => relation.fazenda_id !== input.fazendaId)
  ) {
    throw new Error("SANITARY_CORRECTION_ANIMAL_RELATIONS_INVALID");
  }
  const identity: SanitarioV2OperationIdentity | undefined = input.sync
    ? {
        clientTxId: input.sync.clientTxId ?? uuid(),
        clientOpId: input.correctionEventId,
        domainOpId: input.sync.domainOpId ?? uuid(),
      }
    : undefined;
  const now = new Date().toISOString();
  const clientId = input.sync?.clientId ?? "sanitary-correction-v2";
  const meta = {
    client_id: clientId,
    client_op_id: input.correctionEventId,
    client_tx_id: identity?.clientTxId ?? null,
    client_recorded_at: now,
    server_received_at: now,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
  const rootId = rootEventId(corrected);
  const previousEffectiveOccurredAt =
    typeof corrected.payload.effective_occurred_at === "string"
      ? corrected.payload.effective_occurred_at
      : corrected.occurred_at;
  const effectiveOccurredAt = changes.executed_at
    ? iso(changes.executed_at, "SANITARY_CORRECTION_EXECUTED_AT_INVALID")
    : previousEffectiveOccurredAt;
  const technicalCorrection = (
    Object.keys(changes) as Array<keyof SanitaryCorrectionChangesV2>
  ).some((key) => TECHNICAL_FIELDS.has(key));
  const event: Evento = {
    ...corrected,
    id: input.correctionEventId,
    occurred_at: occurredAt,
    occurred_on: occurredAt.slice(0, 10),
    source_task_id: null,
    source_tx_id: null,
    source_client_op_id: input.correctionEventId,
    source_sanitario_agenda_v2_id: null,
    corrige_evento_id: corrected.id,
    observacoes: reason,
    payload: {
      schema: "sanitary_correction_v2",
      effective_occurred_at: effectiveOccurredAt,
      sanitary_correction: {
        schema_version: 1,
        evento_origem_id: rootId,
        corrige_evento_id: corrected.id,
        tipo_correcao: input.correctionType,
        motivo: reason,
        payload_original_snapshot: sourceSnapshot(corrected, correctedDetail),
        payload_correcao: changes,
        created_by: input.createdBy ?? null,
        created_at: occurredAt,
        fazenda_id: input.fazendaId,
        idempotency_key: input.correctionEventId,
        request_fingerprint: intentFingerprint,
        technical_correction: technicalCorrection,
        contract_status: "complete",
        contract_limitations: [],
      },
      creates_stock_movement: false,
      creates_active_withdrawal: false,
    },
    sanitario_sync_v2_nature: "correction",
    sanitario_contract_version: SANITARIO_V2_CONTRACT_VERSION,
    domain_op_id: identity?.domainOpId ?? null,
    ...meta,
  };
  const detailChanges = { ...changes };
  delete detailChanges.executed_at;
  const detail: EventoSanitario = {
    ...correctedDetail,
    ...detailChanges,
    evento_id: event.id,
    fazenda_id: input.fazendaId,
    produto: changes.produto_nome_snapshot ?? correctedDetail.produto,
    sanitario_contract_version: SANITARIO_V2_CONTRACT_VERSION,
    domain_op_id: identity?.domainOpId ?? null,
    payload: event.payload,
    ...meta,
  };
  if (technicalCorrection) {
    detail.produto_snapshot = await buildTechnicalSnapshot({
      db: localDb,
      eventId: event.id,
      fazendaId: input.fazendaId,
      detail,
      relations,
    });
  }
  const eventAnimals = relations.map((relation) => ({
    id: uuid(),
    fazenda_id: input.fazendaId,
    evento_id: event.id,
    animal_id: relation.animal_id,
    created_at: now,
  }));
  const operation = identity
    ? buildApplyFactualCoreOperation(identity, event, detail, eventAnimals)
    : null;
  if (input.sync && operation) {
    if (localDb !== defaultDb)
      throw new Error("SANITARY_CORRECTION_SYNC_REQUIRES_DEFAULT_DB");
    await validateSanitarioV2Enqueue({
      fazendaId: input.fazendaId,
      projectRef: input.sync.projectRef,
      operations: [operation],
    });
  }
  await localDb.transaction(
    "rw",
    [
      localDb.event_eventos,
      localDb.event_eventos_sanitario,
      localDb.event_eventos_animais,
      localDb.queue_gestures,
      localDb.queue_ops,
    ],
    async () => {
      if (await localDb.event_eventos.get(event.id))
        throw new Error("SANITARY_CORRECTION_IDENTITY_CONFLICT");
      await localDb.event_eventos.add(event);
      await localDb.event_eventos_sanitario.add(detail);
      await localDb.event_eventos_animais.bulkAdd(eventAnimals);
      if (input.sync && operation) {
        await writeSanitarioV2Queue({
          fazendaId: input.fazendaId,
          clientId: input.sync.clientId,
          operations: [operation],
        });
      }
    },
  );
  return { eventId: event.id, replayed: false, chainRootEventId: rootId };
}
