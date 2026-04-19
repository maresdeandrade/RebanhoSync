import {
  compareAgendaGroupOrdering,
  getAgendaScheduleBucket,
  summarizeAgendaGroupOrdering,
} from "@/lib/agenda/groupOrdering";
import { buildAgendaEventGroupMeta } from "@/lib/agenda/grouping";
import {
  summarizeAgendaGroupByAnimal,
  summarizeAgendaGroupByEvent,
} from "@/lib/agenda/groupSummaries";
import { getGestureSyncStage } from "@/lib/offline/syncPresentation";
import type {
  AgendaItem,
  Animal,
  CatalogoProtocoloOficial,
  CatalogoProtocoloOficialItem,
  FazendaSanidadeConfig,
  Gesture,
  Lote,
  ProtocoloSanitario,
  ProtocoloSanitarioItem,
} from "@/lib/offline/types";
import { getSanitaryAgendaPriority } from "@/lib/sanitario/protocolRules";
import { resolveSanitaryAgendaItemScheduleMeta } from "@/lib/sanitario/agendaSchedule";
import {
  formatAnimalAge,
  readString,
} from "@/pages/Agenda/helpers/formatting";
import { matchesAnimalQuickFilter } from "@/pages/Agenda/helpers/quickFilters";
import type {
  AgendaAnimalGroup,
  AgendaCalendarAnchorQuickFilter,
  AgendaCalendarModeQuickFilter,
  AgendaEventGroup,
  AgendaRow,
  AgendaScheduleQuickFilter,
  AgendaStatusFilter,
  AnimalQuickFilter,
} from "@/pages/Agenda/types";

export type AgendaPageData = {
  itens: AgendaItem[];
  animais: Animal[];
  lotes: Lote[];
  protocolos: ProtocoloSanitario[];
  protocoloItens: ProtocoloSanitarioItem[];
  gestos: Gesture[];
  sanidadeConfig: FazendaSanidadeConfig | null;
  officialTemplates: CatalogoProtocoloOficial[];
  officialTemplateItems: CatalogoProtocoloOficialItem[];
};

export type AgendaBaseRowFilters = {
  search: string;
  statusFilter: AgendaStatusFilter;
  dominioFilter: string;
  dateFrom: string;
  dateTo: string;
};

