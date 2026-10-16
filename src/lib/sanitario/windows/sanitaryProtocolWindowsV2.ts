import Dexie from "dexie";
import type { SanitaryAgendaMaterializationCommand } from "../agenda/sanitaryAgendaMaterialization";
import { resolveAnimalClassificationSnapshot } from "@/lib/animals/classificationSnapshot";
import { db } from "@/lib/offline/db";
import { requireTenantSensitiveRead } from "@/lib/offline/localReadBoundary";
import type {
  Animal,
  AnimalStatusEnum,
  Evento,
  EventoSanitario,
  Lote,
  SanitarioAgendaAnimalLocalV2,
  SanitarioAgendaLocalV2,
  SexoEnum,
  SanitarioProdutoLocalV2,
  SanitarioProdutoEspecieAutorizacaoLocalV2,
  FazendaSanidadeConfig,
} from "@/lib/offline/types";
import {
  formatSanitaryProtocolItemLabelV2,
  readLocalSanitaryProtocolCatalogV2,
  type SanitaryProtocolCatalogReadModelV2,
  type SanitaryProtocolCatalogLocalDb,
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
  type ManualSanitaryAgendaLocalDbV2,
} from "@/lib/sanitario/agenda/sanitaryManualAgendaV2";

import {
  buildSanitaryWindowPlanningPreviewV2,
  sanitaryPlanningBlockersV2,
} from "@/lib/sanitario/preview/sanitaryWindowPlanningPreviewV2";
import {
  sanitaryPlanningKindV2,
  type SanitaryGenerationModeV2,
  type SanitaryPlanningKindV2,
} from "../agenda/sanitaryPlanningPolicyV2";
import { identifySanitaryMultiProtocolGroupsV2 } from "../preview/sanitaryMultiProtocolPlanningV2";
import { readSanitaryAutomationPlanV2, resolveSanitaryAutomationRuleV2 } from "../agenda/sanitaryAutomationPlanV2";
import { sanitaryAutomaticIdentityV2, suppressedSanitaryAutomaticIntentV2 } from "../agenda/sanitaryAutomaticIdentityV2";

export type SanitaryProtocolWindowSourceV2 = {
  fazendaId?: string;
  farmUf?: string | null;
  farmConfig?: FazendaSanidadeConfig;
  products?: SanitarioProdutoLocalV2[];
  productSpeciesAuthorizations?: SanitarioProdutoEspecieAutorizacaoLocalV2[];
  catalog: SanitaryProtocolCatalogReadModelV2;
  animals: Animal[];
  lots: Lote[];
  executedHistory: SanitaryExecutedHistoryV2[];
  executedEvents: SanitaryCentralExecutedEventV2[];
  agendas: SanitarioAgendaLocalV2[];
  agendaAnimals: SanitarioAgendaAnimalLocalV2[];
};

