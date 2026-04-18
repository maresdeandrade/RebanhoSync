import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  ClipboardCheck,
  MoreHorizontal,
  Plus,
  Search,
  XCircle,
} from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/ui/metric-card";
import { PageIntro } from "@/components/ui/page-intro";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import { useAuth } from "@/hooks/useAuth";
import { buildAgendaBadgeOverflowLayout } from "@/lib/agenda/badgeOverflow";
import {
  buildAgendaCriticalNavigationTargets,
  getAdjacentAgendaCriticalNavigationTarget,
} from "@/lib/agenda/criticalNavigation";
import { buildAgendaEventGroupMeta } from "@/lib/agenda/grouping";
import { buildAgendaGroupRecommendation } from "@/lib/agenda/groupRecommendations";
import {
  getAgendaScheduleBucket,
  type AgendaScheduleBucket,
  compareAgendaGroupOrdering,
  summarizeAgendaGroupOrdering,
} from "@/lib/agenda/groupOrdering";
import {
  readAgendaUiState,
  writeAgendaUiState,
} from "@/lib/agenda/storage";
import {
  summarizeAgendaGroupByAnimal,
  summarizeAgendaGroupByEvent,
  type AgendaSummaryBadge,
} from "@/lib/agenda/groupSummaries";
import { getAnimalBreedLabel } from "@/lib/animals/catalogs";
import {
  getAnimalLifeStageLabel,
  getPendingAnimalLifecycleKindLabel,
  getPendingAnimalLifecycleTransitions,
  summarizePendingAnimalLifecycleTransitions,
} from "@/lib/animals/lifecycle";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import { pullDataForFarm } from "@/lib/offline/pull";
import {
  getGestureSyncStage,
  getSyncStageLabel,
  getSyncStageTone,
  type SyncStage,
} from "@/lib/offline/syncPresentation";
import type {
  AgendaItem,
  Animal,
  Lote,
  ProtocoloSanitario,
  ProtocoloSanitarioItem,
} from "@/lib/offline/types";
import { isCalfJourneyAgendaItem } from "@/lib/reproduction/calfJourney";
import { buildRegulatoryOperationalReadModel } from "@/lib/sanitario/regulatoryReadModel";
import {
  type SanitaryBaseCalendarAnchor,
  type SanitaryBaseCalendarMode,
} from "@/lib/sanitario/calendar";
import { resolveSanitaryAgendaItemScheduleMeta } from "@/lib/sanitario/agendaSchedule";
import { concluirPendenciaSanitaria } from "@/lib/sanitario/service";
import { pickVeterinaryProductMetadata } from "@/lib/sanitario/products";
import { getSanitaryAgendaPriority } from "@/lib/sanitario/protocolRules";
import { cn } from "@/lib/utils";
import {
  asSanitarioTipo,
  formatAgendaDate,
  formatAgendaTypeLabel,
  formatAnimalAge,
  getAgendaStatusTone,
  getGroupVisibilityLabel,
  readNumber,
  readString,
} from "@/pages/Agenda/helpers/formatting";
import {
  getAnimalQuickFilterLabel,
  getCalendarAnchorQuickFilterLabel,
  getCalendarModeQuickFilterLabel,
  getQuickFilterBadgeToneClass,
  getScheduleQuickFilterLabel,
  mapAnimalBadgeToQuickFilter,
  mapScheduleBadgeToQuickFilter,
  matchesAnimalQuickFilter,
  parseCalendarAnchorQuickFilter,
  parseCalendarModeQuickFilter,
} from "@/pages/Agenda/helpers/quickFilters";
import type {
  AgendaCalendarAnchorQuickFilter,
  AgendaCalendarModeQuickFilter,
  AgendaScheduleQuickFilter,
  AnimalQuickFilter,
  GroupMode,
  QuickFilterTone,
} from "@/pages/Agenda/types";
import { showError, showSuccess } from "@/utils/toast";

const DOMAIN_LABEL: Record<string, string> = {
  sanitario: "Sanitario",
  alerta_sanitario: "Alerta sanitario",
  conformidade: "Conformidade",
  pesagem: "Pesagem",
  movimentacao: "Movimentacao",
  nutricao: "Nutricao",
  financeiro: "Financeiro",
  reproducao: "Reproducao",
};

const STATUS_LABEL: Record<string, string> = {
  agendado: "Agendado",
  concluido: "Concluido",
  cancelado: "Cancelado",
};

type AgendaRow = {
  item: AgendaItem;
  animal: Animal | null;
  lote: Lote | null;
  animalNome: string;
  loteNome: string;
  idadeLabel: string;
  syncStage: SyncStage;
  produtoLabel: string;
  scheduleLabel: string | null;
  scheduleMode: SanitaryBaseCalendarMode | null;
  scheduleModeLabel: string | null;
  scheduleAnchor: SanitaryBaseCalendarAnchor | null;
  scheduleAnchorLabel: string | null;
  protocol: ProtocoloSanitario | null;
  protocolItem: ProtocoloSanitarioItem | null;
  priority: ReturnType<typeof getSanitaryAgendaPriority> | null;
};

type AgendaContextualFocus = {
  token: number;
  groupKey: string;
  rowId: string;
  rowIds: string[];
};

const DEFAULT_AGENDA_STATE = {
  search: "",
  statusFilter: "all" as const,
  dominioFilter: "all",
  dateFrom: "",
  dateTo: "",
  groupMode: "animal" as GroupMode,
  quickTypeFilter: "all",
  quickScheduleFilter: "all" as AgendaScheduleQuickFilter,
  quickCalendarModeFilter: "all" as AgendaCalendarModeQuickFilter,
  quickCalendarAnchorFilter: "all" as AgendaCalendarAnchorQuickFilter,
  quickAnimalFilter: "all" as AnimalQuickFilter,
};

function QuickFilterBadge({
  tone,
  active,
  onClick,
  children,
  className,
}: {
  tone: QuickFilterTone;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none",
        getQuickFilterBadgeToneClass(tone),
        "cursor-pointer transition-colors hover:brightness-[0.98]",
        active ? "border-primary/70 ring-2 ring-primary/20" : null,
        className,
      )}
    >
      {children}
    </button>
  );
}

function getCompactActionLabel(item: AgendaItem) {
  return isCalfJourneyAgendaItem(item) ? "Rotina da cria" : "Abrir acao";
}

