import { db } from "@/lib/offline/db";
import type { Evento, EventoComercial } from "@/lib/offline/types";
import { isCommercialSimulation } from "@/lib/finance/classification";

export async function loadAnimalCommercialHistory(
  farmId: string,
  animalId: string,
) {
  const directEvents = await db.event_eventos
    .where("animal_id")
    .equals(animalId)
    .filter(
      (event) =>
        event.fazenda_id === farmId &&
        event.dominio === "comercial" &&
        !event.deleted_at,
    )
    .primaryKeys();
  const directIds = new Set(directEvents);
  const details = await db.event_eventos_comercial
    .where("fazenda_id")
    .equals(farmId)
    .filter(
      (detail) =>
        !detail.deleted_at &&
        (directIds.has(detail.evento_id) ||
          Boolean(detail.animal_ids?.includes(animalId))),
    )
    .toArray();
  const rows = await Promise.all(
    details.map(async (detail) => {
      const event = await db.event_eventos.get(detail.evento_id);
      return event &&
        event.fazenda_id === farmId &&
        event.dominio === "comercial" &&
        !event.deleted_at &&
        !isCommercialSimulation(event, detail)
        ? detail
        : null;
    }),
  );
  return rows
    .filter((row): row is EventoComercial => row !== null)
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function matchingRow(value: unknown, key: string, animalId: string) {
  if (!Array.isArray(value)) return null;
  const rows = value.map(asRecord).filter((row) => row?.[key] === animalId);
  return rows.length === 1 ? rows[0] : null;
}

function declaredNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function firstDeclaredNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const number = declaredNumber(value);
    if (number !== null) return number;
  }
  return null;
}

function isIndividualCommercialDetail(
  detail: EventoComercial,
  animalId: string,
  parentAnimalId?: string | null,
) {
  return detail.quantidade_animais === 1 &&
    ((detail.animal_ids?.length === 1 && detail.animal_ids[0] === animalId) ||
      (!detail.animal_ids?.length && detail.scope === "animal" && parentAnimalId === animalId));
}

/** Projeção do snapshot, sem converter unidades nem inferir peso atual. */
export function projectAnimalCommercialValues(
  detail: EventoComercial,
  animalId: string,
  parentAnimalId?: string | null,
): { weight: number | null; weightUnit: "kg" | "@"; value: number | null } {
  const snapshot = asRecord(detail.snapshot);
  const pricing = asRecord(snapshot?.pricing);
  const line = matchingRow(pricing?.lines, "animal_id", animalId);
  const animal = matchingRow(snapshot?.animals, "id", animalId);
  const values = asRecord(snapshot?.valor_por_animal);
  const individual = isIndividualCommercialDetail(detail, animalId, parentAnimalId);
  const directWeight = declaredNumber(line?.commercial_weight);
  return {
    weight: firstDeclaredNumber(
      directWeight,
      line?.weight_considered_kg,
      animal?.weight_considered_kg,
      animal?.peso_kg,
      individual ? detail.peso_vivo_total : null,
    ),
    weightUnit:
      directWeight !== null &&
      (line?.commercial_weight_unit ?? pricing?.weight_unit) === "arroba"
        ? "@"
        : "kg",
    value: firstDeclaredNumber(
      line?.individual_gross_value,
      animal?.valor_individual,
      values?.[animalId],
      individual ? detail.valor_bruto : null,
    ),
  };
}

export interface AnimalAcquisitionFact {
  eventId: string;
  animalId: string;
  fazendaId: string;
  origin: "compra" | "sociedade";
  occurredAt: string;
  weight: number | null;
  weightUnit: "kg" | "@";
  weightBasis: "carcass_weight" | "live_weight_yield" | null;
  value: number | null;
  societyId: string | null;
}

/** Compra factual é a fonte de aquisição; venda nunca vira entrada. */
export function projectPurchaseAcquisition(
  detail: EventoComercial,
  animalId: string,
  parentAnimalId?: string | null,
): AnimalAcquisitionFact | null {
  if (
    detail.operation_type !== "compra" ||
    isCommercialSimulation({ payload: {} } as Evento, detail)
  )
    return null;
  const individual = projectAnimalCommercialValues(
    detail,
    animalId,
    parentAnimalId,
  );
  const snapshot = asRecord(detail.snapshot);
  const pricing = asRecord(snapshot?.pricing);
  const line = matchingRow(pricing?.lines, "animal_id", animalId);
  const basis = line?.arroba_basis ?? pricing?.arroba_basis;
  return {
    eventId: detail.evento_id,
    animalId,
    fazendaId: detail.fazenda_id,
    origin: "compra",
    occurredAt: detail.occurred_at,
    weight: individual.weight,
    weightUnit: individual.weightUnit,
    weightBasis:
      basis === "carcass_weight" || basis === "live_weight_yield"
        ? basis
        : null,
    value: individual.value,
    societyId: null,
  };
}

/** Fontes existentes: compra e pesagem marcada como entrada em sociedade. */
export async function loadAnimalAcquisitionHistory(
  farmId: string,
  animalId: string,
): Promise<AnimalAcquisitionFact[]> {
  const commercial = await loadAnimalCommercialHistory(farmId, animalId);
  const purchases = await Promise.all(
    commercial.map(async (detail) => {
      const event = await db.event_eventos.get(detail.evento_id);
      return projectPurchaseAcquisition(detail, animalId, event?.animal_id);
    }),
  );
  const entryEvents = await db.event_eventos
    .where("animal_id")
    .equals(animalId)
    .filter(
      (event) =>
        event.fazenda_id === farmId &&
        event.dominio === "pesagem" &&
        !event.deleted_at &&
        event.payload?.tipo_acao === "entrada_sociedade" &&
        !isCommercialSimulation(event),
    )
    .toArray();
  const societyEntries = await Promise.all(
    entryEvents.map(async (event): Promise<AnimalAcquisitionFact> => {
      const detail = await db.event_eventos_pesagem.get(event.id);
      const weight =
        detail &&
        detail.fazenda_id === farmId &&
        !detail.deleted_at &&
        typeof detail.peso_kg === "number" &&
        Number.isFinite(detail.peso_kg) &&
        detail.peso_kg > 0
          ? detail.peso_kg
          : null;
      return {
        eventId: event.id,
        animalId,
        fazendaId: farmId,
        origin: "sociedade",
        occurredAt: event.occurred_at,
        weight,
        weightUnit: "kg",
        weightBasis: null,
        value: null,
        societyId:
          typeof event.payload?.sociedade_id === "string"
            ? event.payload.sociedade_id
            : null,
      };
    }),
  );
  return [
    ...purchases.filter((row): row is AnimalAcquisitionFact => row !== null),
    ...societyEntries,
  ].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}