export type SanitaryCentralExecutedEventV2 = {
  eventId: string;
  executedAt: string;
  protocolLabel: string;
  itemLabel: string;
  animalLabel: string;
  animalCount: number;
  lotLabel: string;
  productLabel: string;
  doseLabel: string;
  routeLabel: string;
  responsibleLabel: string;
  originLabel: string;
  stockLabel: string;
  withdrawalLabel: string;
  recordType: "executed_event";
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

export const EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2: SanitaryOperationalContextV2 =
  {
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
  planningKind?: SanitaryPlanningKindV2;
  generationMode?: SanitaryGenerationModeV2;
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

function dateKey(value: string) {
  return /^(\d{4}-\d{2}-\d{2})/.exec(value)?.[1] ?? value;
}

function formatAge(birthDate: string | null, referenceDate: string) {
  if (!birthDate) return "Não informada";
  const birth = new Date(`${dateKey(birthDate)}T00:00:00.000Z`);
  const reference = new Date(`${dateKey(referenceDate)}T00:00:00.000Z`);
  if (
    !Number.isFinite(birth.getTime()) ||
    !Number.isFinite(reference.getTime())
  ) {
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

function resolveEventAnimalIds(event: Evento) {
  if (event.animal_id) return [event.animal_id];
  const sanitario = readRecord(event.payload.sanitario);
  return Array.from(
    new Set(
      readStringArray(
        event.payload.animal_ids,
        event.payload.target_animal_ids,
        sanitario.animal_ids,
        sanitario.target_animal_ids,
      ),
    ),
  );
}

function resolveCentralItem(input: {
  detail: EventoSanitario;
  catalog: SanitaryProtocolCatalogReadModelV2;
}) {
  const { detail, catalog } = input;
  if (detail.protocol_item_version_id) {
    const byId = catalog.items.find(
      (item) => item.id === detail.protocol_item_version_id,
    );
    if (byId) return byId;
  }
  const snapshot = readRecord(detail.protocol_item_snapshot);
  const key =
    detail.protocol_item_logical_key ??
    readString(
      snapshot,
      "logicalItemKey",
      "logical_item_key",
      "itemKey",
      "item_key",
    );
  return key
    ? (catalog.items.find((item) => item.logicalItemKey === key) ?? null)
    : null;
}

function buildCentralExecutedEvents(input: {
  events: Evento[];
  details: EventoSanitario[];
  animals: Animal[];
  lots: Lote[];
  catalog: SanitaryProtocolCatalogReadModelV2;
  fazendaId: string;
}): SanitaryCentralExecutedEventV2[] {
  const detailsByEventId = new Map(input.details.map((detail) => [detail.evento_id, detail]));
  const animalsById = new Map(input.animals.map((animal) => [animal.id, animal]));
  const lotsById = new Map(input.lots.map((lot) => [lot.id, lot]));
  const protocolsById = new Map(input.catalog.protocols.map((protocol) => [protocol.id, protocol]));

  return input.events
    .filter(
      (event) =>
        event.fazenda_id === input.fazendaId &&
        event.dominio === "sanitario" &&
        !event.deleted_at,
    )
    .map((event): SanitaryCentralExecutedEventV2 | null => {
      const detail = detailsByEventId.get(event.id);
      if (!detail || detail.deleted_at) return null;
      const item = resolveCentralItem({ detail, catalog: input.catalog });
      const protocol = item ? protocolsById.get(item.protocolId) : null;
      const animalIds = resolveEventAnimalIds(event);
      const firstAnimal = animalIds.length === 1 ? animalsById.get(animalIds[0]) : null;
      const lot = event.lote_id ? lotsById.get(event.lote_id) : null;
      const productPayload = readRecord(detail.payload.product);
      const doseLabel =
        detail.dose_quantidade && detail.dose_unidade
          ? `${detail.dose_quantidade} ${detail.dose_unidade}`
          : "Dose não informada";
      const withdrawalLabel =
        detail.carencia_carne_ate || detail.carencia_leite_ate
          ? "gerada"
          : readString(readRecord(detail.payload.withdrawal), "reason") === "missing_explicit_rule"
            ? "sem regra"
            : "não aplicável";

      return {
        eventId: event.id,
        executedAt: event.occurred_at,
        protocolLabel: protocol?.name ?? "Protocolo sanitário",
        itemLabel: item ? formatSanitaryProtocolItemLabelV2(item.logicalItemKey) : "Item sanitário",
        animalLabel:
          animalIds.length > 1
            ? `${animalIds.length} animais`
            : firstAnimal?.nome?.trim() || firstAnimal?.identificacao || "Animal não informado",
        animalCount: animalIds.length,
        lotLabel: lot?.nome ?? "Sem lote",
        productLabel:
          detail.produto_nome_snapshot ??
          detail.produto ??
          readString(productPayload, "productName") ??
          "Produto não informado",
        doseLabel,
        routeLabel: detail.via_aplicacao ?? "Via não informada",
        responsibleLabel: detail.responsavel_nome ?? "Responsável não informado",
        originLabel: event.source_task_id ? "agenda sanitária" : "histórico externo",
        stockLabel: detail.estoque_lote_id ? "com baixa" : "sem baixa",
        withdrawalLabel,
        recordType: "executed_event",
      };
    })
    .filter((event): event is SanitaryCentralExecutedEventV2 => event !== null)
    .sort((left, right) => right.executedAt.localeCompare(left.executedAt));
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

function itemVersionPlanningBlockers(source: SanitaryProtocolWindowSourceV2, item: SanitaryProtocolItemV2ReadModel, animal: Animal, evaluatedAt: string): string[] {
  const blockers: string[] = [];
  if (source.catalog.items.some((candidate) => candidate.protocolId === item.protocolId && candidate.logicalItemKey === item.logicalItemKey && candidate.status === "active" && candidate.version > item.version)) {
    blockers.push("Versão substituída por item ativo mais recente. Atualize a seleção.");
  }
  if (sanitaryPlanningKindV2(item) !== "aplicacao_esquema_definido") return blockers;
  if (!hasCommercialIdentity(source, item)) blockers.push("Produto comercial/formulação do esquema ainda sem identidade comprovada no catálogo.");
  if (!hasPlanningSpeciesAuthorization(source, item, animal, evaluatedAt)) blockers.push("Esquema exige autorização explícita do produto para a espécie, sexo e idade do animal.");
  return blockers;
}

function hasCommercialIdentity(source: SanitaryProtocolWindowSourceV2, item: SanitaryProtocolItemV2ReadModel) {
  return source.products?.some((product) => product.id === item.productId && product.status_curatorial === "ativo" && !product.deleted_at && !!product.nome_comercial && !!product.registro_numero && !!product.principio_ativo);
}

function hasPlanningSpeciesAuthorization(source: SanitaryProtocolWindowSourceV2, item: SanitaryProtocolItemV2ReadModel, animal: Animal, evaluatedAt: string) {
  return source.productSpeciesAuthorizations?.some((entry) => entry.product_id === item.productId && entry.species_code === animal.especie && !entry.deleted_at && ["SIM_BULA", "SIM_NORMA"].includes(entry.authorization_status) && entry.aptitude === "all" && compatiblePlanningSex(entry.sexo, animal.sexo) && compatiblePlanningAge(entry, animal, evaluatedAt));
}

function compatiblePlanningAge(entry: SanitarioProdutoEspecieAutorizacaoLocalV2, animal: Animal, evaluatedAt: string) {
  if (entry.idade_min_dias == null && entry.idade_max_dias == null) return true;
  const birth = new Date(animal.data_nascimento ?? "").getTime();
  const days = Math.floor((new Date(evaluatedAt).getTime() - birth) / 86_400_000);
  return Number.isFinite(days) && days >= (entry.idade_min_dias ?? 0) && days <= (entry.idade_max_dias ?? Infinity);
}

function compatiblePlanningSex(authorized: string | null, actual: SexoEnum) {
  if (!authorized) return true;
  return (actual === "F" ? ["F", "femea", "fêmea"] : ["M", "macho"]).includes(authorized);
}

function itemEvaluationCatalog(catalog: SanitaryProtocolCatalogReadModelV2, selected: SanitaryProtocolItemV2ReadModel) {
  return { ...catalog, items: catalog.items.filter((entry) =>
    entry.protocolId !== selected.protocolId || entry.logicalItemKey !== selected.logicalItemKey || entry.id === selected.id) };
}

export function buildSanitaryProtocolWindowV2(input: {
  source: SanitaryProtocolWindowSourceV2;
  protocolId: string;
  itemId: string;
  evaluatedAt: string;
  operationalContext?: SanitaryOperationalContextV2;
  generationMode?: SanitaryGenerationModeV2;
  filters?: Partial<SanitaryProtocolWindowFiltersV2>;
}): SanitaryProtocolWindowResultV2 | null {
  const protocol = input.source.catalog.protocols.find(
    (entry) => entry.id === input.protocolId,
  );
  const item = input.source.catalog.items.find(
    (entry) =>
      entry.id === input.itemId && entry.protocolId === input.protocolId,
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
          uf: input.source.farmUf,
          riskArea: operationalContext.rabiesRiskArea ?? undefined,
          sanitaryCadence: operationalContext.sanitaryCadence,
          pregnancyOrPeripartumContext:
            operationalContext.reproductiveContext === "prepartum" ||
            operationalContext.reproductiveContext === "peripartum"
              ? true
              : null,
          managementContext: operationalContext.management,
        },
        catalog: itemEvaluationCatalog(input.source.catalog, item),
        executedHistory: historyByAnimal.has(animal.id)
          ? [historyByAnimal.get(animal.id)!]
          : [],
        today: input.evaluatedAt,
      }).results.find(
        (entry) =>
          entry.protocolId === protocol.id &&
          entry.itemKey === item.logicalItemKey,
      );
      if (!result) return null;

      const plannedFor = activeAgendas.get(
        `${animal.id}|${protocol.id}|${item.logicalItemKey}`,
      );
      const planningBlockers = sanitaryPlanningBlockersV2(
        protocol,
        item,
        input.generationMode,
      );
      const planningKind = sanitaryPlanningKindV2(item);
      planningBlockers.push(...itemVersionPlanningBlockers(input.source, item, animal, input.evaluatedAt));
      const itemBlocked =
        result.blockers.length > 0 ||
        planningBlockers.length > 0 ||
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
        blockers: [...result.blockers, ...planningBlockers],
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
        planningKind,
        generationMode: input.generationMode ?? "manual",
      };
      return row;
    })
    .filter((row): row is SanitaryProtocolWindowRowV2 => row !== null)
    .filter(
      (row) =>
        filters.animalId === "todos" || row.animalId === filters.animalId,
    )
    .filter((row) => filters.lotId === "todos" || row.lotId === filters.lotId)
    .filter(
      (row) =>
        filters.category === "todas" || row.category === filters.category,
    )
    .filter((row) => filters.sex === "todos" || row.sex === filters.sex)
    .filter((row) => {
      const animal = input.source.animals.find(
        (entry) => entry.id === row.animalId,
      );
      return (
        filters.animalStatus === "todos" ||
        animal?.status === filters.animalStatus
      );
    })
    .filter(
      (row) =>
        filters.eligibilityStatus === "todos" ||
        row.status === filters.eligibilityStatus,
    )
    .sort((left, right) =>
      left.identification.localeCompare(right.identification, "pt-BR"),
    );

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
  // Preserve liveQuery's observation context across the external auth promise.
  await Dexie.Promise.resolve(requireTenantSensitiveRead());
  return readSanitaryProtocolWindowSourceV2(fazendaId);
}

