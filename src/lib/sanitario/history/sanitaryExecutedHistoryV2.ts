import { db } from "@/lib/offline/db";
import type { Evento, EventoSanitario } from "@/lib/offline/types";
import type { SanitaryProtocolCatalogReadModelV2 } from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";
import type {
  SanitaryExecutedHistoryEventV2,
  SanitaryExecutedHistoryV2,
} from "@/lib/sanitario/checks/sanitaryProtocolPrecheckV2";

type BuildSanitaryExecutedHistoryV2Input = {
  events: Evento[];
  sanitaryDetails: EventoSanitario[];
  catalog: SanitaryProtocolCatalogReadModelV2;
  fazendaId: string;
  allowedAnimalIds?: string[];
};

type ReadSanitaryExecutedHistoryV2Input = {
  fazendaId: string;
  catalog: SanitaryProtocolCatalogReadModelV2;
};

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function readStringArray(...values: unknown[]): string[] {
  for (const value of values) {
    if (Array.isArray(value)) {
      return value.filter(
        (entry): entry is string =>
          typeof entry === "string" && entry.trim().length > 0,
      );
    }
  }
  return [];
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function resolveTargetAnimalIds(event: Evento): string[] {
  if (event.animal_id) return [event.animal_id];
  return Array.from(
    new Set(
      readStringArray(
        event.payload.animal_ids,
        event.payload.target_animal_ids,
        readRecord(event.payload.sanitario).animal_ids,
        readRecord(event.payload.sanitario).target_animal_ids,
      ),
    ),
  );
}

function resolveWithdrawalStatus(detail: EventoSanitario) {
  if (detail.carencia_carne_ate || detail.carencia_leite_ate) return "generated";
  const withdrawal = readRecord(detail.payload.withdrawal);
  return readString(withdrawal.reason) === "missing_explicit_rule"
    ? "without_rule"
    : "not_applicable";
}

function resolveCatalogItem(input: {
  detail: EventoSanitario;
  catalog: SanitaryProtocolCatalogReadModelV2;
}) {
  const { detail, catalog } = input;
  const itemByVersionId = detail.protocol_item_version_id
    ? catalog.items.find((item) => item.id === detail.protocol_item_version_id)
    : null;
  if (itemByVersionId) return itemByVersionId;

  const snapshot = readRecord(detail.protocol_item_snapshot);
  const payloadSnapshot = readRecord(detail.payload.protocol_item_snapshot);
  const itemKey = readString(
    snapshot.itemKey,
    snapshot.item_key,
    snapshot.logicalItemKey,
    snapshot.logical_item_key,
    snapshot.itemCode,
    snapshot.item_code,
    payloadSnapshot.itemKey,
    payloadSnapshot.item_key,
    payloadSnapshot.logicalItemKey,
    payloadSnapshot.logical_item_key,
    payloadSnapshot.itemCode,
    payloadSnapshot.item_code,
    detail.payload.protocol_item_code,
    detail.protocol_item_logical_key,
  );
  if (!itemKey) return null;

  const protocolId = readString(
    snapshot.protocolId,
    snapshot.protocol_id,
    payloadSnapshot.protocolId,
    payloadSnapshot.protocol_id,
  );
  const familyCode = readString(
    snapshot.familyCode,
    snapshot.family_code,
    payloadSnapshot.familyCode,
    payloadSnapshot.family_code,
  );
  const protocolsById = new Map(
    catalog.protocols.map((protocol) => [protocol.id, protocol]),
  );
  const candidates = catalog.items.filter((item) => {
    if (item.logicalItemKey !== itemKey) return false;
    if (protocolId && item.protocolId !== protocolId) return false;
    if (
      familyCode &&
      protocolsById.get(item.protocolId)?.familyCode !== familyCode
    ) {
      return false;
    }
    return true;
  });

  return candidates.length === 1 ? candidates[0] : null;
}

export function buildSanitaryExecutedHistoryV2(
  input: BuildSanitaryExecutedHistoryV2Input,
): SanitaryExecutedHistoryV2[] {
  const allowedAnimalIds = input.allowedAnimalIds
    ? new Set(input.allowedAnimalIds)
    : null;
  const detailsByEventId = new Map(
    input.sanitaryDetails
      .filter(
        (detail) =>
          detail.fazenda_id === input.fazendaId && !detail.deleted_at,
      )
      .map((detail) => [detail.evento_id, detail]),
  );
  const protocolsById = new Map(
    input.catalog.protocols.map((protocol) => [protocol.id, protocol]),
  );
  const historyByAnimal = new Map<string, SanitaryExecutedHistoryEventV2[]>();

  for (const event of input.events) {
    if (
      event.fazenda_id !== input.fazendaId ||
      event.dominio !== "sanitario" ||
      event.deleted_at
    ) {
      continue;
    }
    const detail = detailsByEventId.get(event.id);
    if (!detail) continue;
    const item = resolveCatalogItem({ detail, catalog: input.catalog });
    if (!item) continue;
    const protocol = protocolsById.get(item.protocolId);
    if (!protocol) continue;

    const targetAnimalIds = resolveTargetAnimalIds(event).filter(
      (animalId) => !allowedAnimalIds || allowedAnimalIds.has(animalId),
    );
    for (const animalId of targetAnimalIds) {
      const historyEvent: SanitaryExecutedHistoryEventV2 = {
        eventId: event.id,
        protocolId: protocol.id,
        familyCode: protocol.familyCode,
        itemKey: item.logicalItemKey,
        productClass: item.productClass,
        productId: detail.produto_veterinario_id ?? null,
        productName:
          detail.produto_nome_snapshot ??
          detail.produto ??
          readString(readRecord(detail.payload.product).productName),
        doseQuantity: detail.dose_quantidade ?? null,
        doseUnit: detail.dose_unidade ?? null,
        route: detail.via_aplicacao ?? null,
        responsibleName: detail.responsavel_nome ?? null,
        stockStatus: detail.estoque_lote_id ? "with_movement" : "without_movement",
        withdrawalStatus: resolveWithdrawalStatus(detail),
        originLabel: event.source_task_id ? "agenda sanitária" : null,
        executedAt: event.occurred_at,
        source:
          readString(
            detail.payload.entry_history_source,
            detail.payload.history_source,
            event.payload.entry_history_source,
            event.payload.history_source,
          ) === "external_documented"
            ? "external_documented"
            : readString(
                  detail.payload.entry_history_source,
                  detail.payload.history_source,
                  event.payload.entry_history_source,
                  event.payload.history_source,
                ) === "external_declared"
              ? "external_declared"
              : readString(
                    detail.payload.entry_history_source,
                    detail.payload.history_source,
                    event.payload.entry_history_source,
                    event.payload.history_source,
                  ) === "legacy_import"
                ? "legacy_import"
                : "event",
        evidenceClass:
          readString(
            detail.payload.evidence_class,
            event.payload.evidence_class,
          ) === "documented"
            ? "documented"
            : readString(
                  detail.payload.evidence_class,
                  event.payload.evidence_class,
                ) === "declared"
              ? "declared"
              : readString(
                    detail.payload.evidence_class,
                    event.payload.evidence_class,
                ) === "unknown"
                ? "unknown"
                : undefined,
        evidenceReference: readString(
          detail.payload.evidence_reference,
          detail.payload.evidence_document_id,
          event.payload.evidence_reference,
          event.payload.evidence_document_id,
        ),
        dateApproximate:
          readBoolean(detail.payload.date_approximate) ??
          readBoolean(event.payload.date_approximate),
      };
      historyByAnimal.set(animalId, [
        ...(historyByAnimal.get(animalId) ?? []),
        historyEvent,
      ]);
    }
  }

  return Array.from(historyByAnimal.entries())
    .map(([animalId, events]) => ({
      animalId,
      events: events.sort((left, right) =>
        right.executedAt.localeCompare(left.executedAt),
      ),
    }))
    .sort((left, right) => left.animalId.localeCompare(right.animalId));
}

async function readSanitaryEventSource(fazendaId: string) {
  const events = await db.event_eventos
    .where("fazenda_id")
    .equals(fazendaId)
    .filter((event) => event.dominio === "sanitario" && !event.deleted_at)
    .toArray();
  if (events.length === 0) return { events, sanitaryDetails: [] };
  const sanitaryDetails = await db.event_eventos_sanitario
    .where("evento_id")
    .anyOf(events.map((event) => event.id))
    .filter((detail) => !detail.deleted_at)
    .toArray();
  return { events, sanitaryDetails };
}

export async function getAnimalSanitaryExecutedHistoryV2(
  input: ReadSanitaryExecutedHistoryV2Input & { animalId: string },
): Promise<SanitaryExecutedHistoryV2[]> {
  const source = await readSanitaryEventSource(input.fazendaId);
  return buildSanitaryExecutedHistoryV2({
    ...source,
    catalog: input.catalog,
    fazendaId: input.fazendaId,
    allowedAnimalIds: [input.animalId],
  });
}

export async function getLotSanitaryExecutedHistoryV2(
  input: ReadSanitaryExecutedHistoryV2Input & {
    loteId: string;
    animalIds: string[];
  },
): Promise<SanitaryExecutedHistoryV2[]> {
  const source = await readSanitaryEventSource(input.fazendaId);
  const allowedAnimalIds = new Set(input.animalIds);
  const lotEvents = source.events.filter(
    (event) =>
      event.lote_id === input.loteId ||
      (event.animal_id !== null && allowedAnimalIds.has(event.animal_id)) ||
      resolveTargetAnimalIds(event).some((animalId) =>
        allowedAnimalIds.has(animalId),
      ),
  );
  return buildSanitaryExecutedHistoryV2({
    events: lotEvents,
    sanitaryDetails: source.sanitaryDetails,
    catalog: input.catalog,
    fazendaId: input.fazendaId,
    allowedAnimalIds: input.animalIds,
  });
}
