import { db } from "@/lib/offline/db";
import { env } from "@/lib/env";
import {
  buildApplyFactualCoreOperation,
  createSanitarioV2Identity,
  isSanitarioV2PushEnabled,
  persistSanitarioV2FactualCore,
  SANITARIO_V2_CONTRACT_VERSION,
} from "@/lib/offline/sanitarioV2Cutover";
import type {
  Evento,
  EventoAnimalLocalV2,
  EventoSanitario,
  SanitarioTipoEnum,
} from "@/lib/offline/types";
import type {
  SanitaryProtocolCatalogReadModelV2,
  SanitaryProtocolItemV2ReadModel,
  SanitaryProtocolV2ReadModel,
} from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";

export type SanitaryEntryHistorySourceV2 =
  | "external_documented"
  | "external_declared"
  | "legacy_import";

export type SanitaryEntryHistoryEvidenceClassV2 =
  | "documented"
  | "declared"
  | "unknown";

export type SanitaryEntryHistoryEvidenceTypeV2 =
  | "certificado"
  | "gta"
  | "atestado_veterinario"
  | "nota_documento"
  | "declaracao_produtor"
  | "outro";

export const SANITARY_ENTRY_HISTORY_EVIDENCE_FIELDS_V2 = [
  "protocol_completion",
  "protocol_item_completion",
  "product_class",
  "product",
  "execution_date",
  "dose",
  "route",
  "responsible",
] as const;

export type SanitaryEntryHistoryEvidenceFieldV2 =
  (typeof SANITARY_ENTRY_HISTORY_EVIDENCE_FIELDS_V2)[number];

export type CreateSanitaryEntryHistoryV2Input = {
  fazendaId: string;
  animalId: string;
  protocolId: string;
  itemId: string;
  occurredOn?: string | null;
  dateApproximate: boolean;
  source: SanitaryEntryHistorySourceV2;
  evidenceClass: SanitaryEntryHistoryEvidenceClassV2;
  evidenceType: SanitaryEntryHistoryEvidenceTypeV2;
  evidenceReference?: string | null;
  evidenceCoveredFields?: SanitaryEntryHistoryEvidenceFieldV2[];
  externalOrigin?: string | null;
  productClass?: string | null;
  notes?: string | null;
  catalog: SanitaryProtocolCatalogReadModelV2;
  clientId?: string;
  sync?: {
    clientId: string;
    projectRef: string;
  };
};

export type CreateSanitaryEntryHistoryV2Result = {
  eventId: string;
  createsAgenda: false;
  createsStockMovement: false;
  createsActiveWithdrawal: false;
  createsQueueOps: boolean;
};

function nowIso() {
  return new Date().toISOString();
}

function createUuid() {
  const id = globalThis.crypto?.randomUUID?.();
  if (!id) throw new Error("SANITARY_ENTRY_HISTORY_UUID_UNAVAILABLE");
  return id;
}

function resolveConfiguredSync(
  input: CreateSanitaryEntryHistoryV2Input,
): CreateSanitaryEntryHistoryV2Input["sync"] | null {
  if (input.sync) return input.sync;
  if (typeof localStorage === "undefined") return null;
  let projectRef: string;
  try {
    projectRef = new URL(env.supabaseUrl).hostname.split(".")[0] ?? "";
  } catch {
    return null;
  }
  if (!projectRef || !isSanitarioV2PushEnabled(projectRef)) return null;
  const clientStorageKey = "gestao_agro_client_id";
  const existingClientId = localStorage.getItem(clientStorageKey);
  const clientId =
    input.clientId ?? existingClientId ?? `browser:${createUuid()}`;
  if (!existingClientId) localStorage.setItem(clientStorageKey, clientId);
  return { clientId, projectRef };
}