async function readSanitaryProtocolWindowSourceV2(
  fazendaId: string,
): Promise<SanitaryProtocolWindowSourceV2> {
  const [
    allCatalog,
    animals,
    lots,
    agendas,
    agendaAnimals,
    farmConfig,
    products,
    productSpeciesAuthorizations,
  ] = await Promise.all([
    readLocalSanitaryProtocolCatalogV2(
      db as unknown as SanitaryProtocolCatalogLocalDb,
    ),
    db.state_animais.where("fazenda_id").equals(fazendaId).toArray(),
    db.state_lotes.where("fazenda_id").equals(fazendaId).toArray(),
    db.ops_sanitario_agenda_v2.where("fazenda_id").equals(fazendaId).toArray(),
    db.ops_sanitario_agenda_animais_v2
      .where("fazenda_id")
      .equals(fazendaId)
      .toArray(),
    db.state_fazenda_sanidade_config.get(fazendaId),
    db.catalog_sanitario_produtos_v2.toArray(),
    db.catalog_sanitario_produto_especie_autorizacao_v2.toArray(),
  ]);
  const protocols = allCatalog.protocols.filter((protocol) =>
    protocol.scope === "fazenda"
      ? protocol.fazendaId === fazendaId
      : protocol.fazendaId === null,
  );
  const protocolIds = new Set(protocols.map((protocol) => protocol.id));
  const catalog = {
    ...allCatalog,
    protocols,
    items: allCatalog.items.filter((item) => protocolIds.has(item.protocolId)),
    productClassGroups: allCatalog.productClassGroups.filter(
      (group) => group.fazendaId === null || group.fazendaId === fazendaId,
    ),
  };
  const events = await db.event_eventos
    .where("fazenda_id")
    .equals(fazendaId)
    .toArray();
  const details =
    events.length > 0
      ? await db.event_eventos_sanitario
          .where("evento_id")
          .anyOf(events.map((event) => event.id))
          .toArray()
      : [];
  const executedHistory = await getLotSanitaryExecutedHistoryV2({
    fazendaId,
    loteId: "central-sanitaria",
    animalIds: animals
      .filter((animal) => !animal.deleted_at)
      .map((animal) => animal.id),
    catalog,
  });
  const executedEvents = buildCentralExecutedEvents({
    events,
    details,
    animals,
    lots,
    catalog,
    fazendaId,
  });
  return {
    fazendaId,
    catalog,
    animals,
    lots,
    agendas,
    agendaAnimals,
    executedHistory,
    executedEvents,
    farmConfig,
    products,
    productSpeciesAuthorizations,
    farmUf: farmConfig?.deleted_at ? null : farmConfig?.uf,
  };
}

