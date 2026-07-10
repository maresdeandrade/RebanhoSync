import { resolveAnimalClassificationSnapshot } from "@/lib/animals/classificationSnapshot";
import { db } from "@/lib/offline/db";
import type {
  Animal,
  AnimalStatusEnum,
  Lote,
  SanitarioAgendaAnimalLocalV2,
  SanitarioAgendaLocalV2,
  SexoEnum,
} from "@/lib/offline/types";
import {
  formatSanitaryProtocolItemLabelV2,
  readLocalSanitaryProtocolCatalogV2,
  type SanitaryProtocolCatalogReadModelV2,
  type SanitaryProtocolItemV2ReadModel,
  type SanitaryProtocolV2ReadModel,
} from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";
import {
  precheckSanitaryProtocolsForAnimalV2,
  type SanitaryExecutedHistoryV2,
  type SanitaryProtocolPrecheckResultV2,
} from "@/lib/sanitario/checks/sanitaryProtocolPrecheckV2";
import type { SanitaryEligibilityStatus } from "@/lib/sanitario/eligibility/sanitaryEligibility";
import { getLotSanitaryExecutedHistoryV2 } from "@/lib/sanitario/history/sanitaryExecutedHistoryV2";
import {
  createManualSanitaryAgendaV2,
  type ManualSanitaryAgendaResultV2,
} from "@/lib/sanitario/agenda/sanitaryManualAgendaV2";

export type SanitaryProtocolWindowSourceV2 = {
  catalog: SanitaryProtocolCatalogReadModelV2;
  animals: Animal[];
  lots: Lote[];
  executedHistory: SanitaryExecutedHistoryV2[];
  agendas: SanitarioAgendaLocalV2[];
  agendaAnimals: SanitarioAgendaAnimalLocalV2[];
};

export type SanitaryOperationalContextV2 = {
  rabiesRiskArea: boolean | null;
  sanitaryCadence: "annual" | "semiannual" | null;
  reproductiveContext: "prepartum" | "peripartum" | null;
  management:
    | "pre_weaning"
    | "rearing"
    | "pre_feedlot"
    | "deferred_pasture"
    | null;
};

export const EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2: SanitaryOperationalContextV2 = {
  rabiesRiskArea: null,
  sanitaryCadence: null,
  reproductiveContext: null,
  management: null,
};

export type SanitaryProtocolWindowFiltersV2 = {
  lotId: string;
  animalId: string;
  category: string;
  sex: SexoEnum | "todos";
  animalStatus: AnimalStatusEnum | "todos";
  eligibilityStatus: SanitaryEligibilityStatus | "todos";
};

export type SanitaryProtocolWindowRowV2 = {
  animalId: string;
  identification: string;
  animalHref: string;
  lotId: string | null;
  lotLabel: string;
  lotHref: string | null;
  sex: SexoEnum;
  sexLabel: string;
  ageLabel: string;
  category: string;
  categoryLabel: string;
  protocolId: string;
  protocolLabel: string;
  itemId: string;
  itemKey: string;
  itemLabel: string;
  status: SanitaryEligibilityStatus;
  reason: string;
  warnings: string[];
  blockers: string[];
  documentaryPending: boolean;
  documentaryPendingReasons: string[];
  alreadyPlanned: boolean;
  plannedFor: string | null;
  canSelect: boolean;
  precheck: SanitaryProtocolPrecheckResultV2;
};

export type SanitaryProtocolWindowResultV2 = {
  protocol: SanitaryProtocolV2ReadModel;
  item: SanitaryProtocolItemV2ReadModel;
  evaluatedAt: string;
  rows: SanitaryProtocolWindowRowV2[];
};

