import type { OfflineDB } from "@/lib/offline/db";
import type {
  Animal,
  Lote,
  SanitarioAgendaAnimalLocalV2,
  SanitarioAgendaLocalV2,
  SanitarioAgendaV2Status,
} from "@/lib/offline/types";

export type SanitaryAgendaTargetV2 = {
  kind: "animal" | "lote" | "nao_identificado";
  label: string;
  href: string | null;
};

export type SanitaryLocalAgendaListItemV2 = {
  id: string;
  fazendaId: string;
  plannedFor: string;
  status: SanitarioAgendaV2Status;
  protocolId: string | null;
  itemKey: string | null;
  protocolLabel: string;
  itemLabel: string;
  productRequirementKind: string;
  productClass: string | null;
  productClassLabel: string | null;
  productClassGroupId: string | null;
  productClassGroupName: string | null;
  plannedProductId: string | null;
  plannedProductName: string | null;
  suggestedDose: number | null;
  suggestedDoseUnit: string | null;
  suggestedRoute: string | null;
  animalCount: number;
  target: SanitaryAgendaTargetV2;
  canManage: boolean;
  canExecute: boolean;
};

export type SanitaryLocalAgendaFiltersV2 = {
  search: string;
  status: SanitarioAgendaV2Status | "todas";
  startDate: string;
  endDate: string;
};

type LocalAgendaDbV2 = Pick<
  OfflineDB,
  | "ops_sanitario_agenda_v2"
  | "ops_sanitario_agenda_animais_v2"
  | "state_animais"
  | "state_lotes"
  | "transaction"
>;

function readText(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function formatSanitaryProductClassLabelV2(value: string | null | undefined) {
  if (!value) return null;
  const known: Record<string, string> = {
    vacina_ibr_bvd: "Vacina IBR/BVD",
    vacina_clostridial: "Vacina clostridial",
    vacina_brucelose_b19: "Vacina Brucelose B19",
    vacina_raiva_herbivoros: "Vacina contra raiva dos herbívoros",
  };
  if (known[value]) return known[value];
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toLocaleUpperCase("pt-BR"));
}

function metadataTarget(agenda: SanitarioAgendaLocalV2) {
  const target = agenda.metadata.target;
  if (!target || typeof target !== "object") return null;

  const record = target as Record<string, unknown>;
  const scope = record.scope;
  const id = record.id;
  if ((scope !== "animal" && scope !== "lote") || typeof id !== "string") {
    return null;
  }

  return { scope, id };
}

function animalLabel(animal: Animal | undefined) {
  if (!animal) return "Animal não encontrado";
  return animal.nome?.trim() || animal.identificacao.trim() || "Animal sem identificação";
}

function targetForAgenda(
  agenda: SanitarioAgendaLocalV2,
  agendaAnimals: SanitarioAgendaAnimalLocalV2[],
  animals: Map<string, Animal>,
  lots: Map<string, Lote>,
): SanitaryAgendaTargetV2 {
  const target = metadataTarget(agenda);
  const lotId = agenda.lote_id ?? (target?.scope === "lote" ? target.id : null);

  if (lotId) {
    const animalIds = Array.from(new Set(agendaAnimals.map((entry) => entry.animal_id)));
    if (animalIds.length === 1) {
      return {
        kind: "animal",
        label: animalLabel(animals.get(animalIds[0])),
        href: `/animais/${animalIds[0]}`,
      };
    }
    if (animalIds.length > 1) {
      return {
        kind: "animal",
        label: `${animalIds.length} animais`,
        href: null,
      };
    }
    const lot = lots.get(lotId);
    return {
      kind: "lote",
      label:
        readText(agenda.metadata, "targetAnimalScope") === "lote_sem_animais_explicitos"
          ? "Lote inteiro"
          : lot?.nome.trim() || "Lote não encontrado",
      href: `/lotes/${lotId}`,
    };
  }

  const animalIds = Array.from(
    new Set([
      ...agendaAnimals.map((entry) => entry.animal_id),
      ...(target?.scope === "animal" ? [target.id] : []),
    ]),
  );

  if (animalIds.length === 1) {
    return {
      kind: "animal",
      label: animalLabel(animals.get(animalIds[0])),
      href: `/animais/${animalIds[0]}`,
    };
  }

  if (animalIds.length > 1) {
    return {
      kind: "animal",
      label: `${animalIds.length} animais`,
      href: null,
    };
  }

  return { kind: "nao_identificado", label: "Origem não identificada", href: null };
}