function clientOperationId() {
  const suffix =
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `sanitary-window-${suffix}`;
}

function rejectDuplicatePhysicalApplication(
  source: SanitaryProtocolWindowSourceV2,
  item: SanitaryProtocolItemV2ReadModel,
  rows: SanitaryProtocolWindowRowV2[],
  plannedFor: string,
  operationalContext?: SanitaryOperationalContextV2,
) {
  if (!item.productId) return;
  const candidates = source.catalog.items.filter(
    (candidate) =>
      candidate.productId === item.productId &&
      candidate.protocolId !== item.protocolId &&
      JSON.stringify(candidate.doseRule) === JSON.stringify(item.doseRule) &&
      JSON.stringify(candidate.routeRule) === JSON.stringify(item.routeRule) &&
      JSON.stringify(candidate.boosterRule) ===
        JSON.stringify(item.boosterRule),
  );
  const groups = identifySanitaryMultiProtocolGroupsV2({
    items: [item, ...candidates],
    products: source.products ?? [],
  });
  if (!groups.length) return;
  for (const row of rows) {
    for (const candidate of candidates) {
      const other = buildSanitaryProtocolWindowV2({
        source,
        protocolId: candidate.protocolId,
        itemId: candidate.id,
        evaluatedAt: plannedFor,
        operationalContext,
      });
      if (
        other?.rows.some(
          (entry) =>
            entry.animalId === row.animalId &&
            (entry.canSelect ||
              (entry.alreadyPlanned && entry.plannedFor === plannedFor)),
        )
      ) {
        throw new Error(groups[0].limitation);
      }
    }
  }
}