export function buildAgendaBaseRows(
  data: AgendaPageData | undefined,
  filters: AgendaBaseRowFilters,
) {
  if (!data) return [];

  const animalById = new Map(data.animais.map((animal) => [animal.id, animal]));
  const loteById = new Map(data.lotes.map((lote) => [lote.id, lote]));
  const protocolById = new Map(data.protocolos.map((protocolo) => [protocolo.id, protocolo]));
  const protocolItemById = new Map(data.protocoloItens.map((item) => [item.id, item]));
  const gestoByTx = new Map(data.gestos.map((gesture) => [gesture.client_tx_id, gesture]));
  const searchLower = filters.search.trim().toLowerCase();

  return data.itens
    .map((item) => {
      const animal = item.animal_id ? animalById.get(item.animal_id) : null;
      const lote = item.lote_id ? loteById.get(item.lote_id) : null;
      const syncStage = getGestureSyncStage(
        item.client_tx_id ? gestoByTx.get(item.client_tx_id) ?? null : null,
      );

      const dateMatch =
        (!filters.dateFrom || item.data_prevista >= filters.dateFrom) &&
        (!filters.dateTo || item.data_prevista <= filters.dateTo);
      const statusMatch = filters.statusFilter === "all" || item.status === filters.statusFilter;
      const dominioMatch = filters.dominioFilter === "all" || item.dominio === filters.dominioFilter;

      const textIndex = [item.tipo, item.dominio, animal?.identificacao ?? "", lote?.nome ?? ""]
        .join(" ")
        .toLowerCase();
      const searchMatch = !searchLower || textIndex.includes(searchLower);

      if (!dateMatch || !statusMatch || !dominioMatch || !searchMatch) {
        return null;
      }

      const protocolId = readString(item.source_ref, "protocolo_id");

      return {
        item,
        animal,
        lote,
        protocol: protocolId ? protocolById.get(protocolId) ?? null : null,
        protocolItem: item.protocol_item_version_id
          ? protocolItemById.get(item.protocol_item_version_id) ?? null
          : null,
        animalNome: animal?.identificacao ?? "Sem animal",
        loteNome: lote?.nome ?? "Sem lote",
        syncStage,
      };
    })
    .filter(Boolean)
    .sort((left, right) => left!.item.data_prevista.localeCompare(right!.item.data_prevista))
    .map((row) => {
      const typed = row as NonNullable<typeof row>;
      const produtoLabel =
        readString(typed.item.source_ref, "produto") ??
        readString(typed.item.payload, "produto") ??
        typed.item.tipo.replaceAll("_", " ");
      const scheduleMeta = resolveSanitaryAgendaItemScheduleMeta(typed.item, typed.protocolItem);

      return {
        ...typed,
        idadeLabel: formatAnimalAge(typed.animal?.data_nascimento ?? null),
        produtoLabel,
        scheduleLabel: scheduleMeta?.label ?? null,
        scheduleMode: scheduleMeta?.mode ?? null,
        scheduleModeLabel: scheduleMeta?.modeLabel ?? null,
        scheduleAnchor: scheduleMeta?.anchor ?? null,
        scheduleAnchorLabel: scheduleMeta?.anchorLabel ?? null,
        priority:
          typed.item.dominio === "sanitario"
            ? getSanitaryAgendaPriority({
                item: typed.item,
                protocol: typed.protocol,
                protocolItem: typed.protocolItem,
              })
            : null,
      };
    }) as AgendaRow[];
}

export type AgendaQuickFilters = {
  quickTypeFilter: string;
  quickScheduleFilter: AgendaScheduleQuickFilter;
  quickCalendarModeFilter: AgendaCalendarModeQuickFilter;
  quickCalendarAnchorFilter: AgendaCalendarAnchorQuickFilter;
  quickAnimalFilter: AnimalQuickFilter;
};

export function applyAgendaQuickFilters(rows: AgendaRow[], filters: AgendaQuickFilters) {
  return rows.filter((row) => {
    const typeMatch = filters.quickTypeFilter === "all" || row.item.tipo === filters.quickTypeFilter;
    const scheduleMatch =
      filters.quickScheduleFilter === "all" ||
      getAgendaScheduleBucket(row.item) === filters.quickScheduleFilter;
    const calendarModeMatch =
      filters.quickCalendarModeFilter === "all" || row.scheduleMode === filters.quickCalendarModeFilter;
    const calendarAnchorMatch =
      filters.quickCalendarAnchorFilter === "all" ||
      row.scheduleAnchor === filters.quickCalendarAnchorFilter;
    const animalQuickMatch = matchesAnimalQuickFilter(row.item, row.animal, filters.quickAnimalFilter);

    return (
      typeMatch &&
      scheduleMatch &&
      calendarModeMatch &&
      calendarAnchorMatch &&
      animalQuickMatch
    );
  });
}