function validateEvidence(input: CreateSanitaryEntryHistoryV2Input) {
  const reference = input.evidenceReference?.trim() || null;
  const defaultCoveredFields: SanitaryEntryHistoryEvidenceFieldV2[] =
    input.source === "external_documented" ? ["protocol_item_completion"] : [];
  const coveredFields = Array.from(
    new Set(input.evidenceCoveredFields ?? defaultCoveredFields),
  );
  if (
    coveredFields.some(
      (field) => !SANITARY_ENTRY_HISTORY_EVIDENCE_FIELDS_V2.includes(field),
    )
  ) {
    throw new Error("SANITARY_ENTRY_HISTORY_EVIDENCE_COVERAGE_INVALID");
  }
  if (input.source === "external_documented") {
    if (input.evidenceClass !== "documented" || !reference) {
      throw new Error("SANITARY_ENTRY_HISTORY_DOCUMENT_REFERENCE_REQUIRED");
    }
    if (coveredFields.length === 0) {
      throw new Error("SANITARY_ENTRY_HISTORY_EVIDENCE_COVERAGE_REQUIRED");
    }
  }
  if (
    input.source === "external_declared" &&
    (input.evidenceClass !== "declared" || coveredFields.length > 0)
  ) {
    throw new Error("SANITARY_ENTRY_HISTORY_DECLARATION_INVALID");
  }
  return { reference, coveredFields };
}

function resolveProtocolAndItem(input: {
  catalog: SanitaryProtocolCatalogReadModelV2;
  protocolId: string;
  itemId: string;
}): {
  protocol: SanitaryProtocolV2ReadModel;
  item: SanitaryProtocolItemV2ReadModel;
} {
  const protocol = input.catalog.protocols.find(
    (entry) => entry.id === input.protocolId,
  );
  const item = input.catalog.items.find(
    (entry) =>
      entry.id === input.itemId && entry.protocolId === input.protocolId,
  );
  if (!protocol || !item) {
    throw new Error("SANITARY_ENTRY_HISTORY_PROTOCOL_ITEM_NOT_FOUND");
  }
  return { protocol, item };
}

function mapActionTypeToSanitaryType(actionType: string): SanitarioTipoEnum {
  if (actionType === "vermifugacao") return "vermifugacao";
  if (
    actionType === "medicamento" ||
    actionType === "tratamento" ||
    actionType === "exame"
  ) {
    return "medicamento";
  }
  return "vacinacao";
}