export function sanitaryPlanningApplicationExclusionV2(source: SanitaryProtocolWindowSourceV2, row: SanitaryProtocolWindowRowV2, plannedFor: string, context: SanitaryOperationalContextV2): string | null {
  const item = source.catalog.items.find((entry) => entry.id === row.itemId)!;
  try { rejectDuplicatePhysicalApplication(source, item, [row], plannedFor, context); return null; }
  catch (error) { return error instanceof Error ? error.message : "Revisar cobertura do produto."; }
}

type GroupedSanitaryPlanningInputV2 = {
  rows: SanitaryProtocolWindowRowV2[];
  fazendaId: string;
  plannedFor: string;
  confirmed?: boolean;
  operationalContext?: SanitaryOperationalContextV2;
  createdBy?: string;
  generationMode?: SanitaryGenerationModeV2;
  planRevision?: number;
};

function authorizeAutomaticPlanInput(input: GroupedSanitaryPlanningInputV2, source: SanitaryProtocolWindowSourceV2) {
  if (input.planRevision === undefined) return input;
  const plan = readSanitaryAutomationPlanV2(source.farmConfig);
  if (!plan?.enabled || plan.revision !== input.planRevision) throw new Error("Plano desativado ou alterado. Reavalie.");
  for (const row of input.rows) {
    const rule = plan.rules.find((entry) => entry.itemId === row.itemId && entry.protocolId === row.protocolId);
    if (!rule || !resolveSanitaryAutomationRuleV2(source.catalog, rule)) throw new Error("Regra fora do plano ou versão alterada.");
  }
  return { ...input, confirmed: true, generationMode: "automatic" as const, operationalContext: plan.context, createdBy: plan.confirmedBy };
}

function suppressedAutomaticRow(input: GroupedSanitaryPlanningInputV2, source: SanitaryProtocolWindowSourceV2, row: SanitaryProtocolWindowRowV2) {
  if (input.planRevision === undefined) return false;
  const identity = sanitaryAutomaticIdentityV2(source, row, input.plannedFor);
  return identity.completed || suppressedSanitaryAutomaticIntentV2(source, row, identity.key);
}