const PLANNABLE_STATUSES = new Set<SanitaryEligibilityStatus>([
  "in_action_window",
  "near_deadline",
  "eligible_soon",
  "overdue",
]);

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(source: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function dateKey(value: string) {
  return /^(\d{4}-\d{2}-\d{2})/.exec(value)?.[1] ?? value;
}

function formatAge(birthDate: string | null, referenceDate: string) {
  if (!birthDate) return "Não informada";
  const birth = new Date(`${dateKey(birthDate)}T00:00:00.000Z`);
  const reference = new Date(`${dateKey(referenceDate)}T00:00:00.000Z`);
  if (!Number.isFinite(birth.getTime()) || !Number.isFinite(reference.getTime())) {
    return "Não informada";
  }
  const days = Math.floor((reference.getTime() - birth.getTime()) / 86_400_000);
  if (days < 0) return "Data inválida";
  if (days < 60) return `${days} dia${days === 1 ? "" : "s"}`;
  const months = Math.floor(days / 30.4375);
  if (months < 24) return `${months} meses`;
  const years = Math.floor(months / 12);
  return `${years} ano${years === 1 ? "" : "s"}`;
}

function agendaItemKey(agenda: SanitarioAgendaLocalV2) {
  return (
    readString(agenda.metadata, "itemKey") ??
    readString(agenda.protocol_item_snapshot, "itemKey", "logicalItemKey")
  );
}

function buildActiveAgendaIndex(source: SanitaryProtocolWindowSourceV2) {
  const animalIdsByAgenda = new Map<string, string[]>();
  for (const entry of source.agendaAnimals) {
    const current = animalIdsByAgenda.get(entry.agenda_id) ?? [];
    current.push(entry.animal_id);
    animalIdsByAgenda.set(entry.agenda_id, current);
  }
  const animalsByLot = new Map<string, string[]>();
  for (const animal of source.animals) {
    if (!animal.lote_id) continue;
    const current = animalsByLot.get(animal.lote_id) ?? [];
    current.push(animal.id);
    animalsByLot.set(animal.lote_id, current);
  }

  const index = new Map<string, string>();
  for (const agenda of source.agendas) {
    if (
      agenda.deleted_at ||
      agenda.status !== "programada" ||
      agenda.execution_evento_id
    ) {
      continue;
    }
    const itemKey = agendaItemKey(agenda);
    if (!agenda.protocolo_id || !itemKey) continue;
    const animalIds = animalIdsByAgenda.get(agenda.id)?.length
      ? animalIdsByAgenda.get(agenda.id)!
      : agenda.lote_id
        ? (animalsByLot.get(agenda.lote_id) ?? [])
        : [];
    for (const animalId of animalIds) {
      index.set(
        `${animalId}|${agenda.protocolo_id}|${itemKey}`,
        agenda.data_programada,
      );
    }
  }
  return index;
}

export function buildSanitaryProtocolWindowV2(input: {
  source: SanitaryProtocolWindowSourceV2;
  protocolId: string;
  itemId: string;
  evaluatedAt: string;
  operationalContext?: SanitaryOperationalContextV2;
  filters?: Partial<SanitaryProtocolWindowFiltersV2>;
}): SanitaryProtocolWindowResultV2 | null {
  const protocol = input.source.catalog.protocols.find(
    (entry) => entry.id === input.protocolId,
  );
  const item = input.source.catalog.items.find(
    (entry) => entry.id === input.itemId && entry.protocolId === input.protocolId,
  );
  if (!protocol || !item) return null;

  const filters: SanitaryProtocolWindowFiltersV2 = {
    lotId: input.filters?.lotId ?? "todos",
    animalId: input.filters?.animalId ?? "todos",
    category: input.filters?.category ?? "todas",
    sex: input.filters?.sex ?? "todos",
    animalStatus: input.filters?.animalStatus ?? "ativo",
    eligibilityStatus: input.filters?.eligibilityStatus ?? "todos",
  };
  const lotsById = new Map(input.source.lots.map((lot) => [lot.id, lot]));
  const activeAgendas = buildActiveAgendaIndex(input.source);
  const operationalContext =
    input.operationalContext ?? EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2;
  const historyByAnimal = new Map(
    input.source.executedHistory.map((entry) => [entry.animalId, entry]),
  );

  const rows = input.source.animals
    .filter((animal) => !animal.deleted_at)
    .map((animal): SanitaryProtocolWindowRowV2 | null => {
      const classification = resolveAnimalClassificationSnapshot(animal, {
        referenceDate: input.evaluatedAt,
      });
      const result = precheckSanitaryProtocolsForAnimalV2({
        scope: "animal",
        animal: {
          id: animal.id,
          especie: animal.especie,
          sexo: animal.sexo,
          nascimento: animal.data_nascimento,
          categoria: classification.categoriaZootecnica,
          fazendaId: animal.fazenda_id,
          riskArea: operationalContext.rabiesRiskArea ?? undefined,
          sanitaryCadence: operationalContext.sanitaryCadence,
          pregnancyOrPeripartumContext:
            operationalContext.reproductiveContext === "prepartum" ||
            operationalContext.reproductiveContext === "peripartum"
              ? true
              : null,
          managementContext: operationalContext.management,
        },
        catalog: input.source.catalog,
        executedHistory: historyByAnimal.has(animal.id)
          ? [historyByAnimal.get(animal.id)!]
          : [],
        today: input.evaluatedAt,
      }).results.find((entry) => entry.itemKey === item.logicalItemKey);
      if (!result) return null;

      const plannedFor = activeAgendas.get(
        `${animal.id}|${protocol.id}|${item.logicalItemKey}`,
      );
      const itemBlocked =
        result.blockers.length > 0 ||
        protocol.status === "retired" ||
        protocol.legalStatus === "bloqueado" ||
        item.itemStatus === "bloqueado" ||
        item.status === "retired" ||
        item.status === "blocked";
      const category = classification.categoriaZootecnica;
      const row: SanitaryProtocolWindowRowV2 = {
        animalId: animal.id,
        identification: animal.nome?.trim() || animal.identificacao,
        animalHref: `/animais/${animal.id}`,
        lotId: animal.lote_id,
        lotLabel: animal.lote_id
          ? (lotsById.get(animal.lote_id)?.nome ?? "Lote não encontrado")
          : "Sem lote",
        lotHref: animal.lote_id ? `/lotes/${animal.lote_id}` : null,
        sex: animal.sexo,
        sexLabel: animal.sexo === "F" ? "Fêmea" : "Macho",
        ageLabel: formatAge(animal.data_nascimento, input.evaluatedAt),
        category,
        categoryLabel: classification.display.categoriaZootecnica,
        protocolId: protocol.id,
        protocolLabel: protocol.name,
        itemId: item.id,
        itemKey: item.logicalItemKey,
        itemLabel: formatSanitaryProtocolItemLabelV2(item.logicalItemKey),
        status: result.status,
        reason: result.reasons[0] ?? "Sem motivo adicional informado.",
        warnings: result.warnings,
        blockers: result.blockers,
        documentaryPending: result.documentaryPending,
        documentaryPendingReasons: result.documentaryPendingReasons,
        alreadyPlanned: Boolean(plannedFor),
        plannedFor: plannedFor ?? null,
        canSelect:
          PLANNABLE_STATUSES.has(result.status) &&
          !itemBlocked &&
          !result.missingExecutedHistory &&
          !result.documentaryPending &&
          !plannedFor,
        precheck: result,
      };
      return row;
    })
    .filter((row): row is SanitaryProtocolWindowRowV2 => row !== null)
    .filter((row) => filters.animalId === "todos" || row.animalId === filters.animalId)
    .filter((row) => filters.lotId === "todos" || row.lotId === filters.lotId)
    .filter((row) => filters.category === "todas" || row.category === filters.category)
    .filter((row) => filters.sex === "todos" || row.sex === filters.sex)
    .filter((row) => {
      const animal = input.source.animals.find((entry) => entry.id === row.animalId);
      return filters.animalStatus === "todos" || animal?.status === filters.animalStatus;
    })
    .filter(
      (row) =>
        filters.eligibilityStatus === "todos" ||
        row.status === filters.eligibilityStatus,
    )
    .sort((left, right) => left.identification.localeCompare(right.identification, "pt-BR"));

  return { protocol, item, evaluatedAt: input.evaluatedAt, rows };
}

export type SanitaryDocumentaryPendencyV2 = {
  animalId: string;
  animalLabel: string;
  animalHref: string;
  lotLabel: string;
  protocolLabel: string;
  itemLabel: string;
  reasons: string[];
};

export function listSanitaryDocumentaryPendenciesV2(input: {
  source: SanitaryProtocolWindowSourceV2 | undefined;
  evaluatedAt: string;
}): SanitaryDocumentaryPendencyV2[] {
  if (!input.source) return [];
  const rows = input.source.catalog.items
    .map((item) => {
      const protocol = input.source!.catalog.protocols.find(
        (entry) => entry.id === item.protocolId,
      );
      if (!protocol) return [];
      return (
        buildSanitaryProtocolWindowV2({
          source: input.source!,
          protocolId: protocol.id,
          itemId: item.id,
          evaluatedAt: input.evaluatedAt,
          filters: { animalStatus: "ativo" },
        })?.rows ?? []
      );
    })
    .flat()
    .filter((row) => row.documentaryPending);

  const byAnimalAndItem = new Map<string, SanitaryDocumentaryPendencyV2>();
  for (const row of rows) {
    const key = `${row.animalId}:${row.protocolId}:${row.itemKey}`;
    byAnimalAndItem.set(key, {
      animalId: row.animalId,
      animalLabel: row.identification,
      animalHref: row.animalHref,
      lotLabel: row.lotLabel,
      protocolLabel: row.protocolLabel,
      itemLabel: row.itemLabel,
      reasons: row.documentaryPendingReasons.length
        ? row.documentaryPendingReasons
        : [row.reason],
    });
  }

  return Array.from(byAnimalAndItem.values()).sort((left, right) =>
    left.animalLabel.localeCompare(right.animalLabel, "pt-BR"),
  );
}

export async function loadSanitaryProtocolWindowSourceV2(
  fazendaId: string,
): Promise<SanitaryProtocolWindowSourceV2> {
  const [catalog, animals, lots, agendas, agendaAnimals] = await Promise.all([
    readLocalSanitaryProtocolCatalogV2(),
    db.state_animais.where("fazenda_id").equals(fazendaId).toArray(),
    db.state_lotes.where("fazenda_id").equals(fazendaId).toArray(),
    db.ops_sanitario_agenda_v2.where("fazenda_id").equals(fazendaId).toArray(),
    db.ops_sanitario_agenda_animais_v2
      .where("fazenda_id")
      .equals(fazendaId)
      .toArray(),
  ]);
  const executedHistory = await getLotSanitaryExecutedHistoryV2({
    fazendaId,
    loteId: "central-sanitaria",
    animalIds: animals.filter((animal) => !animal.deleted_at).map((animal) => animal.id),
    catalog,
  });
  return { catalog, animals, lots, agendas, agendaAnimals, executedHistory };
}

function clientOperationId() {
  const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `sanitary-window-${suffix}`;
}

export async function createGroupedManualSanitaryAgendasV2(input: {
  rows: SanitaryProtocolWindowRowV2[];
  fazendaId: string;
  plannedFor: string;
  operationalContext?: SanitaryOperationalContextV2;
  createdBy?: string;
}): Promise<ManualSanitaryAgendaResultV2[]> {
  const eligibleRows = input.rows.filter((row) => row.canSelect);
  const groups = new Map<string, SanitaryProtocolWindowRowV2[]>();
  for (const row of eligibleRows) {
    const key = row.lotId ? `lot:${row.lotId}` : `animal:${row.animalId}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const results: ManualSanitaryAgendaResultV2[] = [];
  for (const rows of groups.values()) {
    const first = rows[0];
    const target = first.lotId
      ? {
          scope: "lote" as const,
          id: first.lotId,
          fazendaId: input.fazendaId,
          animalIds: rows.map((row) => row.animalId),
        }
      : {
          scope: "animal" as const,
          id: first.animalId,
          fazendaId: input.fazendaId,
        };
    results.push(
      await createManualSanitaryAgendaV2({
        target,
        source: {
          kind: "sanitary_precheck_preview_v2",
          protocolId: first.protocolId,
          familyCode: first.precheck.familyCode,
          itemKey: first.itemKey,
          itemLabel: first.itemLabel,
          protocolName: first.protocolLabel,
          precheckStatus: first.status,
          reasons: Array.from(new Set(rows.flatMap((row) => row.precheck.reasons))),
          blockers: [],
          warnings: Array.from(new Set(rows.flatMap((row) => row.warnings))),
          productRequirementKind: first.precheck.productRequirementKind,
          productClass: first.precheck.productClass,
          productClassGroupId: first.precheck.productClassGroupId,
          productClassGroupName: first.precheck.productClassGroupName,
          operationalContext:
            input.operationalContext ?? EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2,
        },
        plannedFor: input.plannedFor,
        createdBy: input.createdBy,
        clientOpId: clientOperationId(),
        confirmed: true,
      }),
    );
  }
  return results;
}
