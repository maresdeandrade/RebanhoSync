import { useEffect, useMemo, useState } from "react";
import { type Collection } from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CalendarClock,
  CornerDownRight,
  FilterX,
  PawPrint,
  Plus,
  Search,
  Upload,
} from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { AnimalCategoryBadge } from "@/components/animals/AnimalCategoryBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/ui/metric-card";
import { PageIntro } from "@/components/ui/page-intro";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import { useAuth } from "@/hooks/useAuth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useLotes } from "@/hooks/useLotes";
import {
  getAnimalLifeStageLabel,
  getPendingAnimalLifecycleKindLabel,
  getPendingAnimalLifecycleTransitions,
  resolveAnimalLifecycleSnapshot,
} from "@/lib/animals/lifecycle";
import { buildAnimalFamilyRows } from "@/lib/animals/familyOrder";
import {
  buildAnimalTaxonomyReproContextMap,
  deriveAnimalTaxonomy,
} from "@/lib/animals/taxonomy";
import {
  formatWeight,
  formatWeightPerDay,
} from "@/lib/format/weight";
import { db } from "@/lib/offline/db";
import { triggerDownload } from "@/lib/offline/rejections";
import { type AgendaItem, type Animal } from "@/lib/offline/types";
import { getReproductionEventsJoined } from "@/lib/reproduction/selectors";
import {
  describeSanitaryCalendarAnchor,
  describeSanitaryCalendarMode,
  type SanitaryBaseCalendarAnchor,
  type SanitaryBaseCalendarMode,
} from "@/lib/sanitario/calendar";
import { resolveSanitaryAgendaItemScheduleMeta } from "@/lib/sanitario/agendaSchedule";
import {
  buildRegulatoryOperationalReadModel,
  EMPTY_REGULATORY_OPERATIONAL_READ_MODEL,
  getRegulatoryAnalyticsImpactLabel,
  getRegulatoryAnalyticsSubareaLabel,
  loadRegulatorySurfaceSource,
  parseRegulatoryAnalyticsImpactKey,
  parseRegulatoryAnalyticsSubareaKey,
  type RegulatoryAnalyticsImpactKey,
  type RegulatoryAnalyticsSubareaKey,
} from "@/lib/sanitario/regulatoryReadModel";
import {
  buildAnimalRegulatoryExportCsv,
  buildAnimalRegulatoryProfile,
  getAnimalRegulatoryImpactLabel,
  matchesAnimalRegulatoryFilters,
  type AnimalRegulatoryProfile,
} from "@/lib/sanitario/regulatoryAnimals";
import { cn } from "@/lib/utils";

const CATEGORY_FILTERS = [
  { value: "all", label: "Todas categorias" },
  { value: "bezerra", label: "Bezerra" },
  { value: "novilha", label: "Novilha" },
  { value: "vaca", label: "Vaca" },
  { value: "bezerro", label: "Bezerro" },
  { value: "garrote", label: "Garrote" },
  { value: "boi_terminacao", label: "Boi" },
  { value: "touro", label: "Touro" },
] as const;

const PRODUCTIVE_STATE_FILTERS = [
  { value: "all", label: "Todos estados" },
  { value: "vazia", label: "Vazia" },
  { value: "prenhe", label: "Prenhe" },
  { value: "pre_parto_imediato", label: "Amojando" },
  { value: "seca", label: "Seca" },
  { value: "recem_parida", label: "Vaca parida" },
  { value: "lactacao", label: "Vaca em lactacao" },
  { value: "inteiro", label: "Inteiro" },
  { value: "castrado", label: "Castrado" },
  { value: "reprodutor", label: "Reprodutor" },
  { value: "terminacao", label: "Terminacao" },
] as const;

const DOMAIN_LABEL: Record<string, string> = {
  sanitario: "Sanitario",
  alerta_sanitario: "Alerta sanitario",
  conformidade: "Conformidade",
  pesagem: "Pesagem",
  nutricao: "Nutricao",
  movimentacao: "Movimentacao",
  reproducao: "Reproducao",
  financeiro: "Financeiro",
};

const ANIMAL_ROWS_PAGE_SIZE = 100;

type AnimalWeightSummary = {
  animalId: string;
  ultimoPesoKg: number;
  ultimoPesoData: string;
  ganhoMedioDiaKg: number | null;
  totalPesagens: number;
};

type AnimalNextAgendaSummary = {
  animalId: string;
  titulo: string;
  data: string;
  status: "atrasado" | "hoje" | "proximo";
  scheduleLabel: string | null;
  scheduleMode: SanitaryBaseCalendarMode | null;
  scheduleModeLabel: string | null;
  scheduleAnchor: SanitaryBaseCalendarAnchor | null;
  scheduleAnchorLabel: string | null;
};

type RegulatoryImpactFilter = RegulatoryAnalyticsImpactKey | "all";
type RegulatorySubareaFilter = RegulatoryAnalyticsSubareaKey | "all";
type AnimalCalendarModeFilter = "all" | SanitaryBaseCalendarMode;
type AnimalCalendarAnchorFilter = "all" | SanitaryBaseCalendarAnchor;

type PaginationToken = number | "ellipsis-left" | "ellipsis-right";

const calcularIdade = (
  dataNascimento: string | null | undefined,
): string | null => {
  if (!dataNascimento) return null;
  const hoje = new Date();
  const nasc = new Date(dataNascimento);
  const diffTime = hoje.getTime() - nasc.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const meses = Math.floor(diffDays / 30);
  const anos = Math.floor(meses / 12);

  if (anos > 0) return `${anos} ano${anos > 1 ? "s" : ""}`;
  if (meses > 0) return `${meses} mes${meses !== 1 ? "es" : ""}`;
  return `${diffDays} dia${diffDays !== 1 ? "s" : ""}`;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR");
}