function existingAgendaForRow(
  source: SanitaryProtocolWindowSourceV2,
  row: SanitaryProtocolWindowRowV2,
) {
  return source.agendas.find(
    (entry) =>
      entry.status === "programada" &&
      !entry.deleted_at &&
      entry.protocolo_id === row.protocolId &&
      agendaItemKey(entry) === row.itemKey &&
      source.agendaAnimals.some(
        (animal) =>
          animal.agenda_id === entry.id && animal.animal_id === row.animalId,
      ),
  );
}

function assertFreshPlanningRow(row: SanitaryProtocolWindowRowV2, fresh: SanitaryProtocolWindowRowV2 | undefined): asserts fresh is SanitaryProtocolWindowRowV2 {
    if (!fresh || fresh.lotId !== row.lotId) {
      throw new Error(
        "Seleção desatualizada ou fora da fazenda. Atualize as sugestões.",
      );
    }
    if (row.planningKind && fresh.planningKind !== row.planningKind) {
      throw new Error(
        "Tipo de Agenda alterado. Selecione e confirme explicitamente o novo esquema.",
      );
    }
  }

function revalidatePlanningSelection(
  input: GroupedSanitaryPlanningInputV2,
  source: SanitaryProtocolWindowSourceV2,
) {
  const selected: SanitaryProtocolWindowRowV2[] = [];
  const reused = new Map<string, ManualSanitaryAgendaResultV2>();
  for (const row of input.rows) {
    const fresh = buildSanitaryProtocolWindowV2({
      source,
      protocolId: row.protocolId,
      itemId: row.itemId,
      evaluatedAt: input.plannedFor,
      operationalContext: input.operationalContext,
      generationMode: input.generationMode,
    })?.rows.find((entry) => entry.animalId === row.animalId);
    assertFreshPlanningRow(row, fresh);
    if (suppressedAutomaticRow(input, source, fresh)) continue;
    if (fresh.alreadyPlanned) {
      const agenda = existingAgendaForRow(source, row);
      if (agenda)
        reused.set(agenda.id, {
          agendaId: agenda.id,
          clientOpId: agenda.client_op_id,
          status: "scheduled",
          created: false,
          createsEvent: false,
          createsStockMovement: false,
          createsActiveWithdrawal: false,
        });
      continue;
    }
    if (!fresh.canSelect || fresh.status === "eligible_soon") {
      throw new Error(
        "Data ou elegibilidade não permite o planejamento. Revise contexto, aprovação e janela do animal.",
      );
    }
    selected.push(fresh);
  }
  return { selected, reused };
}

function planningTargets(input: GroupedSanitaryPlanningInputV2, rows: SanitaryProtocolWindowRowV2[], command: SanitaryAgendaMaterializationCommand) {
  const first = rows[0];
  if (input.planRevision !== undefined) return rows.map((row) => ({ scope: "animal" as const, id: row.animalId, fazendaId: input.fazendaId }));
  const target = first.lotId
    ? {
        scope: "lote" as const,
        id: first.lotId,
        fazendaId: input.fazendaId,
        animalIds: command.animalIds,
      }
    : command.animalIds.length === 1
      ? {
          scope: "animal" as const,
          id: first.animalId,
          fazendaId: input.fazendaId,
        }
      : null;
  // Animals without a lot are separate targets; never invent a lot identity.
  return target
    ? [target]
    : rows.map((row) => ({
        scope: "animal" as const,
        id: row.animalId,
        fazendaId: input.fazendaId,
      }));
 }

function automaticAgendaIdentity(input: GroupedSanitaryPlanningInputV2, source: SanitaryProtocolWindowSourceV2, row: SanitaryProtocolWindowRowV2) {
  if (input.planRevision === undefined) return { metadata: {}, clientOpId: clientOperationId() };
  const identity = sanitaryAutomaticIdentityV2(source, row, input.plannedFor);
  return { metadata: { automationKey: identity.key, automationWindowKey: identity.windowKey, automationPlanRevision: input.planRevision, planningDedupKey: identity.key }, clientOpId: identity.key };
}