async function getDefaultDb(): Promise<LocalAgendaDbV2> {
  const { db } = await import("@/lib/offline/db");
  return db;
}

export async function listLocalSanitaryAgendasV2(
  fazendaId: string,
  localDb?: LocalAgendaDbV2,
): Promise<SanitaryLocalAgendaListItemV2[]> {
  const db = localDb ?? (await getDefaultDb());
  const [agendas, agendaAnimals, animals, lots] = await Promise.all([
    db.ops_sanitario_agenda_v2.where("fazenda_id").equals(fazendaId).toArray(),
    db.ops_sanitario_agenda_animais_v2.where("fazenda_id").equals(fazendaId).toArray(),
    db.state_animais.where("fazenda_id").equals(fazendaId).toArray(),
    db.state_lotes.where("fazenda_id").equals(fazendaId).toArray(),
  ]);
  const activeAgendas = agendas.filter((agenda) => !agenda.deleted_at);
  const animalsById = new Map(animals.filter((animal) => !animal.deleted_at).map((animal) => [animal.id, animal]));
  const lotsById = new Map(lots.filter((lot) => !lot.deleted_at).map((lot) => [lot.id, lot]));
  const agendaAnimalsById = new Map<string, SanitarioAgendaAnimalLocalV2[]>();

  for (const entry of agendaAnimals) {
    const current = agendaAnimalsById.get(entry.agenda_id) ?? [];
    current.push(entry);
    agendaAnimalsById.set(entry.agenda_id, current);
  }

  return activeAgendas
    .map((agenda) => {
      const entries = agendaAnimalsById.get(agenda.id) ?? [];
      const protocolLabel =
        readText(agenda.metadata, "protocolName") ??
        readText(agenda.protocol_item_snapshot, "protocolName") ??
        "Protocolo sanitário";
      const itemLabel =
        readText(agenda.metadata, "itemLabel") ??
        readText(agenda.protocol_item_snapshot, "itemLabel") ??
        "Item sanitário";
      const hasExecution =
        Boolean(agenda.execution_evento_id) ||
        entries.some(
          (entry) =>
            entry.planned_status === "executado" || Boolean(entry.execution_evento_id),
        );
      const productRequirementKind =
        readText(agenda.metadata, "productRequirementKind") ??
        readText(agenda.protocol_item_snapshot, "productRequirementKind") ??
        readText(agenda.protocol_item_snapshot, "product_requirement_kind") ??
        "none";
      const productClass =
        readText(agenda.metadata, "productClass") ??
        readText(agenda.protocol_item_snapshot, "productClass") ??
        readText(agenda.protocol_item_snapshot, "product_class");
      const productClassGroupId =
        readText(agenda.metadata, "productClassGroupId") ??
        readText(agenda.protocol_item_snapshot, "productClassGroupId") ??
        readText(agenda.protocol_item_snapshot, "product_class_group_id");
      const productClassGroupName =
        readText(agenda.metadata, "productClassGroupName") ??
        readText(agenda.protocol_item_snapshot, "productClassGroupName");
      const plannedProductId =
        agenda.produto_veterinario_id ??
        readText(agenda.produto_snapshot, "productId") ??
        readText(agenda.produto_snapshot, "plannedProductId") ??
        readText(agenda.protocol_item_snapshot, "productId") ??
        readText(agenda.protocol_item_snapshot, "product_id");
      const plannedProductName =
        readText(agenda.produto_snapshot, "productName") ??
        readText(agenda.produto_snapshot, "nomeComercial") ??
        readText(agenda.produto_snapshot, "nome_comercial") ??
        readText(agenda.metadata, "productName");
      const suggestedDose =
        readNumber(agenda.metadata, "dose") ??
        readNumber(agenda.protocol_item_snapshot, "dose") ??
        readNumber(agenda.protocol_item_snapshot, "dose_quantity");
      const suggestedDoseUnit =
        readText(agenda.metadata, "doseUnit") ??
        readText(agenda.protocol_item_snapshot, "doseUnit") ??
        readText(agenda.protocol_item_snapshot, "dose_unit");
      const suggestedRoute =
        readText(agenda.metadata, "route") ??
        readText(agenda.protocol_item_snapshot, "route") ??
        readText(agenda.protocol_item_snapshot, "routeRule");

      return {
        id: agenda.id,
        fazendaId: agenda.fazenda_id,
        plannedFor: agenda.data_programada,
        status: agenda.status,
        protocolId: agenda.protocolo_id,
        itemKey:
          readText(agenda.metadata, "itemKey") ??
          readText(agenda.protocol_item_snapshot, "itemKey") ??
          readText(agenda.protocol_item_snapshot, "logicalItemKey") ??
          readText(agenda.protocol_item_snapshot, "logical_item_key"),
        protocolLabel,
        itemLabel,
        productRequirementKind,
        productClass,
        productClassLabel: formatSanitaryProductClassLabelV2(productClass),
        productClassGroupId,
        productClassGroupName,
        plannedProductId,
        plannedProductName,
        suggestedDose,
        suggestedDoseUnit,
        suggestedRoute,
        animalCount: Math.max(entries.length, 1),
        target: targetForAgenda(agenda, entries, animalsById, lotsById),
        canManage: agenda.status === "programada" && !hasExecution,
        canExecute: agenda.status === "programada" && !hasExecution,
      };
    })
    .sort((left, right) => left.plannedFor.localeCompare(right.plannedFor));
}