export async function createSanitaryEntryHistoryV2(
  input: CreateSanitaryEntryHistoryV2Input,
): Promise<CreateSanitaryEntryHistoryV2Result> {
  const { protocol, item } = resolveProtocolAndItem(input);
  const evidence = validateEvidence(input);
  const sync = resolveConfiguredSync(input);
  const timestamp = nowIso();
  const eventId = createUuid();
  const relationId = createUuid();
  const identity = createSanitarioV2Identity();
  const clientId = sync?.clientId ?? input.clientId ?? "local";
  const occurredAt = input.occurredOn
    ? `${input.occurredOn}T12:00:00.000Z`
    : timestamp;
  const productClass = input.productClass?.trim() || item.productClass || null;
  const protocolSnapshot = {
    id: protocol.id,
    family_code: protocol.familyCode,
    name: protocol.name,
    version: protocol.version,
  };
  const protocolItemSnapshot = {
    id: item.id,
    protocol_id: protocol.id,
    logical_item_key: item.logicalItemKey,
    version: item.version,
    action_type: item.actionType,
    product_requirement_kind: item.productRequirementKind,
    product_class: productClass,
    product_class_group_id: item.productClassGroupId,
  };
  const payload = {
    schema: "sanitary_entry_history_v2",
    entry_history_source: input.source,
    evidence_class: input.evidenceClass,
    evidence_type: input.evidenceType,
    evidence_reference: evidence.reference,
    evidence_covered_fields: evidence.coveredFields,
    external_origin: input.externalOrigin?.trim() || null,
    date_approximate: input.dateApproximate || !input.occurredOn,
    execution_date_known: Boolean(input.occurredOn),
    creates_local_execution: false,
    creates_stock_movement: false,
    creates_active_withdrawal: false,
    creates_agenda: false,
    protocol_id: protocol.id,
    family_code: protocol.familyCode,
    item_key: item.logicalItemKey,
    product_class: productClass,
    protocol_snapshot: protocolSnapshot,
    protocol_item_snapshot: protocolItemSnapshot,
  };

  const event: Evento = {
    id: eventId,
    fazenda_id: input.fazendaId,
    dominio: "sanitario",
    occurred_at: occurredAt,
    occurred_on: input.occurredOn ?? undefined,
    animal_id: input.animalId,
    lote_id: null,
    source_task_id: null,
    source_tx_id: identity.clientTxId,
    source_client_op_id: identity.clientOpId,
    corrige_evento_id: null,
    sanitario_caso_id: null,
    observacoes:
      input.notes?.trim() || "Histórico sanitário anterior à entrada.",
    payload,
    source_sanitario_agenda_v2_id: null,
    sanitario_sync_v2_nature: "standalone_fact",
    sanitario_contract_version: SANITARIO_V2_CONTRACT_VERSION,
    domain_op_id: identity.domainOpId,
    client_id: clientId,
    client_op_id: identity.clientOpId,
    client_tx_id: identity.clientTxId,
    client_recorded_at: timestamp,
    server_received_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
  };

  const detail: EventoSanitario = {
    evento_id: eventId,
    fazenda_id: input.fazendaId,
    tipo: mapActionTypeToSanitaryType(item.actionType),
    produto: "Produto não informado no histórico anterior",
    produto_veterinario_id: null,
    produto_nome_snapshot: null,
    estoque_lote_id: null,
    estoque_lote_codigo_snapshot: null,
    lote_fabricante: null,
    validade_produto: null,
    dose_quantidade: null,
    dose_unidade: null,
    via_aplicacao: null,
    responsavel_nome: null,
    responsavel_tipo: null,
    carencia_carne_dias: null,
    carencia_leite_dias: null,
    carencia_carne_ate: null,
    carencia_leite_ate: null,
    custo_unitario_snapshot: null,
    custo_total_snapshot: null,
    protocol_item_version_id: item.id,
    protocol_item_logical_key: item.logicalItemKey,
    protocol_item_version: item.version,
    protocol_item_snapshot: protocolItemSnapshot,
    produto_sanitario_v2_id: null,
    insumo_id: null,
    produto_snapshot: {
      product_class: productClass,
      product_class_group_id: item.productClassGroupId,
      evidence_covered_fields: evidence.coveredFields,
    },
    sanitario_contract_version: SANITARIO_V2_CONTRACT_VERSION,
    domain_op_id: identity.domainOpId,
    payload,
    client_id: clientId,
    client_op_id: identity.clientOpId,
    client_tx_id: identity.clientTxId,
    client_recorded_at: timestamp,
    server_received_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
  };

  const eventAnimal: EventoAnimalLocalV2 = {
    id: relationId,
    fazenda_id: input.fazendaId,
    evento_id: eventId,
    animal_id: input.animalId,
    created_at: timestamp,
  };

  const operation = buildApplyFactualCoreOperation(identity, event, detail, [
    eventAnimal,
  ]);

  if (sync) {
    await persistSanitarioV2FactualCore({
      fazendaId: input.fazendaId,
      clientId: sync.clientId,
      projectRef: sync.projectRef,
      event,
      detail,
      eventAnimal,
      operation,
    });
  } else {
    await db.transaction(
      "rw",
      [db.event_eventos, db.event_eventos_sanitario, db.event_eventos_animais],
      async () => {
        await db.event_eventos.add(event);
        await db.event_eventos_sanitario.add(detail);
        await db.event_eventos_animais.add(eventAnimal);
      },
    );
  }

  return {
    eventId,
    createsAgenda: false,
    createsStockMovement: false,
    createsActiveWithdrawal: false,
    createsQueueOps: Boolean(sync),
  };
}