function formatAgendaTitle(item: Pick<AgendaItem, "dominio" | "tipo">) {
  const domainLabel = DOMAIN_LABEL[item.dominio] ?? "Agenda";
  return `${domainLabel}: ${item.tipo.replaceAll("_", " ")}`;
}

function getProductiveTone(animalStatus: string) {
  if (animalStatus === "ativo") return "success";
  if (animalStatus === "vendido") return "warning";
  return "danger";
}

function getLifecycleTone(canAutoApply: boolean) {
  return canAutoApply ? "info" : "warning";
}

function getAgendaTone(status: AnimalNextAgendaSummary["status"]) {
  if (status === "atrasado") return "danger";
  if (status === "hoje") return "warning";
  return "info";
}

function getAgendaStatusLabel(status: AnimalNextAgendaSummary["status"]) {
  if (status === "atrasado") return "Atrasado";
  if (status === "hoje") return "Hoje";
  return "Proximo";
}

function parseCalendarModeFilter(value: string | null): AnimalCalendarModeFilter {
  if (
    value === "campaign" ||
    value === "age_window" ||
    value === "rolling_interval" ||
    value === "immediate" ||
    value === "clinical_protocol"
  ) {
    return value;
  }

  return "all";
}

function parseCalendarAnchorFilter(
  value: string | null,
): AnimalCalendarAnchorFilter {
  if (
    value === "calendar_month" ||
    value === "birth" ||
    value === "weaning" ||
    value === "pre_breeding_season" ||
    value === "clinical_need" ||
    value === "dry_off"
  ) {
    return value;
  }

  return "all";
}

function buildPaginationTokens(
  currentPage: number,
  totalPages: number,
): PaginationToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const tokens: PaginationToken[] = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) {
    tokens.push("ellipsis-left");
  }

  for (let page = start; page <= end; page += 1) {
    tokens.push(page);
  }

  if (end < totalPages - 1) {
    tokens.push("ellipsis-right");
  }

  tokens.push(totalPages);
  return tokens;
}

function buildAnimalExportFilename(input: {
  farmId: string | null;
  impact: RegulatoryImpactFilter;
  subarea: RegulatorySubareaFilter;
}) {
  const dateTag = new Date().toISOString().slice(0, 10);
  const scope =
    input.subarea !== "all"
      ? input.subarea
      : input.impact !== "all"
        ? input.impact
        : "restricoes";

  return `animais_restricao_regulatoria_${(input.farmId ?? "fazenda").slice(0, 8)}_${scope}_${dateTag}.csv`;
}