export function filterLocalSanitaryAgendasV2(
  items: SanitaryLocalAgendaListItemV2[],
  filters: SanitaryLocalAgendaFiltersV2,
) {
  const search = filters.search.trim().toLocaleLowerCase("pt-BR");

  return items.filter((item) => {
    if (filters.status !== "todas" && item.status !== filters.status) return false;
    if (filters.startDate && item.plannedFor < filters.startDate) return false;
    if (filters.endDate && item.plannedFor > filters.endDate) return false;
    if (!search) return true;

    return [item.protocolLabel, item.itemLabel, item.target.label]
      .join(" ")
      .toLocaleLowerCase("pt-BR")
      .includes(search);
  });
}

async function assertAgendaCanBeManaged(
  db: LocalAgendaDbV2,
  agendaId: string,
  fazendaId: string,
) {
  const agenda = await db.ops_sanitario_agenda_v2.get(agendaId);
  if (!agenda || agenda.fazenda_id !== fazendaId || agenda.deleted_at) {
    throw new Error("AGENDA_SANITARIA_NAO_ENCONTRADA");
  }

  const entries = await db.ops_sanitario_agenda_animais_v2
    .where("agenda_id")
    .equals(agendaId)
    .toArray();
  const hasExecution =
    Boolean(agenda.execution_evento_id) ||
    entries.some(
      (entry) =>
        entry.planned_status === "executado" || Boolean(entry.execution_evento_id),
    );

  if (agenda.status !== "programada" || hasExecution) {
    throw new Error("AGENDA_SANITARIA_NAO_GERENCIAVEL");
  }
}

export async function rescheduleLocalSanitaryAgendaV2(
  input: { agendaId: string; fazendaId: string; plannedFor: string },
  localDb?: LocalAgendaDbV2,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.plannedFor)) {
    throw new Error("DATA_PROGRAMADA_INVALIDA");
  }

  const db = localDb ?? (await getDefaultDb());
  await db.transaction(
    "rw",
    [db.ops_sanitario_agenda_v2, db.ops_sanitario_agenda_animais_v2],
    async () => {
      await assertAgendaCanBeManaged(db, input.agendaId, input.fazendaId);
      await db.ops_sanitario_agenda_v2.update(input.agendaId, {
        data_programada: input.plannedFor,
      });
    },
  );
}

export async function cancelLocalSanitaryAgendaV2(
  input: { agendaId: string; fazendaId: string },
  localDb?: LocalAgendaDbV2,
) {
  const db = localDb ?? (await getDefaultDb());
  const now = new Date().toISOString();
  await db.transaction(
    "rw",
    [db.ops_sanitario_agenda_v2, db.ops_sanitario_agenda_animais_v2],
    async () => {
      await assertAgendaCanBeManaged(db, input.agendaId, input.fazendaId);
      const current = await db.ops_sanitario_agenda_v2.get(input.agendaId);
      await db.ops_sanitario_agenda_v2.update(input.agendaId, {
        status: "cancelada",
        updated_at: now,
        metadata: {
          ...(current?.metadata ?? {}),
          cancellation: {
            status: "cancelled",
            cancelledAt: now,
          },
        },
      });
    },
  );
}