export default function Agenda() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activeFarmId, farmLifecycleConfig, user } = useAuth();
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const previousGroupModeRef = useRef<GroupMode | null>(null);
  const [search, setSearch] = useState(DEFAULT_AGENDA_STATE.search);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "agendado" | "concluido" | "cancelado"
  >(DEFAULT_AGENDA_STATE.statusFilter);
  const [dominioFilter, setDominioFilter] = useState(DEFAULT_AGENDA_STATE.dominioFilter);
  const [dateFrom, setDateFrom] = useState(DEFAULT_AGENDA_STATE.dateFrom);
  const [dateTo, setDateTo] = useState(DEFAULT_AGENDA_STATE.dateTo);
  const [groupMode, setGroupMode] = useState<GroupMode>(DEFAULT_AGENDA_STATE.groupMode);
  const [quickTypeFilter, setQuickTypeFilter] = useState<string>(
    DEFAULT_AGENDA_STATE.quickTypeFilter,
  );
  const [quickScheduleFilter, setQuickScheduleFilter] = useState<
    AgendaScheduleBucket | "all"
  >(DEFAULT_AGENDA_STATE.quickScheduleFilter);
  const [quickCalendarModeFilter, setQuickCalendarModeFilter] =
    useState<AgendaCalendarModeQuickFilter>(DEFAULT_AGENDA_STATE.quickCalendarModeFilter);
  const [quickCalendarAnchorFilter, setQuickCalendarAnchorFilter] =
    useState<AgendaCalendarAnchorQuickFilter>(DEFAULT_AGENDA_STATE.quickCalendarAnchorFilter);
  const [quickAnimalFilter, setQuickAnimalFilter] =
    useState<AnimalQuickFilter>(DEFAULT_AGENDA_STATE.quickAnimalFilter);
  const [contextualFocus, setContextualFocus] = useState<AgendaContextualFocus | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const [revealedGroups, setRevealedGroups] = useState<string[]>([]);
  const [hasHydratedUiState, setHasHydratedUiState] = useState(false);
  const queryCalendarModeFilter = parseCalendarModeQuickFilter(
    searchParams.get("calendarMode"),
  );
  const queryCalendarAnchorFilter = parseCalendarAnchorQuickFilter(
    searchParams.get("calendarAnchor"),
  );

  useEffect(() => {
    if (!user?.id || !activeFarmId) {
      previousGroupModeRef.current = null;
      setHasHydratedUiState(false);
      return;
    }

    const persistedState = readAgendaUiState(user.id, activeFarmId);
    const nextGroupMode = persistedState?.groupMode ?? DEFAULT_AGENDA_STATE.groupMode;

    setSearch(persistedState?.search ?? DEFAULT_AGENDA_STATE.search);
    setStatusFilter(persistedState?.statusFilter ?? DEFAULT_AGENDA_STATE.statusFilter);
    setDominioFilter(persistedState?.dominioFilter ?? DEFAULT_AGENDA_STATE.dominioFilter);
    setDateFrom(persistedState?.dateFrom ?? DEFAULT_AGENDA_STATE.dateFrom);
    setDateTo(persistedState?.dateTo ?? DEFAULT_AGENDA_STATE.dateTo);
    setGroupMode(nextGroupMode);
    setQuickTypeFilter(persistedState?.quickTypeFilter ?? DEFAULT_AGENDA_STATE.quickTypeFilter);
    setQuickScheduleFilter(
      persistedState?.quickScheduleFilter ?? DEFAULT_AGENDA_STATE.quickScheduleFilter,
    );
    setQuickCalendarModeFilter(
      persistedState?.quickCalendarModeFilter ??
        DEFAULT_AGENDA_STATE.quickCalendarModeFilter,
    );
    setQuickCalendarAnchorFilter(
      persistedState?.quickCalendarAnchorFilter ??
        DEFAULT_AGENDA_STATE.quickCalendarAnchorFilter,
    );
    setQuickAnimalFilter(
      persistedState?.quickAnimalFilter ?? DEFAULT_AGENDA_STATE.quickAnimalFilter,
    );
    setExpandedGroups(persistedState?.expandedGroups ?? []);
    setRevealedGroups(persistedState?.revealedGroups ?? []);
    setContextualFocus(
      persistedState?.contextualFocus
        ? {
            token: Date.now(),
            ...persistedState.contextualFocus,
          }
        : null,
    );
    previousGroupModeRef.current = nextGroupMode;
    setHasHydratedUiState(true);
  }, [activeFarmId, user?.id]);

  useEffect(() => {
    if (!user?.id || !activeFarmId || !hasHydratedUiState) return;

    writeAgendaUiState(user.id, activeFarmId, {
      search,
      statusFilter,
      dominioFilter,
      dateFrom,
      dateTo,
      groupMode,
      quickTypeFilter,
      quickScheduleFilter,
      quickCalendarModeFilter,
      quickCalendarAnchorFilter,
      quickAnimalFilter,
      expandedGroups,
      revealedGroups,
      contextualFocus: contextualFocus
        ? {
            groupKey: contextualFocus.groupKey,
            rowId: contextualFocus.rowId,
            rowIds: contextualFocus.rowIds,
          }
        : null,
    });
  }, [
    activeFarmId,
    contextualFocus,
    dateFrom,
    dateTo,
    dominioFilter,
    expandedGroups,
    groupMode,
    hasHydratedUiState,
    quickCalendarModeFilter,
    quickCalendarAnchorFilter,
    quickAnimalFilter,
    quickScheduleFilter,
    quickTypeFilter,
    revealedGroups,
    search,
    statusFilter,
    user?.id,
  ]);

  useEffect(() => {
    if (!activeFarmId) return;

    pullDataForFarm(
      activeFarmId,
      [
        "agenda_itens",
        "animais",
        "lotes",
        "protocolos_sanitarios",
        "protocolos_sanitarios_itens",
        "fazenda_sanidade_config",
      ],
      {
      mode: "merge",
      },
    ).catch((error) => {
      console.warn("[agenda] failed to refresh agenda_itens", error);
    });
  }, [activeFarmId]);

  const data = useLiveQuery(
    async () => {
      if (!activeFarmId) {
        return {
          itens: [],
          animais: [],
          lotes: [],
          protocolos: [],
          protocoloItens: [],
          gestos: [],
          sanidadeConfig: null,
          officialTemplates: [],
          officialTemplateItems: [],
        };
      }

      const [
        itens,
        animais,
        lotes,
        protocolos,
        protocoloItens,
        gestos,
        sanidadeConfig,
        officialTemplates,
        officialTemplateItems,
      ] =
        await Promise.all([
        db.state_agenda_itens.where("fazenda_id").equals(activeFarmId).toArray(),
        db.state_animais.where("fazenda_id").equals(activeFarmId).toArray(),
        db.state_lotes.where("fazenda_id").equals(activeFarmId).toArray(),
        db.state_protocolos_sanitarios
          .where("fazenda_id")
          .equals(activeFarmId)
          .toArray(),
        db.state_protocolos_sanitarios_itens
          .where("fazenda_id")
          .equals(activeFarmId)
          .toArray(),
        db.queue_gestures.where("fazenda_id").equals(activeFarmId).toArray(),
        db.state_fazenda_sanidade_config.get(activeFarmId),
        db.catalog_protocolos_oficiais.toArray(),
        db.catalog_protocolos_oficiais_itens.toArray(),
      ]);

      return {
        itens: itens.filter((item) => !item.deleted_at),
        animais: animais.filter((animal) => !animal.deleted_at),
        lotes: lotes.filter((lote) => !lote.deleted_at),
        protocolos: protocolos.filter((protocolo) => !protocolo.deleted_at),
        protocoloItens: protocoloItens.filter((item) => !item.deleted_at),
        gestos,
        sanidadeConfig: sanidadeConfig && !sanidadeConfig.deleted_at ? sanidadeConfig : null,
        officialTemplates,
        officialTemplateItems,
      };
    },
    [activeFarmId],
  );

  const regulatoryReadModel = useMemo(
    () =>
      buildRegulatoryOperationalReadModel({
        config: data?.sanidadeConfig ?? null,
        templates: data?.officialTemplates ?? [],
        items: data?.officialTemplateItems ?? [],
      }),
    [data],
  );

  const complianceSummary = regulatoryReadModel.attention;

  const baseRows = useMemo(() => {
    if (!data) return [];
    const animalById = new Map(data.animais.map((animal) => [animal.id, animal]));
    const loteById = new Map(data.lotes.map((lote) => [lote.id, lote]));
    const protocolById = new Map(
      data.protocolos.map((protocolo) => [protocolo.id, protocolo]),
    );
    const protocolItemById = new Map(
      data.protocoloItens.map((item) => [item.id, item]),
    );
    const gestoByTx = new Map(data.gestos.map((gesture) => [gesture.client_tx_id, gesture]));
    const searchLower = search.trim().toLowerCase();

    return data.itens
      .map((item) => {
        const animal = item.animal_id ? animalById.get(item.animal_id) : null;
        const lote = item.lote_id ? loteById.get(item.lote_id) : null;
        const syncStage = getGestureSyncStage(
          item.client_tx_id ? gestoByTx.get(item.client_tx_id) ?? null : null,
        );

        const dateMatch =
          (!dateFrom || item.data_prevista >= dateFrom) &&
          (!dateTo || item.data_prevista <= dateTo);
        const statusMatch = statusFilter === "all" || item.status === statusFilter;
        const dominioMatch = dominioFilter === "all" || item.dominio === dominioFilter;

        const textIndex = [
          item.tipo,
          item.dominio,
          animal?.identificacao ?? "",
          lote?.nome ?? "",
        ]
          .join(" ")
          .toLowerCase();
        const searchMatch = !searchLower || textIndex.includes(searchLower);

        if (
          !dateMatch ||
          !statusMatch ||
          !dominioMatch ||
          !searchMatch
        ) {
          return null;
        }

        return {
          item,
          animal,
          lote,
          protocol: readString(item.source_ref, "protocolo_id")
            ? protocolById.get(readString(item.source_ref, "protocolo_id")!) ?? null
            : null,
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
        const scheduleMeta = resolveSanitaryAgendaItemScheduleMeta(
          typed.item,
          typed.protocolItem,
        );

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
  }, [
    data,
    search,
    statusFilter,
    dominioFilter,
    dateFrom,
    dateTo,
  ]);

  const filtered = useMemo(
    () =>
      baseRows.filter((row) => {
        const typeMatch =
          quickTypeFilter === "all" || row.item.tipo === quickTypeFilter;
        const scheduleMatch =
          quickScheduleFilter === "all" ||
          getAgendaScheduleBucket(row.item) === quickScheduleFilter;
        const calendarModeMatch =
          quickCalendarModeFilter === "all" || row.scheduleMode === quickCalendarModeFilter;
        const calendarAnchorMatch =
          quickCalendarAnchorFilter === "all" ||
          row.scheduleAnchor === quickCalendarAnchorFilter;
        const animalQuickMatch = matchesAnimalQuickFilter(
          row.item,
          row.animal,
          quickAnimalFilter,
        );

        return (
          typeMatch &&
          scheduleMatch &&
          calendarModeMatch &&
          calendarAnchorMatch &&
          animalQuickMatch
        );
      }),
    [
      baseRows,
      quickCalendarModeFilter,
      quickCalendarAnchorFilter,
      quickTypeFilter,
      quickScheduleFilter,
      quickAnimalFilter,
    ],
  );

  const hasQuickFiltersActive =
    quickTypeFilter !== "all" ||
    quickScheduleFilter !== "all" ||
    quickCalendarModeFilter !== "all" ||
    quickCalendarAnchorFilter !== "all" ||
    quickAnimalFilter !== "all";

  const expandedGroupSet = useMemo(() => new Set(expandedGroups), [expandedGroups]);

  const contextualHighlightedRowIds = useMemo(
    () => new Set(contextualFocus?.rowIds ?? []),
    [contextualFocus],
  );

  useEffect(() => {
    if (!hasHydratedUiState) return;

    const previousGroupMode = previousGroupModeRef.current;
    if (previousGroupMode === null) {
      previousGroupModeRef.current = groupMode;
      return;
    }

    if (previousGroupMode === groupMode) return;

    previousGroupModeRef.current = groupMode;
    setContextualFocus(null);
    setExpandedGroups([]);
    setRevealedGroups([]);
  }, [groupMode, hasHydratedUiState]);

  useEffect(() => {
    if (!hasHydratedUiState || queryCalendarModeFilter === null) return;

    setQuickCalendarModeFilter(queryCalendarModeFilter);
    setContextualFocus(null);
    setExpandedGroups([]);
    setRevealedGroups([]);
  }, [hasHydratedUiState, queryCalendarModeFilter]);

  useEffect(() => {
    if (!hasHydratedUiState || queryCalendarAnchorFilter === null) return;

    setQuickCalendarAnchorFilter(queryCalendarAnchorFilter);
    setContextualFocus(null);
    setExpandedGroups([]);
    setRevealedGroups([]);
  }, [hasHydratedUiState, queryCalendarAnchorFilter]);

  useEffect(() => {
    if (!contextualFocus) return;

    const visibleRowId = contextualFocus.rowIds.find((rowId) => rowRefs.current.has(rowId));
    if (!visibleRowId) {
      setContextualFocus(null);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const node = rowRefs.current.get(visibleRowId);
      if (!node) return;

      node.scrollIntoView({ behavior: "smooth", block: "center" });
      node.focus({ preventScroll: true });
    }, 80);

    return () => window.clearTimeout(timeoutId);
  }, [contextualFocus, filtered]);

  const lifecycleQueue = useMemo(() => {
    if (!data) return [];

    return getPendingAnimalLifecycleTransitions(
      data.animais.filter((animal) => animal.status === "ativo"),
      farmLifecycleConfig,
    ).map((item) => {
      const animal = data.animais.find((entry) => entry.id === item.animalId) ?? null;
      const lote =
        animal?.lote_id
          ? data.lotes.find((entry) => entry.id === animal.lote_id) ?? null
          : null;

      return {
        ...item,
        loteNome: lote?.nome ?? "Sem lote",
      };
    });
  }, [data, farmLifecycleConfig]);

  const lifecycleSummary = useMemo(
    () => summarizePendingAnimalLifecycleTransitions(lifecycleQueue),
    [lifecycleQueue],
  );

  const groupedByAnimal = useMemo(() => {
    const visibleRowIds = new Set(filtered.map((row) => row.item.id));
    const byAnimal = new Map<
      string,
      {
        key: string;
        title: string;
        rows: AgendaRow[];
        visibleRows: AgendaRow[];
        animal: Animal | null;
        summary: ReturnType<typeof summarizeAgendaGroupByAnimal>;
        sortMeta: ReturnType<typeof summarizeAgendaGroupOrdering>;
      }
    >();

    for (const row of baseRows) {
      const key = row.item.animal_id ?? `sem-animal:${row.item.id}`;
      const animalIdShort = row.item.animal_id ? row.item.animal_id.slice(0, 8) : null;
      const title = row.animal?.identificacao ?? (animalIdShort ? `Animal ${animalIdShort}` : "Sem animal");

      const current = byAnimal.get(key);
      if (current) {
        current.rows.push(row);
      } else {
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
    }

    return Array.from(byAnimal.values())
      .map((group) => ({
        ...group,
        rows: [...group.rows].sort((left, right) =>
          left.item.data_prevista.localeCompare(right.item.data_prevista),
        ),
        visibleRows: group.rows.filter((row) => visibleRowIds.has(row.item.id)),
        summary: summarizeAgendaGroupByAnimal(group.rows),
        sortMeta: summarizeAgendaGroupOrdering(
          hasQuickFiltersActive
            ? group.rows.filter((row) => visibleRowIds.has(row.item.id))
            : group.rows,
        ),
      }))
      .filter((group) => group.visibleRows.length > 0)
      .sort(
        (left, right) =>
          compareAgendaGroupOrdering(left.sortMeta, right.sortMeta) ||
          left.title.localeCompare(right.title),
      );
  }, [baseRows, filtered, hasQuickFiltersActive]);

  const groupedByEvent = useMemo(() => {
    const visibleRowIds = new Set(filtered.map((row) => row.item.id));
    const byEvent = new Map<
      string,
      {
        key: string;
        title: string;
        subtitle: string;
        rows: AgendaRow[];
        visibleRows: AgendaRow[];
        earliestDate: string;
        summary: ReturnType<typeof summarizeAgendaGroupByEvent>;
        sortMeta: ReturnType<typeof summarizeAgendaGroupOrdering>;
      }
    >();

    for (const row of baseRows) {
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
      } else {
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
    }

    return Array.from(byEvent.values())
      .map((group) => ({
        ...group,
        rows: [...group.rows].sort((left, right) =>
          left.item.data_prevista.localeCompare(right.item.data_prevista),
        ),
        visibleRows: group.rows.filter((row) => visibleRowIds.has(row.item.id)),
        summary: summarizeAgendaGroupByEvent(group.rows),
        sortMeta: summarizeAgendaGroupOrdering(
          hasQuickFiltersActive
            ? group.rows.filter((row) => visibleRowIds.has(row.item.id))
            : group.rows,
        ),
      }))
      .filter((group) => group.visibleRows.length > 0)
      .sort(
        (left, right) =>
          compareAgendaGroupOrdering(left.sortMeta, right.sortMeta) ||
          left.earliestDate.localeCompare(right.earliestDate),
      );
  }, [baseRows, filtered, hasQuickFiltersActive]);

  const counts = useMemo(() => {
    let agendado = 0;
    let concluido = 0;
    let cancelado = 0;
    for (const row of filtered) {
      if (row.item.status === "agendado") agendado++;
      if (row.item.status === "concluido") concluido++;
      if (row.item.status === "cancelado") cancelado++;
    }
    return { agendado, concluido, cancelado };
  }, [filtered]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    statusFilter !== "all" ||
    dominioFilter !== "all" ||
    dateFrom.length > 0 ||
    dateTo.length > 0 ||
    groupMode !== "animal" ||
    quickTypeFilter !== "all" ||
    quickScheduleFilter !== "all" ||
    quickCalendarModeFilter !== "all" ||
    quickCalendarAnchorFilter !== "all" ||
    quickAnimalFilter !== "all";

  const hasComplianceAttention = complianceSummary.openCount > 0;
  const complianceAlertTone =
    complianceSummary.blockingCount > 0 ? "danger" : "warning";

  const criticalTargets = useMemo(
    () =>
      groupMode === "animal"
        ? buildAgendaCriticalNavigationTargets(
            groupedByAnimal.map((group) => ({
              key: group.key,
              title: group.title,
              rows: group.visibleRows,
            })),
          )
        : buildAgendaCriticalNavigationTargets(
            groupedByEvent.map((group) => ({
              key: group.key,
              title: group.title,
              rows: group.visibleRows,
            })),
          ),
    [groupMode, groupedByAnimal, groupedByEvent],
  );

  const currentCriticalTarget = useMemo(
    () =>
      criticalTargets.find((entry) => entry.groupKey === contextualFocus?.groupKey) ?? null,
    [contextualFocus?.groupKey, criticalTargets],
  );

  const buildGroupStateKey = (mode: GroupMode, groupKey: string) => `${mode}:${groupKey}`;

  const ensureGroupExpanded = (mode: GroupMode, groupKey: string) => {
    const stateKey = buildGroupStateKey(mode, groupKey);
    setExpandedGroups((current) => (current.includes(stateKey) ? current : [...current, stateKey]));
  };

  const toggleGroupExpanded = (mode: GroupMode, groupKey: string) => {
    const stateKey = buildGroupStateKey(mode, groupKey);
    setExpandedGroups((current) =>
      current.includes(stateKey)
        ? current.filter((entry) => entry !== stateKey)
        : [...current, stateKey],
    );
  };

  const toggleGroupReveal = (mode: GroupMode, groupKey: string) => {
    const stateKey = buildGroupStateKey(mode, groupKey);
    setRevealedGroups((current) =>
      current.includes(stateKey)
        ? current.filter((entry) => entry !== stateKey)
        : [...current, stateKey],
    );
  };

  const updateStatus = async (item: AgendaItem, status: "concluido" | "cancelado") => {
    if (!activeFarmId) {
      showError("Fazenda ativa nao encontrada.");
      return;
    }

    const sourceTipo = asSanitarioTipo(readString(item.source_ref, "tipo"));
    const sourceProduto =
      readString(item.source_ref, "produto") ??
      readString(item.payload, "produto") ??
      null;
    const protocolItem =
      item.protocol_item_version_id
        ? await db.state_protocolos_sanitarios_itens.get(item.protocol_item_version_id)
        : null;
    const sanitaryProductMetadata = {
      ...pickVeterinaryProductMetadata(protocolItem?.payload),
      ...pickVeterinaryProductMetadata(item.source_ref),
      ...pickVeterinaryProductMetadata(item.payload),
    };

    if (item.dominio === "sanitario" && status === "concluido") {
      try {
        const eventoId = await concluirPendenciaSanitaria({
          agendaItemId: item.id,
          occurredAt: new Date().toISOString(),
          tipo: sourceTipo ?? undefined,
          produto: sourceProduto ?? undefined,
          payload: {
            origem: "agenda_concluir",
            ...sanitaryProductMetadata,
          },
        });

        await pullDataForFarm(
          activeFarmId,
          ["agenda_itens", "eventos", "eventos_sanitario"],
          { mode: "merge" },
        );

        showSuccess(
          `Aplicacao sanitaria confirmada no servidor. Evento ${eventoId.slice(0, 8)}.`,
        );
        return;
      } catch (error) {
        console.error("[agenda] failed to conclude sanitary item with event", error);
        showError("Falha ao concluir pendencia sanitaria com evento.");
        return;
      }
    }

    try {
      await createGesture(activeFarmId, [
        {
          table: "agenda_itens",
          action: "UPDATE",
          record: {
            id: item.id,
            status,
            source_evento_id: item.source_evento_id ?? null,
          },
        },
      ]);
      showSuccess(
        `Item ${
          status === "concluido" ? "concluido" : "cancelado"
        } neste aparelho. Sincronizacao pendente.`,
      );
    } catch {
      showError("Falha ao atualizar item da agenda.");
    }
  };

  const goToRegistrar = (item: AgendaItem) => {
    if (item.animal_id && isCalfJourneyAgendaItem(item)) {
      const params = new URLSearchParams();
      params.set("agendaItemId", item.id);
      if (item.source_evento_id) {
        params.set("eventoId", item.source_evento_id);
      }
      navigate(`/animais/${item.animal_id}/cria-inicial?${params.toString()}`);
      return;
    }

    const params = new URLSearchParams();
    params.set("sourceTaskId", item.id);
    params.set("dominio", item.dominio);
    if (item.animal_id) params.set("animalId", item.animal_id);
    if (item.lote_id) params.set("loteId", item.lote_id);

    const protocoloId = readString(item.source_ref, "protocolo_id");
    const protocoloItemId =
      readString(item.source_ref, "protocolo_item_id") ?? item.protocol_item_version_id;
    const produto =
      readString(item.source_ref, "produto") ?? readString(item.payload, "produto");
    const sanitarioTipo = asSanitarioTipo(readString(item.source_ref, "tipo"));

    if (protocoloId) params.set("protocoloId", protocoloId);
    if (protocoloItemId) params.set("protocoloItemId", protocoloItemId);
    if (produto) params.set("produto", produto);
    if (sanitarioTipo) params.set("sanitarioTipo", sanitarioTipo);

    navigate(`/registrar?${params.toString()}`);
  };

  const registerRowRef = (rowId: string, node: HTMLElement | null) => {
    if (node) {
      rowRefs.current.set(rowId, node);
      return;
    }

    rowRefs.current.delete(rowId);
  };

  const applyContextualFocus = (groupKey: string, rows: AgendaRow[]) => {
    if (rows.length === 0) {
      setContextualFocus(null);
      return;
    }

    const stateKey = buildGroupStateKey(groupMode, groupKey);
    ensureGroupExpanded(groupMode, groupKey);
    setRevealedGroups((current) => current.filter((entry) => entry !== stateKey));
    setContextualFocus({
      token: Date.now(),
      groupKey,
      rowId: rows[0].item.id,
      rowIds: rows.map((row) => row.item.id),
    });
  };

  const navigateCriticalGroup = (direction: "next" | "previous") => {
    const target = getAdjacentAgendaCriticalNavigationTarget(
      criticalTargets,
      currentCriticalTarget?.groupKey ?? null,
      direction,
    );
    if (!target) return;

    setQuickScheduleFilter("overdue");
    applyContextualFocus(target.groupKey, target.rows);
  };

  const handleAnimalSummaryBadgeClick = (
    groupKey: string,
    rows: AgendaRow[],
    badge: AgendaSummaryBadge,
  ) => {
    const isSameGroupFocused = contextualFocus?.groupKey === groupKey;
    const scheduleFilter = mapScheduleBadgeToQuickFilter(badge.key);

    if (scheduleFilter) {
      if (quickScheduleFilter === scheduleFilter && isSameGroupFocused) {
        setQuickScheduleFilter("all");
        setContextualFocus(null);
        return;
      }

      setQuickScheduleFilter(scheduleFilter);
      applyContextualFocus(
        groupKey,
        rows.filter((row) => getAgendaScheduleBucket(row.item) === scheduleFilter),
      );
      return;
    }

    if (quickTypeFilter === badge.key && isSameGroupFocused) {
      setQuickTypeFilter("all");
      setContextualFocus(null);
      return;
    }

    setQuickTypeFilter(badge.key);
    applyContextualFocus(
      groupKey,
      rows.filter((row) => row.item.tipo === badge.key),
    );
  };

  const handleEventSummaryBadgeClick = (
    groupKey: string,
    rows: AgendaRow[],
    badge: AgendaSummaryBadge,
  ) => {
    const animalFilter = mapAnimalBadgeToQuickFilter(badge.key);
    if (!animalFilter) return;

    const isSameGroupFocused = contextualFocus?.groupKey === groupKey;
    if (quickAnimalFilter === animalFilter && isSameGroupFocused) {
      setQuickAnimalFilter("all");
      setContextualFocus(null);
      return;
    }

    setQuickAnimalFilter(animalFilter);
    applyContextualFocus(
      groupKey,
      rows.filter((row) => matchesAnimalQuickFilter(row.item, row.animal, animalFilter)),
    );
  };

  const renderRow = (row: AgendaRow) => {
    const isContextualMatch = contextualHighlightedRowIds.has(row.item.id);
    const isContextualFocusRow = contextualFocus?.rowId === row.item.id;
    const indicacao =
      readString(row.item.source_ref, "indicacao") ??
      (readNumber(row.item.source_ref, "dose_num")
        ? `Dose ${readNumber(row.item.source_ref, "dose_num")}`
        : "Aplicacao conforme protocolo");

    return (
      <article
        key={row.item.id}
        ref={(node) => registerRowRef(row.item.id, node)}
        tabIndex={-1}
        className={cn(
          "scroll-mt-24 rounded-2xl border border-border/70 bg-muted/30 p-4 transition-colors transition-shadow",
          isContextualMatch ? "border-info/30 bg-info-muted/30" : null,
          isContextualFocusRow ? "ring-2 ring-info/25 ring-offset-2 ring-offset-background" : null,
        )}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium capitalize">
                {row.item.tipo.replaceAll("_", " ")}
              </p>
              <StatusBadge tone="neutral">
                {DOMAIN_LABEL[row.item.dominio] ?? row.item.dominio}
              </StatusBadge>
              {row.priority ? (
                <StatusBadge tone={row.priority.tone}>{row.priority.label}</StatusBadge>
              ) : null}
              <StatusBadge tone={getAgendaStatusTone(row.item.status)}>
                {STATUS_LABEL[row.item.status] ?? row.item.status}
              </StatusBadge>
              <StatusBadge tone={getSyncStageTone(row.syncStage)}>
                {getSyncStageLabel(row.syncStage)}
              </StatusBadge>
              {row.scheduleModeLabel ? (
                <StatusBadge tone="info">{row.scheduleModeLabel}</StatusBadge>
              ) : null}
            </div>

            <p className="text-sm leading-6 text-muted-foreground">
              {formatAgendaDate(row.item.data_prevista)} | {row.animalNome} ({row.idadeLabel}) | {row.loteNome}
            </p>

            <div className="grid gap-2 text-sm md:grid-cols-2">
              <p className="text-muted-foreground">
                Produto: <span className="font-medium text-foreground">{row.produtoLabel}</span>
              </p>
              {row.scheduleLabel ? (
                <p className="text-muted-foreground">
                  Periodicidade: <span className="font-medium text-foreground">{row.scheduleLabel}</span>
                </p>
              ) : null}
              {row.scheduleAnchorLabel ? (
                <p className="text-muted-foreground">
                  Ancora: <span className="font-medium text-foreground">{row.scheduleAnchorLabel}</span>
                </p>
              ) : null}
              <p className="text-muted-foreground">
                Indicacao: <span className="font-medium text-foreground">{indicacao}</span>
              </p>
              <p className="text-muted-foreground">
                Origem: <span className="font-medium text-foreground">{row.item.source_kind}</span>
              </p>
              {row.priority ? (
                <p className="text-muted-foreground">
                  Prioridade: <span className="font-medium text-foreground">{row.priority.label}</span>
                </p>
              ) : null}
            </div>

          </div>

          <div className="flex items-center gap-2">
            {row.item.status === "agendado" ? (
              <Button size="sm" onClick={() => goToRegistrar(row.item)}>
                {isCalfJourneyAgendaItem(row.item)
                  ? "Abrir rotina da cria"
                  : "Registrar evento"}
              </Button>
            ) : null}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label={`Mais acoes para o item ${row.item.id}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {row.item.status === "agendado" && !isCalfJourneyAgendaItem(row.item) ? (
                  <DropdownMenuItem onClick={() => updateStatus(row.item, "concluido")}>
                    Concluir
                  </DropdownMenuItem>
                ) : null}
                {row.item.status === "agendado" ? (
                  <DropdownMenuItem onClick={() => updateStatus(row.item, "cancelado")}>
                    Cancelar
                  </DropdownMenuItem>
                ) : null}
                {row.item.source_evento_id ? (
                  <DropdownMenuItem
                    onClick={() => navigate(`/eventos?eventoId=${row.item.source_evento_id}`)}
                  >
                    Ver evento
                  </DropdownMenuItem>
                ) : null}
                {row.item.animal_id ? (
                  <DropdownMenuItem onClick={() => navigate(`/animais/${row.item.animal_id}`)}>
                    Abrir ficha do animal
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </article>
    );
  };

  const renderAnimalGroupSummaryBadges = (
    groupKey: string,
    rows: AgendaRow[],
    badges: AgendaSummaryBadge[],
  ) => {
    if (badges.length === 0) return null;

    const compactLayout = buildAgendaBadgeOverflowLayout(badges, 3);
    const renderBadge = (badge: AgendaSummaryBadge, className?: string) => {
      const scheduleFilter = mapScheduleBadgeToQuickFilter(badge.key);
      if (scheduleFilter) {
        return (
          <QuickFilterBadge
            key={badge.key}
            className={className}
            tone={badge.tone}
            active={quickScheduleFilter === scheduleFilter}
            onClick={() => handleAnimalSummaryBadgeClick(groupKey, rows, badge)}
          >
            {badge.label} {badge.count}
          </QuickFilterBadge>
        );
      }

      return (
        <QuickFilterBadge
          key={badge.key}
          className={className}
          tone={badge.tone}
          active={quickTypeFilter === badge.key}
          onClick={() => handleAnimalSummaryBadgeClick(groupKey, rows, badge)}
        >
          {badge.label} {badge.count}
        </QuickFilterBadge>
      );
    };

    return (
      <div className="flex flex-wrap gap-2">
        {badges.map((badge, index) =>
          renderBadge(
            badge,
            index >= compactLayout.visibleBadges.length ? "hidden sm:inline-flex" : undefined,
          ),
        )}
        {compactLayout.hiddenCount > 0 ? (
          <StatusBadge tone="neutral" className="sm:hidden">
            +{compactLayout.hiddenCount}
          </StatusBadge>
        ) : null}
      </div>
    );
  };

  const renderEventGroupSummaryBadges = (
    groupKey: string,
    rows: AgendaRow[],
    badges: AgendaSummaryBadge[],
  ) => {
    if (badges.length === 0) return null;

    const compactLayout = buildAgendaBadgeOverflowLayout(badges, 3);
    const renderBadge = (badge: AgendaSummaryBadge, className?: string) => {
      const animalFilter = mapAnimalBadgeToQuickFilter(badge.key);
      if (!animalFilter) {
        return (
          <StatusBadge key={badge.key} tone={badge.tone} className={className}>
            {badge.label} {badge.count}
          </StatusBadge>
        );
      }

      return (
        <QuickFilterBadge
          key={badge.key}
          className={className}
          tone={badge.tone}
          active={quickAnimalFilter === animalFilter}
          onClick={() => handleEventSummaryBadgeClick(groupKey, rows, badge)}
        >
          {badge.label} {badge.count}
        </QuickFilterBadge>
      );
    };

    return (
      <div className="flex flex-wrap gap-2">
        {badges.map((badge, index) =>
          renderBadge(
            badge,
            index >= compactLayout.visibleBadges.length ? "hidden sm:inline-flex" : undefined,
          ),
        )}
        {compactLayout.hiddenCount > 0 ? (
          <StatusBadge tone="neutral" className="sm:hidden">
            +{compactLayout.hiddenCount}
          </StatusBadge>
        ) : null}
      </div>
    );
  };

  if (!data) {
    return (
      <div className="space-y-5">
        <PageIntro
          eyebrow="Rotina planejada"
          title="Agenda de manejo"
          description="Itens manuais e automaticos que sustentam a rotina do dia, sempre vinculados ao fluxo real de eventos."
          actions={
            <Button size="sm" onClick={() => navigate("/registrar")}>
              <Plus className="h-4 w-4" />
              Registrar
            </Button>
          }
        />

        <EmptyState
          icon={Calendar}
          title="Agenda vazia"
          description="A agenda ainda nao tem tarefas abertas. Registre eventos ou ative protocolos para alimentar a rotina."
          action={{
            label: "Registrar atividade",
            onClick: () => navigate("/registrar"),
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageIntro
        eyebrow="Rotina planejada"
        title="Agenda de manejo"
        description="Itens manuais e automaticos vinculados ao fluxo de eventos, com leitura clara do proximo passo e do estado de sync."
        meta={
          <>
            <StatusBadge tone="neutral">{filtered.length} item(ns) no recorte</StatusBadge>
            {hasActiveFilters ? <StatusBadge tone="info">Filtros ativos</StatusBadge> : null}
            {quickTypeFilter !== "all" ? (
              <StatusBadge tone="info">
                Tipo: {formatAgendaTypeLabel(quickTypeFilter)}
              </StatusBadge>
            ) : null}
            {quickScheduleFilter !== "all" ? (
              <StatusBadge tone="info">
                Prazo: {getScheduleQuickFilterLabel(quickScheduleFilter)}
              </StatusBadge>
            ) : null}
            {quickCalendarModeFilter !== "all" ? (
              <StatusBadge tone="info">
                Calendario: {getCalendarModeQuickFilterLabel(quickCalendarModeFilter)}
              </StatusBadge>
            ) : null}
            {quickCalendarAnchorFilter !== "all" ? (
              <StatusBadge tone="info">
                Ancora: {getCalendarAnchorQuickFilterLabel(quickCalendarAnchorFilter)}
              </StatusBadge>
            ) : null}
            {quickAnimalFilter !== "all" ? (
              <StatusBadge tone="info">
                Animal: {getAnimalQuickFilterLabel(quickAnimalFilter)}
              </StatusBadge>
            ) : null}
            {complianceSummary.badges.map((badge) => (
              <StatusBadge key={badge.key} tone={badge.tone}>
                {badge.label} {badge.count}
              </StatusBadge>
            ))}
            {lifecycleSummary.total > 0 ? (
              <StatusBadge tone="warning">
                {lifecycleSummary.total} transicao(oes) no radar
              </StatusBadge>
            ) : null}
          </>
        }
        actions={
          <Button size="sm" onClick={() => navigate("/registrar")}>
            <Plus className="h-4 w-4" />
            Registrar
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Agendados"
          value={counts.agendado}
          hint="Itens que ainda pedem acao."
          tone={counts.agendado > 0 ? "warning" : "default"}
        />
        <MetricCard
          label="Concluidos"
          value={counts.concluido}
          hint="Ja resolvidos no recorte atual."
          tone="success"
        />
        <MetricCard
          label="Cancelados"
          value={counts.cancelado}
          hint="Itens encerrados sem execucao."
          tone={counts.cancelado > 0 ? "danger" : "default"}
        />
      </section>

      {hasComplianceAttention ? (
        <Card
          className={cn(
            "shadow-none",
            complianceAlertTone === "danger"
              ? "border-destructive/15 bg-destructive/5"
              : "border-warning/20 bg-warning-muted/70",
          )}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle
                className={cn(
                  "h-4 w-4",
                  complianceAlertTone === "danger"
                    ? "text-destructive"
                    : "text-warning",
                )}
              />
              {complianceSummary.blockingCount > 0
                ? "Restricoes de conformidade em aberto"
                : "Conformidade operacional pendente"}
            </CardTitle>
            <CardDescription>
              {complianceSummary.openCount} frente(s) do overlay oficial ainda
              pedem acao na fazenda.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {complianceSummary.badges.map((badge) => (
                <StatusBadge key={badge.key} tone={badge.tone}>
                  {badge.label} {badge.count}
                </StatusBadge>
              ))}
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {complianceSummary.topItems.map((item) => (
                <div
                  key={item.key}
                  className="rounded-2xl border border-border/70 bg-background/90 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{item.label}</p>
                    <StatusBadge tone={item.tone}>{item.statusLabel}</StatusBadge>
                    <StatusBadge tone={item.tone}>{item.kindLabel}</StatusBadge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.recommendation}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => navigate("/protocolos-sanitarios")}
              >
                Abrir overlay de conformidade
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {lifecycleSummary.total > 0 ? (
        <Card className="border-warning/20 bg-warning-muted/70 shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Transicoes de estagio no radar
            </CardTitle>
            <CardDescription>
              {lifecycleSummary.total} pendencia(s), com {lifecycleSummary.strategic} estrategica(s) e {lifecycleSummary.biological} biologica(s).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {lifecycleQueue.slice(0, 4).map((item) => (
              <div
                key={item.animalId}
                className="rounded-2xl border border-border/70 bg-background/90 p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.identificacao}</p>
                      <StatusBadge
                        tone={
                          item.queueKind === "decisao_estrategica" ? "warning" : "info"
                        }
                      >
                        {getPendingAnimalLifecycleKindLabel(item.queueKind)}
                      </StatusBadge>
                      <StatusBadge tone={item.canAutoApply ? "info" : "warning"}>
                        {item.canAutoApply ? "Auto/hibrido" : "Manual"}
                      </StatusBadge>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {getAnimalLifeStageLabel(item.currentStage)} para{" "}
                      {getAnimalLifeStageLabel(item.targetStage)} | {item.loteNome}
                    </p>
                    <p className="text-xs text-muted-foreground">{item.reason}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/animais/${item.animalId}`}>Abrir ficha</Link>
                    </Button>
                    <Button asChild size="sm">
                      <Link to="/animais/transicoes">Tratar na fila</Link>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {data.itens.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="Agenda vazia"
          description={
            hasComplianceAttention
              ? "A agenda ainda nao tem tarefas abertas, mas o overlay regulatorio da fazenda segue com pendencias operacionais."
              : "A agenda ainda nao tem tarefas abertas. Registre eventos ou ative protocolos para alimentar a rotina."
          }
          action={{
            label: hasComplianceAttention ? "Abrir protocolos" : "Registrar atividade",
            onClick: () =>
              navigate(hasComplianceAttention ? "/protocolos-sanitarios" : "/registrar"),
          }}
        />
      ) : null}

      {data.itens.length === 0 ? null : (
        <>

      <Toolbar>
        <ToolbarGroup className="flex-1 gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por tipo, animal ou lote"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value as "all" | "agendado" | "concluido" | "cancelado")
            }
          >
            <SelectTrigger className="w-full sm:w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="agendado">Agendado</SelectItem>
              <SelectItem value="concluido">Concluido</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>

          <Select value={dominioFilter} onValueChange={setDominioFilter}>
            <SelectTrigger className="w-full sm:w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os dominios</SelectItem>
              <SelectItem value="sanitario">Sanitario</SelectItem>
              <SelectItem value="pesagem">Pesagem</SelectItem>
              <SelectItem value="movimentacao">Movimentacao</SelectItem>
              <SelectItem value="nutricao">Nutricao</SelectItem>
              <SelectItem value="financeiro">Financeiro</SelectItem>
              <SelectItem value="reproducao">Reproducao</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={quickCalendarModeFilter}
            onValueChange={(value) =>
              setQuickCalendarModeFilter(value as AgendaCalendarModeQuickFilter)
            }
          >
            <SelectTrigger className="w-full sm:w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os calendarios</SelectItem>
              <SelectItem value="campaign">Campanha</SelectItem>
              <SelectItem value="age_window">Janela etaria</SelectItem>
              <SelectItem value="rolling_interval">Recorrente</SelectItem>
              <SelectItem value="immediate">Uso imediato</SelectItem>
              <SelectItem value="clinical_protocol">Protocolo clinico</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={quickCalendarAnchorFilter}
            onValueChange={(value) =>
              setQuickCalendarAnchorFilter(value as AgendaCalendarAnchorQuickFilter)
            }
          >
            <SelectTrigger className="w-full sm:w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ancoras</SelectItem>
              <SelectItem value="calendar_month">Calendario</SelectItem>
              <SelectItem value="birth">Nascimento</SelectItem>
              <SelectItem value="weaning">Desmama</SelectItem>
              <SelectItem value="pre_breeding_season">Pre-estacao</SelectItem>
              <SelectItem value="clinical_need">Necessidade clinica</SelectItem>
              <SelectItem value="dry_off">Secagem</SelectItem>
            </SelectContent>
          </Select>
        </ToolbarGroup>

        <ToolbarGroup className="gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            className="w-full sm:w-[160px]"
            aria-label="Data inicial"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            className="w-full sm:w-[160px]"
            aria-label="Data final"
          />
          <Select value={groupMode} onValueChange={(value) => setGroupMode(value as GroupMode)}>
            <SelectTrigger className="w-full sm:w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="animal">Agrupar por animal</SelectItem>
              <SelectItem value="evento">Agrupar por evento</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch(DEFAULT_AGENDA_STATE.search);
              setStatusFilter(DEFAULT_AGENDA_STATE.statusFilter);
              setDominioFilter(DEFAULT_AGENDA_STATE.dominioFilter);
              setDateFrom(DEFAULT_AGENDA_STATE.dateFrom);
              setDateTo(DEFAULT_AGENDA_STATE.dateTo);
              setGroupMode(DEFAULT_AGENDA_STATE.groupMode);
              setQuickTypeFilter(DEFAULT_AGENDA_STATE.quickTypeFilter);
              setQuickScheduleFilter(DEFAULT_AGENDA_STATE.quickScheduleFilter);
              setQuickCalendarModeFilter(DEFAULT_AGENDA_STATE.quickCalendarModeFilter);
              setQuickCalendarAnchorFilter(DEFAULT_AGENDA_STATE.quickCalendarAnchorFilter);
              setQuickAnimalFilter(DEFAULT_AGENDA_STATE.quickAnimalFilter);
              setContextualFocus(null);
              setExpandedGroups([]);
              setRevealedGroups([]);
            }}
          >
            Limpar filtros
          </Button>
        </ToolbarGroup>
      </Toolbar>

      {criticalTargets.length > 0 ? (
        <Card className="border-destructive/15 bg-destructive/5 shadow-none">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone="danger">
                  {criticalTargets.length} grupo(s) atrasado(s)
                </StatusBadge>
                {currentCriticalTarget ? (
                  <StatusBadge tone="info">
                    Foco: {currentCriticalTarget.groupTitle}
                  </StatusBadge>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                Use os atalhos para saltar entre os grupos mais urgentes do recorte atual.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigateCriticalGroup("previous")}
              >
                Critico anterior
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => navigateCriticalGroup("next")}
              >
                Proximo critico
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <ClipboardCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Nenhum item encontrado</p>
            <p className="text-sm text-muted-foreground">
              Ajuste os filtros para localizar tarefas da agenda.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupMode === "animal"
            ? groupedByAnimal.map((group) => {
                const categoriaZootecnica =
                  readString(group.animal?.payload, "categoria_produtiva") ??
                  readString(group.animal?.payload, "categoria") ??
                  "N/D";
                const sexoLabel =
                  group.animal?.sexo === "M"
                    ? "Macho"
                    : group.animal?.sexo === "F"
                      ? "Femea"
                      : "N/D";
                const raca = getAnimalBreedLabel(group.animal?.raca) ?? "N/D";
                const lote = group.rows[0]?.loteNome ?? "Sem lote";
                const idade = group.rows[0]?.idadeLabel ?? "idade n/d";
                const isContextualGroup = contextualFocus?.groupKey === group.key;
                const groupStateKey = buildGroupStateKey("animal", group.key);
                const isExpanded = expandedGroupSet.has(groupStateKey);
                const isRevealed = revealedGroups.includes(groupStateKey);
                const displayedRows =
                  hasQuickFiltersActive && !isRevealed ? group.visibleRows : group.rows;
                const canToggleReveal =
                  hasQuickFiltersActive && group.visibleRows.length < group.rows.length;
                const recommendation = buildAgendaGroupRecommendation(displayedRows);
                const recommendedRow = recommendation
                  ? displayedRows.find((row) => row.item.id === recommendation.rowId) ?? null
                  : null;

                return (
                  <Card
                    key={group.key}
                    className={cn(
                      isContextualGroup ? "border-info/25 shadow-sm shadow-info/10" : null,
                    )}
                  >
                    <CardHeader className="space-y-3">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="text-base">{group.title}</CardTitle>
                            <StatusBadge tone="neutral">
                              {getGroupVisibilityLabel(
                                group.visibleRows.length,
                                group.rows.length,
                              )}
                            </StatusBadge>
                            {complianceSummary.groupBadge && group.sortMeta.pendingCount > 0 ? (
                              <StatusBadge tone={complianceSummary.groupBadge.tone}>
                                {complianceSummary.groupBadge.label}
                              </StatusBadge>
                            ) : null}
                          </div>
                          {renderAnimalGroupSummaryBadges(group.key, group.rows, [
                            ...group.summary.typeBadges,
                            ...group.summary.scheduleBadges,
                          ])}
                          <CardDescription className="text-xs leading-5 sm:text-sm sm:leading-6">
                            {sexoLabel} | {idade} | {lote} | {raca} | {categoriaZootecnica}
                          </CardDescription>
                          {recommendation ? (
                            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                              <StatusBadge tone={recommendation.tone}>
                                {recommendation.urgencyLabel}
                              </StatusBadge>
                              <p className="text-muted-foreground">
                                Proxima acao:{" "}
                                <span className="font-medium text-foreground">
                                  {recommendation.actionLabel}
                                </span>
                              </p>
                            </div>
                          ) : null}
                        </div>
                        <div className="flex w-full items-center gap-2 sm:hidden">
                          {recommendedRow ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="min-w-0 flex-1"
                              onClick={() => goToRegistrar(recommendedRow.item)}
                            >
                              {getCompactActionLabel(recommendedRow.item)}
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={cn("shrink-0", recommendedRow ? null : "flex-1")}
                            aria-expanded={isExpanded}
                            onClick={() => toggleGroupExpanded("animal", group.key)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            {isExpanded ? "Ocultar" : "Itens"}
                          </Button>
                          {canToggleReveal ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  aria-label={`Mais acoes para o grupo ${group.title}`}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => toggleGroupReveal("animal", group.key)}
                                >
                                  {isRevealed ? "Voltar ao recorte" : "Ver grupo completo"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                        </div>
                        <div className="hidden flex-wrap justify-end gap-2 sm:flex">
                          {recommendedRow ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="self-start"
                              onClick={() => goToRegistrar(recommendedRow.item)}
                            >
                              {isCalfJourneyAgendaItem(recommendedRow.item)
                                ? "Abrir rotina da cria"
                                : "Abrir proxima acao"}
                            </Button>
                          ) : null}
                          {canToggleReveal ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="self-start"
                              onClick={() => toggleGroupReveal("animal", group.key)}
                            >
                              {isRevealed ? "Voltar ao recorte" : "Ver grupo completo"}
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="self-start"
                            aria-expanded={isExpanded}
                            onClick={() => toggleGroupExpanded("animal", group.key)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            {isExpanded ? "Ocultar itens" : "Ver itens"}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {isExpanded ? (
                      <CardContent className="space-y-3">
                        {displayedRows.map(renderRow)}
                      </CardContent>
                    ) : null}
                  </Card>
                );
              })
            : groupedByEvent.map((group) => {
                const isContextualGroup = contextualFocus?.groupKey === group.key;
                const groupStateKey = buildGroupStateKey("evento", group.key);
                const isExpanded = expandedGroupSet.has(groupStateKey);
                const isRevealed = revealedGroups.includes(groupStateKey);
                const displayedRows =
                  hasQuickFiltersActive && !isRevealed ? group.visibleRows : group.rows;
                const canToggleReveal =
                  hasQuickFiltersActive && group.visibleRows.length < group.rows.length;
                const recommendation = buildAgendaGroupRecommendation(displayedRows);
                const recommendedRow = recommendation
                  ? displayedRows.find((row) => row.item.id === recommendation.rowId) ?? null
                  : null;
                return (
                  <Card
                    key={group.key}
                    className={cn(
                      isContextualGroup ? "border-info/25 shadow-sm shadow-info/10" : null,
                    )}
                  >
                    <CardHeader className="space-y-3">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <CardTitle className="text-base">{group.title}</CardTitle>
                            <StatusBadge tone="neutral">
                              {getGroupVisibilityLabel(
                                group.visibleRows.length,
                                group.rows.length,
                              )}
                            </StatusBadge>
                            {complianceSummary.groupBadge && group.sortMeta.pendingCount > 0 ? (
                              <StatusBadge tone={complianceSummary.groupBadge.tone}>
                                {complianceSummary.groupBadge.label}
                              </StatusBadge>
                            ) : null}
                          </div>
                          {renderEventGroupSummaryBadges(
                            group.key,
                            group.rows,
                            group.summary.animalBadges,
                          )}
                          <CardDescription className="text-xs leading-5 sm:text-sm sm:leading-6">
                            {group.subtitle}
                          </CardDescription>
                          {recommendation ? (
                            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                              <StatusBadge tone={recommendation.tone}>
                                {recommendation.urgencyLabel}
                              </StatusBadge>
                              <p className="text-muted-foreground">
                                Proxima acao:{" "}
                                <span className="font-medium text-foreground">
                                  {recommendation.actionLabel}
                                </span>{" "}
                                <span className="text-muted-foreground/80">
                                  em {recommendation.targetLabel}
                                </span>
                              </p>
                            </div>
                          ) : null}
                        </div>
                        <div className="flex w-full items-center gap-2 sm:hidden">
                          {recommendedRow ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="min-w-0 flex-1"
                              onClick={() => goToRegistrar(recommendedRow.item)}
                            >
                              {getCompactActionLabel(recommendedRow.item)}
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={cn("shrink-0", recommendedRow ? null : "flex-1")}
                            aria-expanded={isExpanded}
                            onClick={() => toggleGroupExpanded("evento", group.key)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            {isExpanded ? "Ocultar" : "Itens"}
                          </Button>
                          {canToggleReveal ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  aria-label={`Mais acoes para o grupo ${group.title}`}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => toggleGroupReveal("evento", group.key)}
                                >
                                  {isRevealed ? "Voltar ao recorte" : "Ver grupo completo"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                        </div>
                        <div className="hidden flex-wrap justify-end gap-2 sm:flex">
                          {recommendedRow ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="self-start"
                              onClick={() => goToRegistrar(recommendedRow.item)}
                            >
                              {isCalfJourneyAgendaItem(recommendedRow.item)
                                ? "Abrir rotina da cria"
                                : "Abrir proxima acao"}
                            </Button>
                          ) : null}
                          {canToggleReveal ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="self-start"
                              onClick={() => toggleGroupReveal("evento", group.key)}
                            >
                              {isRevealed ? "Voltar ao recorte" : "Ver grupo completo"}
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="self-start"
                            aria-expanded={isExpanded}
                            onClick={() => toggleGroupExpanded("evento", group.key)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            {isExpanded ? "Ocultar itens" : "Ver itens"}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {isExpanded ? (
                      <CardContent className="space-y-3">
                        {displayedRows.map(renderRow)}
                      </CardContent>
                    ) : null}
                  </Card>
                );
              })}
        </div>
      )}
        </>
      )}
    </div>
  );
}
