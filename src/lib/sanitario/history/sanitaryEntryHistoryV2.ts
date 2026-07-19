import { db } from "@/lib/offline/db";
import type { Evento, EventoSanitario, SanitarioTipoEnum } from "@/lib/offline/types";
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
  notes?: string | null;
  catalog: SanitaryProtocolCatalogReadModelV2;
  clientId?: string;
};

export type CreateSanitaryEntryHistoryV2Result = {
  eventId: string;
  createsAgenda: false;
  createsStockMovement: false;
  createsActiveWithdrawal: false;
  createsQueueOps: false;
};

function nowIso() {
  return new Date().toISOString();
}

function operationId(prefix: string) {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}-${suffix}`;
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
    (entry) => entry.id === input.itemId && entry.protocolId === input.protocolId,
  );
  if (!protocol || !item) {
    throw new Error("SANITARY_ENTRY_HISTORY_PROTOCOL_ITEM_NOT_FOUND");
  }
  return { protocol, item };
}

function mapActionTypeToSanitaryType(
  actionType: string,
): SanitarioTipoEnum {
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
  const timestamp = nowIso();
  const eventId = operationId("entry-history-event");
  const detailOpId = operationId("entry-history-detail");
  const occurredAt = input.occurredOn
    ? `${input.occurredOn}T12:00:00.000Z`
    : timestamp;
  const payload = {
    schema: "sanitary_entry_history_v2",
    entry_history_source: input.source,
    evidence_class: input.evidenceClass,
    evidence_type: input.evidenceType,
    evidence_reference: input.evidenceReference?.trim() || null,
    date_approximate: input.dateApproximate || !input.occurredOn,
    execution_date_known: Boolean(input.occurredOn),
    creates_local_execution: false,
    creates_stock_movement: false,
    creates_active_withdrawal: false,
    creates_agenda: false,
    protocol_id: protocol.id,
    family_code: protocol.familyCode,
    item_key: item.logicalItemKey,
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
    source_tx_id: null,
    source_client_op_id: null,
    corrige_evento_id: null,
    sanitario_caso_id: null,
    observacoes: input.notes?.trim() || "Histórico sanitário anterior à entrada.",
    payload,
    client_id: input.clientId ?? "local",
    client_op_id: operationId("entry-history-event-op"),
    client_tx_id: null,
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
    protocol_item_snapshot: {
      protocolId: protocol.id,
      familyCode: protocol.familyCode,
      protocolName: protocol.name,
      itemKey: item.logicalItemKey,
      source: input.source,
      evidenceClass: input.evidenceClass,
    },
    payload,
    client_id: input.clientId ?? "local",
    client_op_id: detailOpId,
    client_tx_id: null,
    client_recorded_at: timestamp,
    server_received_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
  };

  await db.transaction("rw", db.event_eventos, db.event_eventos_sanitario, async () => {
    await db.event_eventos.add(event);
    await db.event_eventos_sanitario.add(detail);
  });

  return {
    eventId,
    createsAgenda: false,
    createsStockMovement: false,
    createsActiveWithdrawal: false,
    createsQueueOps: false,
  };
}
