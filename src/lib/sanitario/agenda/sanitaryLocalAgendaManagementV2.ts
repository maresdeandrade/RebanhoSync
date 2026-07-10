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
  plannedFor: string;
  status: SanitarioAgendaV2Status;
  protocolLabel: string;
  itemLabel: string;
  target: SanitaryAgendaTargetV2;
  canManage: boolean;
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
    const lot = lots.get(lotId);
    return {
      kind: "lote",
      label: lot?.nome.trim() || "Lote não encontrado",
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

      return {
        id: agenda.id,
        plannedFor: agenda.data_programada,
        status: agenda.status,
        protocolLabel,
        itemLabel,
        target: targetForAgenda(agenda, entries, animalsById, lotsById),
        canManage: agenda.status === "programada" && !hasExecution,
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
  await db.transaction(
    "rw",
    [db.ops_sanitario_agenda_v2, db.ops_sanitario_agenda_animais_v2],
    async () => {
      await assertAgendaCanBeManaged(db, input.agendaId, input.fazendaId);
      await db.ops_sanitario_agenda_v2.update(input.agendaId, { status: "cancelada" });
    },
  );
}