export function groupAgendaRowsByAnimal(input: {
  baseRows: AgendaRow[];
  filteredRows: AgendaRow[];
  hasQuickFiltersActive: boolean;
}) {
  const visibleRowIds = new Set(input.filteredRows.map((row) => row.item.id));
  const byAnimal = new Map<string, AgendaAnimalGroup>();

  for (const row of input.baseRows) {
    const key = row.item.animal_id ?? `sem-animal:${row.item.id}`;
    const animalIdShort = row.item.animal_id ? row.item.animal_id.slice(0, 8) : null;
    const title = row.animal?.identificacao ?? (animalIdShort ? `Animal ${animalIdShort}` : "Sem animal");

    const current = byAnimal.get(key);
    if (current) {
      current.rows.push(row);
      continue;
    }

    byAnimal.set(key, {
      key,
      title,
      rows: [row],
      visibleRows: [],
      animal: row.animal,
      summary: summarizeAgendaGroupByAnimal([row]),
      sortMeta: summarizeAgendaGroupOrdering([row]),
    });
  }

  return Array.from(byAnimal.values())
    .map((group) => ({
      ...group,
      rows: [...group.rows].sort((left, right) => left.item.data_prevista.localeCompare(right.item.data_prevista)),
      visibleRows: group.rows.filter((row) => visibleRowIds.has(row.item.id)),
      summary: summarizeAgendaGroupByAnimal(group.rows),
      sortMeta: summarizeAgendaGroupOrdering(
        input.hasQuickFiltersActive ? group.rows.filter((row) => visibleRowIds.has(row.item.id)) : group.rows,
      ),
    }))
    .filter((group) => group.visibleRows.length > 0)
    .sort(
      (left, right) =>
        compareAgendaGroupOrdering(left.sortMeta, right.sortMeta) || left.title.localeCompare(right.title),
    );
}

export function groupAgendaRowsByEvent(input: {
  baseRows: AgendaRow[];
  filteredRows: AgendaRow[];
  hasQuickFiltersActive: boolean;
}) {
  const visibleRowIds = new Set(input.filteredRows.map((row) => row.item.id));
  const byEvent = new Map<string, AgendaEventGroup>();

  for (const row of input.baseRows) {
    const meta = buildAgendaEventGroupMeta({
      item: row.item,
      produtoLabel: row.produtoLabel,
      protocol: row.protocol,
    });

    const current = byEvent.get(meta.key);
    if (current) {
      current.rows.push(row);
      if (row.item.data_prevista < current.earliestDate) {
        current.earliestDate = row.item.data_prevista;
      }
      continue;
    }

    byEvent.set(meta.key, {
      key: meta.key,
      title: meta.title,
      subtitle: meta.subtitle,
      rows: [row],
      visibleRows: [],
      earliestDate: row.item.data_prevista,
      summary: summarizeAgendaGroupByEvent([row]),
      sortMeta: summarizeAgendaGroupOrdering([row]),
    });
  }

  return Array.from(byEvent.values())
    .map((group) => ({
      ...group,
      rows: [...group.rows].sort((left, right) => left.item.data_prevista.localeCompare(right.item.data_prevista)),
      visibleRows: group.rows.filter((row) => visibleRowIds.has(row.item.id)),
      summary: summarizeAgendaGroupByEvent(group.rows),
      sortMeta: summarizeAgendaGroupOrdering(
        input.hasQuickFiltersActive ? group.rows.filter((row) => visibleRowIds.has(row.item.id)) : group.rows,
      ),
    }))
    .filter((group) => group.visibleRows.length > 0)
    .sort(
      (left, right) =>
        compareAgendaGroupOrdering(left.sortMeta, right.sortMeta) ||
        left.earliestDate.localeCompare(right.earliestDate),
    );
}

export function summarizeAgendaRowsByStatus(rows: AgendaRow[]) {
  let agendado = 0;
  let concluido = 0;
  let cancelado = 0;

  for (const row of rows) {
    if (row.item.status === "agendado") agendado++;
    if (row.item.status === "concluido") concluido++;
    if (row.item.status === "cancelado") cancelado++;
  }

  return { agendado, concluido, cancelado };
}

export function hasAgendaQuickFiltersActive(filters: AgendaQuickFilters) {
  return (
    filters.quickTypeFilter !== "all" ||
    filters.quickScheduleFilter !== "all" ||
    filters.quickCalendarModeFilter !== "all" ||
    filters.quickCalendarAnchorFilter !== "all" ||
    filters.quickAnimalFilter !== "all"
  );
}