async function persistPlanningCommand(
  input: GroupedSanitaryPlanningInputV2,
  source: SanitaryProtocolWindowSourceV2,
  selected: SanitaryProtocolWindowRowV2[],
  command: SanitaryAgendaMaterializationCommand,
) {
  const results: ManualSanitaryAgendaResultV2[] = [];
  const rows = selected.filter(
    (row) =>
      row.protocolId === command.protocolRuleId &&
      row.itemId === command.protocolItemId &&
      command.animalIds.includes(row.animalId),
  );
  const first = rows[0];
  const item = source.catalog.items.find((entry) => entry.id === first.itemId)!;
  rejectDuplicatePhysicalApplication(
    source,
    item,
    rows,
    input.plannedFor,
    input.operationalContext,
  );
  const targets = planningTargets(input, rows, command);
  for (const agendaTarget of targets) {
    const identity = automaticAgendaIdentity(input, source, rows.find((row) => row.animalId === agendaTarget.id) ?? first);
    results.push(
      await createManualSanitaryAgendaV2(
        {
          target: agendaTarget,
          source: {
            kind: "sanitary_precheck_preview_v2",
            protocolId: first.protocolId,
            protocolItemVersionId: first.itemId,
            actionType: item.actionType,
            plannedProductId: item.productId,
            planningKind: first.planningKind,
            generationMode: input.generationMode ?? "manual",
            planningEvidence: {
              itemVersion: item.version,
              sourceRefsByField: item.sourceRefsByField,
              operationalWindowRule: item.operationalWindowRule,
            },
            planningDedupKey: `${input.fazendaId}|${command.dedupKey}|target:${agendaTarget.id}`,
            ...identity.metadata,
            familyCode: first.precheck.familyCode,
            itemKey: first.itemKey,
            itemLabel:
              first.planningKind === "avaliacao_manejo_generica"
                ? `Avaliar ${first.protocolLabel}`
                : first.itemLabel,
            protocolName: first.protocolLabel,
            precheckStatus: first.status,
            reasons: [...new Set(rows.flatMap((row) => row.precheck.reasons))],
            blockers: [],
            warnings: [...new Set(rows.flatMap((row) => row.warnings))],
            productRequirementKind: item.productRequirementKind,
            productClass: item.productClass,
            productClassGroupId: item.productClassGroupId,
            productClassGroupName: first.precheck.productClassGroupName,
            operationalContext:
              input.operationalContext ?? EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2,
          },
          plannedFor: command.scheduledDate,
          createdBy: input.createdBy,
          clientOpId: identity.clientOpId,
          confirmed: input.confirmed,
        },
        db as unknown as ManualSanitaryAgendaLocalDbV2,
      ),
    );
  }
  return results;
}

export async function createGroupedManualSanitaryAgendasV2(
  input: GroupedSanitaryPlanningInputV2,
): Promise<ManualSanitaryAgendaResultV2[]> {
  if (!input.confirmed && input.planRevision === undefined)
    throw new Error("Revise e confirme o planejamento antes de salvar.");
  if (!input.fazendaId || !input.rows.length)
    throw new Error("Selecione fazenda e animais.");
  await requireTenantSensitiveRead();
  // Re-read and validate under the same IndexedDB write lock as persistence.
  // This serializes overlapping submissions, including different browser tabs.
  return db.transaction(
    "rw",
    [
      db.ops_sanitario_agenda_v2,
      db.ops_sanitario_agenda_animais_v2,
      db.state_animais,
      db.state_lotes,
      db.state_fazenda_sanidade_config,
      db.catalog_sanitario_protocolos_v2,
      db.catalog_sanitario_protocolo_itens_versions_v2,
      db.catalog_sanitario_product_class_groups_v2,
      db.event_eventos,
      db.catalog_sanitario_produtos_v2,
      db.catalog_sanitario_produto_especie_autorizacao_v2,
      db.event_eventos_sanitario,
      db.event_eventos_animais,
    ],
    async () => {
      const source = await readSanitaryProtocolWindowSourceV2(input.fazendaId);
      const authorizedInput = authorizeAutomaticPlanInput(input, source);
      const { selected, reused } = revalidatePlanningSelection(authorizedInput, source);
      const materialization = buildSanitaryWindowPlanningPreviewV2({
        rows: selected,
        plannedFor: input.plannedFor,
      });
      if (materialization.rejected.length)
        throw new Error("Data planejada inválida. Revise as sugestões.");
      const results = [...reused.values()];
      for (const command of materialization.commands) {
        results.push(
          ...(await persistPlanningCommand(authorizedInput, source, selected, command)),
        );
      }
      return results;
    },
  );
}