export default function Animais() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const regulatoryImpactFromQuery =
    parseRegulatoryAnalyticsImpactKey(searchParams.get("overlayImpact")) ?? "all";
  const regulatorySubareaFromQuery =
    parseRegulatoryAnalyticsSubareaKey(searchParams.get("overlaySubarea")) ?? "all";
  const calendarModeFromQuery = parseCalendarModeFilter(
    searchParams.get("calendarMode"),
  );
  const calendarAnchorFromQuery = parseCalendarAnchorFilter(
    searchParams.get("calendarAnchor"),
  );
  const { activeFarmId, farmLifecycleConfig, farmMeasurementConfig } = useAuth();
  const [search, setSearch] = useState("");
  const [loteFilter, setLoteFilter] = useState<string>("all");
  const [sexoFilter, setSexoFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("ativo");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [productiveStateFilter, setProductiveStateFilter] =
    useState<string>("all");
  const [regulatoryImpactFilter, setRegulatoryImpactFilter] =
    useState<RegulatoryImpactFilter>(regulatoryImpactFromQuery);
  const [regulatorySubareaFilter, setRegulatorySubareaFilter] =
    useState<RegulatorySubareaFilter>(regulatorySubareaFromQuery);
  const [calendarModeFilter, setCalendarModeFilter] =
    useState<AnimalCalendarModeFilter>(calendarModeFromQuery);
  const [calendarAnchorFilter, setCalendarAnchorFilter] =
    useState<AnimalCalendarAnchorFilter>(calendarAnchorFromQuery);
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);
  const lotes = useLotes();

  useEffect(() => {
    setRegulatoryImpactFilter(regulatoryImpactFromQuery);
  }, [regulatoryImpactFromQuery]);

  useEffect(() => {
    setRegulatorySubareaFilter(regulatorySubareaFromQuery);
  }, [regulatorySubareaFromQuery]);

  useEffect(() => {
    setCalendarModeFilter(calendarModeFromQuery);
  }, [calendarModeFromQuery]);

  useEffect(() => {
    setCalendarAnchorFilter(calendarAnchorFromQuery);
  }, [calendarAnchorFromQuery]);

  const animaisFamilia = useLiveQuery(async () => {
    let collection: Collection<Animal, string>;

    if (activeFarmId) {
      collection = db.state_animais.where("fazenda_id").equals(activeFarmId);
    } else {
      collection = db.state_animais.toCollection();
    }

    return await collection.filter((animal) => !animal.deleted_at).toArray();
  }, [activeFarmId]);

  const reproductionEvents = useLiveQuery(async () => {
    if (!activeFarmId) return [];
    return await getReproductionEventsJoined(activeFarmId);
  }, [activeFarmId]);

  const weightSummaries = useLiveQuery(async () => {
    if (!activeFarmId) return [];

    const [events, details] = await Promise.all([
      db.event_eventos
        .where("[fazenda_id+dominio]")
        .equals([activeFarmId, "pesagem"])
        .filter(
          (event) =>
            !event.deleted_at && Boolean(event.animal_id),
        )
        .toArray(),
      db.event_eventos_pesagem
        .where("fazenda_id")
        .equals(activeFarmId)
        .filter((detail) => !detail.deleted_at)
        .toArray(),
    ]);

    const detailByEventId = new Map(
      details.map((detail) => [detail.evento_id, detail]),
    );
    const pointsByAnimal = new Map<
      string,
      Array<{ data: string; pesoKg: number }>
    >();

    for (const event of events) {
      if (!event.animal_id) continue;
      const detail = detailByEventId.get(event.id);
      if (!detail || typeof detail.peso_kg !== "number") continue;

      const referenceDate = event.server_received_at || event.occurred_at;
      const current = pointsByAnimal.get(event.animal_id) ?? [];
      current.push({
        data: referenceDate,
        pesoKg: detail.peso_kg,
      });
      pointsByAnimal.set(event.animal_id, current);
    }

    return Array.from(pointsByAnimal.entries()).map(
      ([animalId, rawPoints]): AnimalWeightSummary => {
        const points = rawPoints
          .slice()
          .sort((left, right) => left.data.localeCompare(right.data));
        const primeiro = points[0];
        const ultimo = points[points.length - 1];
        const diasEntreRegistros = Math.max(
          1,
          Math.round(
            (new Date(ultimo.data).getTime() - new Date(primeiro.data).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        );
        const ganhoMedioDiaKg =
          points.length > 1
            ? (ultimo.pesoKg - primeiro.pesoKg) / diasEntreRegistros
            : null;

        return {
          animalId,
          ultimoPesoKg: ultimo.pesoKg,
          ultimoPesoData: ultimo.data,
          ganhoMedioDiaKg,
          totalPesagens: points.length,
        };
      },
    );
  }, [activeFarmId]);

  const nextAgendaSummaries = useLiveQuery(async () => {
    if (!activeFarmId) return [];

    const todayKey = new Date().toISOString().split("T")[0];
    const items = await db.state_agenda_itens
      .where("[fazenda_id+status]")
      .equals([activeFarmId, "agendado"])
      .filter(
        (item) =>
          !item.deleted_at && Boolean(item.animal_id),
      )
      .toArray();

    const byAnimal = new Map<string, AgendaItem>();

    for (const item of items) {
      if (!item.animal_id) continue;
      const current = byAnimal.get(item.animal_id);
      if (!current || item.data_prevista < current.data_prevista) {
        byAnimal.set(item.animal_id, item);
      }
    }

    const protocolItemIds = Array.from(
      new Set(
        Array.from(byAnimal.values())
          .map((item) => item.protocol_item_version_id)
          .filter((value): value is string => typeof value === "string" && value.length > 0),
      ),
    );
    const protocolItems =
      protocolItemIds.length > 0
        ? await db.state_protocolos_sanitarios_itens.bulkGet(protocolItemIds)
        : [];
    const protocolItemById = new Map(
      protocolItems
        .filter((item): item is NonNullable<(typeof protocolItems)[number]> => Boolean(item))
        .map((item) => [item.id, item]),
    );

    return Array.from(byAnimal.entries()).map(
      ([animalId, item]): AnimalNextAgendaSummary => {
        const protocolItem =
          item.protocol_item_version_id
            ? protocolItemById.get(item.protocol_item_version_id) ?? null
            : null;
        const scheduleMeta = resolveSanitaryAgendaItemScheduleMeta(
          item,
          protocolItem,
        );

        return {
          animalId,
          titulo: formatAgendaTitle(item),
          data: item.data_prevista,
          status:
            item.data_prevista < todayKey
              ? "atrasado"
              : item.data_prevista === todayKey
                ? "hoje"
                : "proximo",
          scheduleLabel: scheduleMeta?.label ?? null,
          scheduleMode: scheduleMeta?.mode ?? null,
          scheduleModeLabel: scheduleMeta?.modeLabel ?? null,
          scheduleAnchor: scheduleMeta?.anchor ?? null,
          scheduleAnchorLabel: scheduleMeta?.anchorLabel ?? null,
        };
      },
    );
  }, [activeFarmId]);
  const regulatoryReadModel =
    useLiveQuery(async () => {
      if (!activeFarmId) return EMPTY_REGULATORY_OPERATIONAL_READ_MODEL;
      return buildRegulatoryOperationalReadModel(
        await loadRegulatorySurfaceSource(activeFarmId),
      );
    }, [activeFarmId]) ?? EMPTY_REGULATORY_OPERATIONAL_READ_MODEL;

  const lotesMap = useMemo(
    () => new Map((lotes ?? []).map((lote) => [lote.id, lote])),
    [lotes],
  );
  const animaisMap = useMemo(
    () => new Map((animaisFamilia ?? []).map((animal) => [animal.id, animal])),
    [animaisFamilia],
  );
  const weightSummaryByAnimal = useMemo(
    () => new Map((weightSummaries ?? []).map((item) => [item.animalId, item])),
    [weightSummaries],
  );
  const nextAgendaByAnimal = useMemo(
    () => new Map((nextAgendaSummaries ?? []).map((item) => [item.animalId, item])),
    [nextAgendaSummaries],
  );

  const calvesByMother = useMemo(() => {
    const map = new Map<string, Animal[]>();

    for (const animal of animaisFamilia ?? []) {
      if (!animal.mae_id) continue;
      const current = map.get(animal.mae_id) ?? [];
      current.push(animal);
      map.set(animal.mae_id, current);
    }

    return map;
  }, [animaisFamilia]);

  const animais = useLiveQuery(async () => {
    let collection: Collection<Animal, string>;
    let statusHandledByIndex = false;

    if (activeFarmId) {
      if (loteFilter !== "all" && loteFilter !== "none") {
        collection = db.state_animais
          .where("[fazenda_id+lote_id]")
          .equals([activeFarmId, loteFilter]);
      } else if (statusFilter !== "all") {
        collection = db.state_animais
          .where("[fazenda_id+status]")
          .equals([activeFarmId, statusFilter]);
        statusHandledByIndex = true;
      } else {
        collection = db.state_animais.where("fazenda_id").equals(activeFarmId);
      }
    } else if (loteFilter !== "all" && loteFilter !== "none") {
      collection = db.state_animais.where("lote_id").equals(loteFilter);
    } else {
      collection = db.state_animais.toCollection();
    }

    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      collection = collection.filter((animal) =>
        animal.identificacao?.toLowerCase().includes(searchLower),
      );
    }

    if (loteFilter === "none") {
      collection = collection.filter((animal) => !animal.lote_id);
    }
    if (sexoFilter !== "all") {
      collection = collection.filter((animal) => animal.sexo === sexoFilter);
    }
    if (statusFilter !== "all" && !statusHandledByIndex) {
      collection = collection.filter((animal) => animal.status === statusFilter);
    }

    return await collection.toArray();
  }, [activeFarmId, debouncedSearch, loteFilter, sexoFilter, statusFilter]);

  const taxonomyByAnimal = useMemo(() => {
    const reproContextMap = buildAnimalTaxonomyReproContextMap(
      reproductionEvents ?? [],
    );

    return new Map(
      (animaisFamilia ?? []).map((animal) => [
        animal.id,
        deriveAnimalTaxonomy(animal, {
          config: farmLifecycleConfig,
          reproContext: reproContextMap.get(animal.id) ?? null,
        }),
      ]),
    );
  }, [animaisFamilia, farmLifecycleConfig, reproductionEvents]);
  const regulatoryProfileByAnimal = useMemo(() => {
    return new Map(
      (animaisFamilia ?? []).map((animal) => [
        animal.id,
        buildAnimalRegulatoryProfile(animal, regulatoryReadModel),
      ]),
    );
  }, [animaisFamilia, regulatoryReadModel]);

  const filteredAnimals = useMemo(() => {
    return (animais ?? []).filter((animal) => {
      const taxonomy = taxonomyByAnimal.get(animal.id);
      const regulatoryProfile = regulatoryProfileByAnimal.get(animal.id);
      if (taxonomy) {
        if (
          categoryFilter !== "all" &&
          taxonomy.categoria_zootecnica !== categoryFilter
        ) {
          return false;
        }
        if (
          productiveStateFilter !== "all" &&
          taxonomy.estado_produtivo_reprodutivo !== productiveStateFilter
        ) {
          return false;
        }
      }
      if (
        !matchesAnimalRegulatoryFilters(regulatoryProfile, {
          impact: regulatoryImpactFilter,
          subarea: regulatorySubareaFilter,
        })
      ) {
        return false;
      }
      const nextAgenda = nextAgendaByAnimal.get(animal.id);
      if (
        calendarModeFilter !== "all" &&
        nextAgenda?.scheduleMode !== calendarModeFilter
      ) {
        return false;
      }
      if (
        calendarAnchorFilter !== "all" &&
        nextAgenda?.scheduleAnchor !== calendarAnchorFilter
      ) {
        return false;
      }
      return true;
    });
  }, [
    animais,
    calendarAnchorFilter,
    calendarModeFilter,
    categoryFilter,
    productiveStateFilter,
    nextAgendaByAnimal,
    regulatoryImpactFilter,
    regulatoryProfileByAnimal,
    regulatorySubareaFilter,
    taxonomyByAnimal,
  ]);

  const animalRows = useMemo(() => {
    return buildAnimalFamilyRows(filteredAnimals, animaisFamilia ?? []);
  }, [filteredAnimals, animaisFamilia]);

  const lifecyclePendings = useMemo(() => {
    const queue = getPendingAnimalLifecycleTransitions(
      animaisFamilia ?? [],
      farmLifecycleConfig,
    );
    return new Map(queue.map((item) => [item.animalId, item]));
  }, [animaisFamilia, farmLifecycleConfig]);

  const hasFilters =
    search ||
    loteFilter !== "all" ||
    sexoFilter !== "all" ||
    statusFilter !== "ativo" ||
    categoryFilter !== "all" ||
    productiveStateFilter !== "all" ||
    calendarModeFilter !== "all" ||
    calendarAnchorFilter !== "all" ||
    regulatoryImpactFilter !== "all" ||
    regulatorySubareaFilter !== "all";

  useEffect(() => {
    setPage(1);
  }, [
    activeFarmId,
    search,
    loteFilter,
    sexoFilter,
    statusFilter,
    categoryFilter,
    productiveStateFilter,
    calendarModeFilter,
    calendarAnchorFilter,
    regulatoryImpactFilter,
    regulatorySubareaFilter,
  ]);

  const totalAnimalRows = animalRows.length;
  const totalPages = Math.max(1, Math.ceil(totalAnimalRows / ANIMAL_ROWS_PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const currentPage = Math.min(page, totalPages);
  const pageStartIndex =
    totalAnimalRows === 0 ? 0 : (currentPage - 1) * ANIMAL_ROWS_PAGE_SIZE;
  const visibleAnimalRows = useMemo(
    () =>
      animalRows.slice(
        pageStartIndex,
        pageStartIndex + ANIMAL_ROWS_PAGE_SIZE,
      ),
    [animalRows, pageStartIndex],
  );
  const firstVisibleRow = totalAnimalRows === 0 ? 0 : pageStartIndex + 1;
  const lastVisibleRow = Math.min(
    totalAnimalRows,
    pageStartIndex + visibleAnimalRows.length,
  );
  const hasPagination = totalAnimalRows > ANIMAL_ROWS_PAGE_SIZE;
  const paginationTokens = useMemo(
    () => buildPaginationTokens(currentPage, totalPages),
    [currentPage, totalPages],
  );

  function handlePageChange(nextPage: number) {
    setPage(Math.min(totalPages, Math.max(1, nextPage)));
  }

  const lifecyclePendingCount = lifecyclePendings.size;
  const lifecycleStrategicCount = useMemo(
    () =>
      Array.from(lifecyclePendings.values()).filter(
        (item) => item.queueKind === "decisao_estrategica",
      ).length,
    [lifecyclePendings],
  );
  const lifecycleBiologicalCount = lifecyclePendingCount - lifecycleStrategicCount;
  const semLoteCount = useMemo(
    () => filteredAnimals.filter((animal) => !animal.lote_id).length,
    [filteredAnimals],
  );
  const activeAnimalsCount = useMemo(
    () => (animaisFamilia ?? []).filter((animal) => animal.status === "ativo").length,
    [animaisFamilia],
  );
  const animalsWithWeightCount = useMemo(
    () =>
      animalRows.filter(({ animal }) => weightSummaryByAnimal.has(animal.id)).length,
    [animalRows, weightSummaryByAnimal],
  );
  const animalsWithNextAgendaCount = useMemo(
    () =>
      animalRows.filter(({ animal }) => nextAgendaByAnimal.has(animal.id)).length,
    [animalRows, nextAgendaByAnimal],
  );
  const agendaRadarCount = useMemo(
    () =>
      animalRows.filter(({ animal }) => {
        const nextAgenda = nextAgendaByAnimal.get(animal.id);
        return nextAgenda && nextAgenda.status !== "proximo";
      }).length,
    [animalRows, nextAgendaByAnimal],
  );
  const regulatoryImpactedAnimals = useMemo(
    () =>
      filteredAnimals.filter(
        (animal) => regulatoryProfileByAnimal.get(animal.id)?.hasIssues,
      ),
    [filteredAnimals, regulatoryProfileByAnimal],
  );
  const regulatoryBlockingAnimalsCount = useMemo(
    () =>
      regulatoryImpactedAnimals.filter(
        (animal) => regulatoryProfileByAnimal.get(animal.id)?.hasBlockingIssues,
      ).length,
    [regulatoryImpactedAnimals, regulatoryProfileByAnimal],
  );
  const regulatoryFilterLabels = useMemo(() => {
    const labels: string[] = [];

    if (regulatorySubareaFilter !== "all") {
      labels.push(getRegulatoryAnalyticsSubareaLabel(regulatorySubareaFilter));
    }
    if (regulatoryImpactFilter !== "all") {
      labels.push(getRegulatoryAnalyticsImpactLabel(regulatoryImpactFilter));
    }

    return labels;
  }, [regulatoryImpactFilter, regulatorySubareaFilter]);
  const calendarFilterLabels = useMemo(() => {
    const labels: string[] = [];

    if (calendarModeFilter !== "all") {
      labels.push(describeSanitaryCalendarMode(calendarModeFilter));
    }
    if (calendarAnchorFilter !== "all") {
      labels.push(describeSanitaryCalendarAnchor(calendarAnchorFilter) ?? "Sem ancora");
    }

    return labels;
  }, [calendarAnchorFilter, calendarModeFilter]);

  function handleExportRegulatoryCut() {
    const csv = buildAnimalRegulatoryExportCsv({
      animals: filteredAnimals,
      profilesByAnimalId: regulatoryProfileByAnimal,
      resolveLoteName: (loteId) =>
        loteId ? lotesMap.get(loteId)?.nome ?? "Lote sem nome" : "Sem lote",
      resolveCategoryLabel: (animalId) =>
        taxonomyByAnimal.get(animalId)?.display.categoria ?? "",
    });
    const blob = new Blob(["\ufeff", csv], {
      type: "text/csv;charset=utf-8",
    });

    triggerDownload(
      blob,
      buildAnimalExportFilename({
        farmId: activeFarmId,
        impact: regulatoryImpactFilter,
        subarea: regulatorySubareaFilter,
      }),
    );
  }

  if (!animais || (animais.length === 0 && !hasFilters)) {
    return (
      <div className="space-y-5">
        <PageIntro
          eyebrow="Rebanho"
          title="Animais"
          description="Cadastro e leitura operacional do rebanho, com foco em estrutura, categoria, peso e proximo passo por animal."
          actions={
            <>
              <Button asChild variant="outline">
                <Link to="/animais/importar">
                  <Upload className="h-4 w-4" />
                  Importar planilha
                </Link>
              </Button>
              <Button asChild>
                <Link to="/animais/novo">
                  <Plus className="h-4 w-4" />
                  Novo animal
                </Link>
              </Button>
            </>
          }
        />

        <EmptyState
          icon={PawPrint}
          title="Nenhum animal cadastrado"
          description="Comece cadastrando os primeiros animais da fazenda para liberar agenda, historico, peso e acompanhamento do rebanho."
          action={{
            label: "Cadastrar primeiro animal",
            onClick: () => navigate("/animais/novo"),
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageIntro
        eyebrow="Rebanho"
        title="Animais"
        description="Leitura operacional do rebanho com categoria, hierarquia materna, peso atual, ganho e proximo evento na mesma superficie."
        meta={
          <>
            <StatusBadge tone="neutral">
              {totalAnimalRows} animal(is) no recorte
            </StatusBadge>
            {hasFilters ? <StatusBadge tone="info">Filtros ativos</StatusBadge> : null}
            {hasPagination ? (
              <StatusBadge tone="neutral">
                Pagina {currentPage} de {totalPages}
              </StatusBadge>
            ) : null}
            {lifecyclePendingCount > 0 ? (
              <StatusBadge tone="warning">
                {lifecyclePendingCount} transicao(oes) pendente(s)
              </StatusBadge>
            ) : null}
            {regulatoryReadModel.hasOpenIssues ? (
              <StatusBadge
                tone={regulatoryReadModel.hasBlockingIssues ? "danger" : "warning"}
              >
                {regulatoryImpactedAnimals.length} com restricao regulatoria
              </StatusBadge>
            ) : null}
            {regulatoryFilterLabels.map((label) => (
              <StatusBadge key={label} tone="info">
                {label}
              </StatusBadge>
            ))}
            {calendarFilterLabels.map((label) => (
              <StatusBadge key={label} tone="info">
                {label}
              </StatusBadge>
            ))}
          </>
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/animais/importar">
                <Upload className="h-4 w-4" />
                Importar planilha
              </Link>
            </Button>
            <Button asChild>
              <Link to="/animais/novo">
                <Plus className="h-4 w-4" />
                Novo animal
              </Link>
            </Button>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Base ativa"
          value={activeAnimalsCount}
          hint="Animais ativos cadastrados na fazenda."
        />
        <MetricCard
          label="No recorte atual"
          value={animalRows.length}
          hint={`${animalsWithWeightCount} com pesagem registrada no recorte.`}
        />
        <MetricCard
          label="Sem lote"
          value={semLoteCount}
          hint="Animais sem lote definido continuam pedindo ajuste estrutural."
          tone={semLoteCount > 0 ? "warning" : "default"}
        />
        <MetricCard
          label="Agenda no radar"
          value={agendaRadarCount}
          hint={
            animalsWithNextAgendaCount > 0
              ? `${animalsWithNextAgendaCount} com proximo evento mapeado.`
              : "Nenhum proximo evento aberto para o recorte."
          }
          tone={agendaRadarCount > 0 ? "warning" : "info"}
          icon={<CalendarClock className="h-5 w-5" />}
        />
      </section>

      {regulatoryReadModel.hasOpenIssues ? (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardHeader>
            <CardTitle>Restricoes regulatorias no rebanho</CardTitle>
            <CardDescription>
              A mesma leitura compartilhada do overlay oficial agora tambem
              recorta a lista animal-centric e a exportacao dedicada por
              impacto operacional.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <StatusBadge
                tone={regulatoryReadModel.hasBlockingIssues ? "danger" : "warning"}
              >
                {regulatoryImpactedAnimals.length} animal(is) impactado(s)
              </StatusBadge>
              {regulatoryBlockingAnimalsCount > 0 ? (
                <StatusBadge tone="danger">
                  {regulatoryBlockingAnimalsCount} com bloqueio operacional
                </StatusBadge>
              ) : null}
              {regulatoryReadModel.analytics.subareas.map((cut) => (
                <StatusBadge key={cut.key} tone={cut.tone}>
                  {cut.label} {cut.openCount}
                </StatusBadge>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {regulatoryReadModel.analytics.impacts
                .filter((impact) => impact.totalCount > 0)
                .map((impact) => (
                  <Button
                    key={impact.key}
                    type="button"
                    size="sm"
                    variant={
                      regulatoryImpactFilter === impact.key ? "default" : "outline"
                    }
                    onClick={() => {
                      setRegulatoryImpactFilter(impact.key);
                      setRegulatorySubareaFilter("all");
                    }}
                  >
                    {impact.label}
                  </Button>
                ))}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setRegulatoryImpactFilter("all");
                  setRegulatorySubareaFilter("all");
                }}
              >
                Limpar recorte regulatorio
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleExportRegulatoryCut}
                disabled={regulatoryImpactedAnimals.length === 0}
              >
                Exportar recorte regulatorio
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/protocolos-sanitarios">Abrir overlay oficial</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link to="/eventos?dominio=conformidade">Ver historico</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Toolbar>
        <ToolbarGroup className="flex-1 gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Buscar animais por identificacao"
              placeholder="Buscar por identificacao"
              className="pl-9 bg-surface"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <Select value={loteFilter} onValueChange={setLoteFilter}>
            <SelectTrigger className="w-full sm:w-auto min-w-[140px] bg-transparent border-transparent hover:border-border hover:bg-muted/30 transition-colors">
              <SelectValue placeholder="Lote" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os lotes</SelectItem>
              <SelectItem value="none">Sem lote</SelectItem>
              {lotes?.map((lote) => (
                <SelectItem key={lote.id} value={lote.id}>
                  {lote.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sexoFilter} onValueChange={setSexoFilter}>
            <SelectTrigger className="w-full sm:w-auto min-w-[120px] bg-transparent border-transparent hover:border-border hover:bg-muted/30 transition-colors">
              <SelectValue placeholder="Sexo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ambos</SelectItem>
              <SelectItem value="M">Macho</SelectItem>
              <SelectItem value="F">Femea</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-auto min-w-[120px] bg-transparent border-transparent hover:border-border hover:bg-muted/30 transition-colors">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="vendido">Vendido</SelectItem>
              <SelectItem value="morto">Morto</SelectItem>
            </SelectContent>
          </Select>
        </ToolbarGroup>

        <ToolbarGroup className="gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-auto min-w-[140px] bg-transparent border-transparent hover:border-border hover:bg-muted/30 transition-colors">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_FILTERS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={productiveStateFilter}
            onValueChange={setProductiveStateFilter}
          >
            <SelectTrigger className="w-full sm:w-auto min-w-[160px] bg-transparent border-transparent hover:border-border hover:bg-muted/30 transition-colors">
              <SelectValue placeholder="Estado produtivo" />
            </SelectTrigger>
            <SelectContent>
              {PRODUCTIVE_STATE_FILTERS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={regulatoryImpactFilter}
            onValueChange={(value) =>
              setRegulatoryImpactFilter(value as RegulatoryImpactFilter)
            }
          >
            <SelectTrigger className="w-full sm:w-auto min-w-[180px] bg-transparent border-transparent hover:border-border hover:bg-muted/30 transition-colors">
              <SelectValue placeholder="Impacto regulatorio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo impacto regulatorio</SelectItem>
              <SelectItem value="nutrition">Nutricao</SelectItem>
              <SelectItem value="movementInternal">Movimentacao interna</SelectItem>
              <SelectItem value="sale">Venda/transito</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={regulatorySubareaFilter}
            onValueChange={(value) =>
              setRegulatorySubareaFilter(value as RegulatorySubareaFilter)
            }
          >
            <SelectTrigger className="w-full sm:w-auto min-w-[180px] bg-transparent border-transparent hover:border-border hover:bg-muted/30 transition-colors">
              <SelectValue placeholder="Subarea regulatoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as subareas</SelectItem>
              <SelectItem value="feed_ban">Feed-ban</SelectItem>
              <SelectItem value="quarentena">Quarentena</SelectItem>
              <SelectItem value="documental">Documental</SelectItem>
              <SelectItem value="agua_limpeza">Agua e limpeza</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={calendarModeFilter}
            onValueChange={(value) =>
              setCalendarModeFilter(value as AnimalCalendarModeFilter)
            }
          >
            <SelectTrigger className="w-full sm:w-auto min-w-[170px] bg-transparent border-transparent hover:border-border hover:bg-muted/30 transition-colors">
              <SelectValue placeholder="Calendario" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo calendario</SelectItem>
              <SelectItem value="campaign">Campanha</SelectItem>
              <SelectItem value="age_window">Janela etaria</SelectItem>
              <SelectItem value="rolling_interval">Recorrente</SelectItem>
              <SelectItem value="immediate">Uso imediato</SelectItem>
              <SelectItem value="clinical_protocol">Protocolo clinico</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={calendarAnchorFilter}
            onValueChange={(value) =>
              setCalendarAnchorFilter(value as AnimalCalendarAnchorFilter)
            }
          >
            <SelectTrigger className="w-full sm:w-auto min-w-[170px] bg-transparent border-transparent hover:border-border hover:bg-muted/30 transition-colors">
              <SelectValue placeholder="Ancora" />
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

          {hasFilters ? (
            <Button
              aria-label="Limpar filtros"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setLoteFilter("all");
                setSexoFilter("all");
                setStatusFilter("ativo");
                setCategoryFilter("all");
                setProductiveStateFilter("all");
                setCalendarModeFilter("all");
                setCalendarAnchorFilter("all");
                setRegulatoryImpactFilter("all");
                setRegulatorySubareaFilter("all");
              }}
            >
              <FilterX className="h-4 w-4" />
              Limpar
            </Button>
          ) : null}
        </ToolbarGroup>
      </Toolbar>

      {lifecyclePendingCount > 0 ? (
        <Card className="border-warning/20 bg-warning-muted/70 shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Transicoes de estagio no radar
            </CardTitle>
            <CardDescription>
              {lifecyclePendingCount} animal(is) com ajuste pendente. {lifecycleStrategicCount} decisao(oes) estrategica(s) e {lifecycleBiologicalCount} marco(s) biologico(s).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm">
              <Link to="/animais/transicoes">Abrir mutacao em lote</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/agenda">Cruzar com agenda</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Leitura operacional do rebanho</CardTitle>
          <CardDescription>
            A tabela prioriza categoria, localizacao, peso, ganho e proximo evento.
            Hierarquia mae &gt; cria continua visivel sem ocupar coluna exclusiva.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-col gap-2 border-b bg-muted/20 px-6 py-4 text-sm md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="font-medium text-foreground">
                {totalAnimalRows === 0
                  ? "Nenhum animal no recorte atual."
                  : `Mostrando ${firstVisibleRow}-${lastVisibleRow} de ${totalAnimalRows} animais do recorte.`}
              </p>
              <p className="text-muted-foreground">
                As metricas continuam considerando todo o recorte filtrado, nao
                apenas a pagina visivel.
              </p>
            </div>
            {hasPagination ? (
              <StatusBadge tone="neutral">
                {ANIMAL_ROWS_PAGE_SIZE} por pagina
              </StatusBadge>
            ) : null}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">Animal</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Peso atual</TableHead>
                <TableHead>Ganho</TableHead>
                <TableHead>Proximo evento</TableHead>
                <TableHead>Estagio</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Abrir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleAnimalRows.map(({ animal, depth }) => {
                const taxonomy = taxonomyByAnimal.get(animal.id);
                const categoriaLabel = taxonomy?.display.categoria ?? null;
                const mother = animal.mae_id
                  ? animaisMap.get(animal.mae_id) ?? null
                  : null;
                const calves = calvesByMother.get(animal.id) ?? [];
                const lifecyclePending = lifecyclePendings.get(animal.id);
                const weightSummary = weightSummaryByAnimal.get(animal.id);
                const nextAgenda = nextAgendaByAnimal.get(animal.id);
                const regulatoryProfile =
                  regulatoryProfileByAnimal.get(animal.id) ??
                  ({
                    animalId: animal.id,
                    restrictions: [],
                    activeSubareas: [],
                    hasIssues: false,
                    hasBlockingIssues: false,
                  } satisfies AnimalRegulatoryProfile);

                return (
                  <TableRow
                    key={animal.id}
                    className={cn(
                      depth > 0 && "bg-muted/15",
                      lifecyclePending && "bg-warning-muted/50",
                      regulatoryProfile.hasBlockingIssues && "bg-danger-muted/35",
                    )}
                  >
                    <TableCell className="align-top">
                      <div
                        className="flex items-start gap-2"
                        style={{ paddingLeft: `${depth * 18}px` }}
                      >
                        {depth > 0 ? (
                          <div className="mt-2 h-[1px] w-4 bg-border/80 shrink-0" />
                        ) : null}
                        <div className={cn("space-y-1", depth > 0 && "border-l-2 border-border/50 pl-2")}>
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              to={`/animais/${animal.id}`}
                              className="font-semibold tabular-nums text-foreground hover:text-primary hover:underline"
                            >
                              {animal.identificacao}
                            </Link>
                            {animal.nome ? (
                              <span className="text-xs text-muted-foreground">
                                {animal.nome}
                              </span>
                            ) : null}
                            {depth > 0 ? (
                              <StatusBadge tone="info">Cria</StatusBadge>
                            ) : null}
                            {depth === 0 && calves.length > 0 ? (
                              <StatusBadge tone="neutral">
                                {calves.length} cria(s)
                              </StatusBadge>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{calcularIdade(animal.data_nascimento) || "Sem idade"}</span>
                            <span>{animal.sexo === "F" ? "Femea" : "Macho"}</span>
                            {depth > 0 && mother ? (
                              <Link
                                to={`/animais/${mother.id}`}
                                className="hover:text-foreground hover:underline"
                              >
                                Abrir matriz
                              </Link>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="align-top">
                      <AnimalCategoryBadge
                        animal={animal}
                        categoriaLabel={categoriaLabel}
                      />
                    </TableCell>

                    <TableCell className="align-top">
                      {animal.lote_id ? (
                        <p className="text-sm font-medium">
                          {lotesMap.get(animal.lote_id)?.nome || "..."}
                        </p>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">
                          Sem lote
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="align-top">
                      {weightSummary ? (
                        <div className="space-y-1">
                          <p className="text-sm font-semibold tabular-nums">
                            {formatWeight(
                              weightSummary.ultimoPesoKg,
                              farmMeasurementConfig.weight_unit,
                            )}
                          </p>
                          <p className="text-xs tabular-nums text-muted-foreground">
                            {formatDate(weightSummary.ultimoPesoData)}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">
                          Sem pesagem
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="align-top">
                      {weightSummary ? (
                        <div className="space-y-1">
                          <p className="text-sm font-medium tabular-nums">
                            {formatWeightPerDay(
                              weightSummary.ganhoMedioDiaKg,
                              farmMeasurementConfig.weight_unit,
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {weightSummary.totalPesagens} pesagem(ns)
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">
                          Aguardando serie
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="align-top">
                      {nextAgenda ? (
                        <div className="space-y-1">
                          <StatusBadge tone={getAgendaTone(nextAgenda.status)}>
                            {getAgendaStatusLabel(nextAgenda.status)}
                          </StatusBadge>
                          <p className="text-sm font-medium">{nextAgenda.titulo}</p>
                          {nextAgenda.scheduleLabel ? (
                            <p className="text-xs text-muted-foreground">
                              {nextAgenda.scheduleLabel}
                            </p>
                          ) : null}
                          {nextAgenda.scheduleModeLabel ? (
                            <div className="flex flex-wrap gap-2">
                              <StatusBadge tone="info">
                                {nextAgenda.scheduleModeLabel}
                              </StatusBadge>
                              {nextAgenda.scheduleAnchorLabel ? (
                                <StatusBadge tone="neutral">
                                  {nextAgenda.scheduleAnchorLabel}
                                </StatusBadge>
                              ) : null}
                            </div>
                          ) : null}
                          <p className="text-xs text-muted-foreground">
                            {formatDate(nextAgenda.data)}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">
                          Sem agenda
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="align-top">
                      {lifecyclePending ? (
                        <div className="space-y-2">
                          <StatusBadge tone={getLifecycleTone(lifecyclePending.canAutoApply)}>
                            {getAnimalLifeStageLabel(lifecyclePending.currentStage)} para{" "}
                            {getAnimalLifeStageLabel(lifecyclePending.targetStage)}
                          </StatusBadge>
                          <p className="text-xs text-muted-foreground">
                            {getPendingAnimalLifecycleKindLabel(
                              lifecyclePending.queueKind,
                            )}
                          </p>
                        </div>
                      ) : (
                        <StatusBadge tone="neutral">
                          {getAnimalLifeStageLabel(
                            resolveAnimalLifecycleSnapshot(animal, farmLifecycleConfig)
                              .currentStage,
                          )}
                        </StatusBadge>
                      )}
                    </TableCell>

                    <TableCell className="align-top">
                      {taxonomy ? (
                        <div className="space-y-1">
                          <StatusBadge tone="neutral">
                            {taxonomy.display.estado_alias}
                          </StatusBadge>
                          {animal.status !== "ativo" ? (
                            <StatusBadge tone={animal.status === "vendido" ? "neutral" : getProductiveTone(animal.status)}>
                              {animal.status}
                            </StatusBadge>
                          ) : null}
                          {regulatoryProfile.restrictions.map((restriction) => (
                            <StatusBadge
                              key={restriction.key}
                              tone={restriction.tone}
                            >
                              {restriction.label}
                            </StatusBadge>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <StatusBadge tone={animal.status === "vendido" ? "neutral" : getProductiveTone(animal.status)}>
                            {animal.status}
                          </StatusBadge>
                          {regulatoryProfile.restrictions.map((restriction) => (
                            <StatusBadge
                              key={restriction.key}
                              tone={restriction.tone}
                            >
                              {restriction.label}
                            </StatusBadge>
                          ))}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="text-right align-top">
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/animais/${animal.id}`}>Abrir ficha</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}

              {animalRows.length === 0 && hasFilters ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-32 text-center text-muted-foreground"
                  >
                    Nenhum animal encontrado com os filtros aplicados.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>

          {hasPagination ? (
            <div className="flex flex-col gap-3 border-t px-6 py-4 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-muted-foreground">
                Exibindo {visibleAnimalRows.length} linha(s) por vez para manter a
                leitura fluida em bases grandes.
              </p>

              <Pagination className="mx-0 w-full justify-start md:w-auto md:justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      aria-disabled={currentPage === 1}
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : undefined}
                      onClick={(event) => {
                        event.preventDefault();
                        handlePageChange(currentPage - 1);
                      }}
                    />
                  </PaginationItem>

                  {paginationTokens.map((token) => (
                    <PaginationItem key={token}>
                      {typeof token === "number" ? (
                        <PaginationLink
                          href="#"
                          aria-label={`Ir para a pagina ${token}`}
                          isActive={token === currentPage}
                          onClick={(event) => {
                            event.preventDefault();
                            handlePageChange(token);
                          }}
                        >
                          {token}
                        </PaginationLink>
                      ) : (
                        <PaginationEllipsis />
                      )}
                    </PaginationItem>
                  ))}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      aria-disabled={currentPage === totalPages}
                      className={
                        currentPage === totalPages
                          ? "pointer-events-none opacity-50"
                          : undefined
                      }
                      onClick={(event) => {
                        event.preventDefault();
                        handlePageChange(currentPage + 1);
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
