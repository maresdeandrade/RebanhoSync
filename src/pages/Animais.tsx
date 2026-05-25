import { useEffect, useMemo, useState } from "react";
import { type Collection } from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CornerDownRight,
  Filter,
  FilterX,
  PawPrint,
  Plus,
  Search,
  Upload,
} from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { AnimalCategoryBadge } from "@/components/animals/AnimalCategoryBadge";
import { AnimalVisualAvatar } from "@/components/animals/AnimalVisualAvatar";
import { AnimalDemographicsCard } from "@/components/animals/AnimalDemographicsCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { useAuth } from "@/hooks/useAuth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useLotes } from "@/hooks/useLotes";
import {
  getAnimalLifeStageLabel,
  getPendingAnimalLifecycleTransitions,
} from "@/lib/animals/lifecycle";
import { buildAnimalFamilyRows } from "@/lib/animals/familyOrder";
import {
  buildAnimalTaxonomyReproContextMap,
  deriveAnimalTaxonomy,
} from "@/lib/animals/taxonomy";
import { formatWeight, formatWeightPerDay } from "@/lib/format/weight";
import { db } from "@/lib/offline/db";
import { triggerDownload } from "@/lib/offline/rejections";
import { type AgendaItem, type Animal } from "@/lib/offline/types";
import { getReproductionEventsJoined } from "@/lib/reproduction/selectors";
import {
  describeSanitaryCalendarAnchor,
  describeSanitaryCalendarMode,
  type SanitaryBaseCalendarAnchor,
  type SanitaryBaseCalendarMode,
} from "@/lib/sanitario/engine/calendar";
import { resolveSanitaryAgendaItemScheduleMeta } from "@/lib/sanitario/infrastructure/agendaSchedule";
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
} from "@/lib/sanitario/compliance/regulatoryReadModel";
import {
  buildAnimalRegulatoryExportCsv,
  buildAnimalRegulatoryProfile,
  getAnimalRegulatoryImpactLabel,
  matchesAnimalRegulatoryFilters,
  type AnimalRegulatoryProfile,
} from "@/lib/sanitario/compliance/regulatoryAnimals";
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

type FilterOption<Value extends string = string> = {
  value: Value;
  label: string;
};

const SEX_FILTERS: FilterOption[] = [
  { value: "all", label: "Ambos" },
  { value: "M", label: "Macho" },
  { value: "F", label: "Femea" },
];

const STATUS_FILTERS: FilterOption[] = [
  { value: "all", label: "Todos" },
  { value: "ativo", label: "Ativo" },
  { value: "vendido", label: "Vendido" },
  { value: "morto", label: "Morto" },
];

const REGULATORY_IMPACT_FILTERS: FilterOption<RegulatoryImpactFilter>[] = [
  { value: "all", label: "Todo impacto" },
  { value: "nutrition", label: "Nutricao" },
  { value: "movementInternal", label: "Mov. interna" },
  { value: "sale", label: "Venda/transito" },
];

const REGULATORY_SUBAREA_FILTERS: FilterOption<RegulatorySubareaFilter>[] = [
  { value: "all", label: "Todas" },
  { value: "feed_ban", label: "Feed-ban" },
  { value: "quarentena", label: "Quarentena" },
  { value: "documental", label: "Documental" },
  { value: "agua_limpeza", label: "Agua e limpeza" },
];

const CALENDAR_MODE_FILTERS: FilterOption<AnimalCalendarModeFilter>[] = [
  { value: "all", label: "Todo calendario" },
  { value: "campanha", label: "Campanha" },
  { value: "janela_etaria", label: "Janela etaria" },
  { value: "rotina_recorrente", label: "Recorrente" },
  { value: "procedimento_imediato", label: "Uso imediato" },
  { value: "nao_estruturado", label: "Nao estruturado" },
];

const CALENDAR_ANCHOR_FILTERS: FilterOption<AnimalCalendarAnchorFilter>[] = [
  { value: "all", label: "Todas" },
  { value: "nascimento", label: "Nascimento" },
  { value: "desmama", label: "Desmama" },
  { value: "parto_previsto", label: "Parto previsto" },
  { value: "entrada_fazenda", label: "Entrada" },
  { value: "movimentacao", label: "Movimentacao" },
  { value: "diagnostico_evento", label: "Diagnostico" },
  { value: "conclusao_etapa_dependente", label: "Etapa dependente" },
  { value: "ultima_conclusao_mesma_familia", label: "Ultima conclusao" },
  { value: "sem_ancora", label: "Sem ancora" },
];

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

type FilterChipGroupProps<Value extends string> = {
  label: string;
  value: Value;
  options: FilterOption<Value>[];
  onChange: (value: Value) => void;
  className?: string;
};

function FilterChipGroup<Value extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: FilterChipGroupProps<Value>) {
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = value === option.value;

          return (
            <Button
              key={option.value}
              type="button"
              variant={active ? "default" : "outline"}
              size="sm"
              aria-pressed={active}
              className={cn(
                "h-11 rounded-full px-4 text-sm font-bold",
                !active && "bg-background hover:bg-muted/70 border-border",
                active && "shadow-md"
              )}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function parseCalendarModeFilter(
  value: string | null,
): AnimalCalendarModeFilter {
  if (
    value === "campanha" ||
    value === "janela_etaria" ||
    value === "rotina_recorrente" ||
    value === "procedimento_imediato" ||
    value === "nao_estruturado"
  ) {
    return value;
  }

  return "all";
}

function parseCalendarAnchorFilter(
  value: string | null,
): AnimalCalendarAnchorFilter {
  if (
    value === "sem_ancora" ||
    value === "nascimento" ||
    value === "desmama" ||
    value === "parto_previsto" ||
    value === "entrada_fazenda" ||
    value === "movimentacao" ||
    value === "diagnostico_evento" ||
    value === "conclusao_etapa_dependente" ||
    value === "ultima_conclusao_mesma_familia"
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
  const [showFilters, setShowFilters] = useState(false);
  const [searchParams] = useSearchParams();
  const regulatoryImpactFromQuery =
    parseRegulatoryAnalyticsImpactKey(searchParams.get("overlayImpact")) ??
    "all";
  const regulatorySubareaFromQuery =
    parseRegulatoryAnalyticsSubareaKey(searchParams.get("overlaySubarea")) ??
    "all";
  const calendarModeFromQuery = parseCalendarModeFilter(
    searchParams.get("calendarMode"),
  );
  const calendarAnchorFromQuery = parseCalendarAnchorFilter(
    searchParams.get("calendarAnchor"),
  );
  const { activeFarmId, farmLifecycleConfig, farmMeasurementConfig } =
    useAuth();
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
        .filter((event) => !event.deleted_at && Boolean(event.animal_id))
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
            (new Date(ultimo.data).getTime() -
              new Date(primeiro.data).getTime()) /
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
      .filter((item) => !item.deleted_at && Boolean(item.animal_id))
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
          .filter(
            (value): value is string =>
              typeof value === "string" && value.length > 0,
          ),
      ),
    );
    const protocolItems =
      protocolItemIds.length > 0
        ? await db.state_protocolos_sanitarios_itens.bulkGet(protocolItemIds)
        : [];
    const protocolItemById = new Map(
      protocolItems
        .filter((item): item is NonNullable<(typeof protocolItems)[number]> =>
          Boolean(item),
        )
        .map((item) => [item.id, item]),
    );

    return Array.from(byAnimal.entries()).map(
      ([animalId, item]): AnimalNextAgendaSummary => {
        const protocolItem = item.protocol_item_version_id
          ? (protocolItemById.get(item.protocol_item_version_id) ?? null)
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
    () =>
      new Map((nextAgendaSummaries ?? []).map((item) => [item.animalId, item])),
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
      collection = collection.filter(
        (animal) => animal.status === statusFilter,
      );
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
  const totalPages = Math.max(
    1,
    Math.ceil(totalAnimalRows / ANIMAL_ROWS_PAGE_SIZE),
  );

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
      animalRows.slice(pageStartIndex, pageStartIndex + ANIMAL_ROWS_PAGE_SIZE),
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
  const lifecycleBiologicalCount =
    lifecyclePendingCount - lifecycleStrategicCount;
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
      labels.push(
        describeSanitaryCalendarAnchor(calendarAnchorFilter) ?? "Sem ancora",
      );
    }

    return labels;
  }, [calendarAnchorFilter, calendarModeFilter]);
  const activeFilterLabels = useMemo(() => {
    const labels: string[] = [];

    if (search) labels.push(`Busca: ${search}`);
    if (loteFilter !== "all") {
      labels.push(
        loteFilter === "none"
          ? "Sem lote"
          : (lotesMap.get(loteFilter)?.nome ?? "Lote filtrado"),
      );
    }
    if (sexoFilter !== "all")
      labels.push(sexoFilter === "M" ? "Machos" : "Femeas");
    if (statusFilter !== "ativo")
      labels.push(statusFilter === "all" ? "Todos os status" : statusFilter);
    if (categoryFilter !== "all") {
      labels.push(
        CATEGORY_FILTERS.find((item) => item.value === categoryFilter)?.label ??
          "Categoria filtrada",
      );
    }
    if (productiveStateFilter !== "all") {
      labels.push(
        PRODUCTIVE_STATE_FILTERS.find(
          (item) => item.value === productiveStateFilter,
        )?.label ?? "Estado produtivo filtrado",
      );
    }

    return [...labels, ...regulatoryFilterLabels, ...calendarFilterLabels];
  }, [
    calendarFilterLabels,
    categoryFilter,
    loteFilter,
    lotesMap,
    productiveStateFilter,
    regulatoryFilterLabels,
    search,
    sexoFilter,
    statusFilter,
  ]);

  function handleExportRegulatoryCut() {
    const csv = buildAnimalRegulatoryExportCsv({
      animals: filteredAnimals,
      profilesByAnimalId: regulatoryProfileByAnimal,
      resolveLoteName: (loteId) =>
        loteId ? (lotesMap.get(loteId)?.nome ?? "Lote sem nome") : "Sem lote",
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
          variant="plain"
          title="Animais"
          description="Lista operacional do rebanho, com filtros compactos e proximo evento em destaque."
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
          action={{
            label: "Cadastrar primeiro animal",
            onClick: () => navigate("/animais/novo"),
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageIntro
        variant="plain"
        title="Animais"
        description="Lista operacional do rebanho, com filtros compactos e proximo evento em destaque."
        meta={
          <>
            <StatusBadge tone="neutral">{animalRows.length} animais</StatusBadge>
            {lifecyclePendingCount > 0 ? (
              <StatusBadge tone="warning">
                {lifecyclePendingCount} transicao(oes)
              </StatusBadge>
            ) : null}
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

      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar animal..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-11 w-full pl-9"
            />
          </div>
          <Button
            variant="outline"
            className="min-h-11"
            aria-expanded={showFilters}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">
              {showFilters ? "Ocultar filtros" : "Mostrar filtros"}
            </span>
            <span className="sm:hidden">Filtros</span>
          </Button>
        </div>

        {activeFilterLabels.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {activeFilterLabels.map((label) => (
              <StatusBadge key={label} tone="neutral">
                {label}
              </StatusBadge>
            ))}
          </div>
        ) : null}

        {showFilters && (
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3 shadow-none">
            <div className="grid gap-3">
              <div className="grid gap-3 lg:grid-cols-[minmax(180px,220px)_1fr]">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Lote
                  </p>
                  <Select value={loteFilter} onValueChange={setLoteFilter}>
                    <SelectTrigger className="h-9 w-full bg-background">
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
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <FilterChipGroup
                    label="Sexo"
                    value={sexoFilter}
                    options={SEX_FILTERS}
                    onChange={setSexoFilter}
                  />
                  <FilterChipGroup
                    label="Status"
                    value={statusFilter}
                    options={STATUS_FILTERS}
                    onChange={setStatusFilter}
                  />
                </div>
              </div>

              <FilterChipGroup
                label="Categoria"
                value={categoryFilter}
                options={[...CATEGORY_FILTERS]}
                onChange={setCategoryFilter}
              />

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Estado produtivo
                  </p>
                  <Select
                    value={productiveStateFilter}
                    onValueChange={setProductiveStateFilter}
                  >
                    <SelectTrigger className="h-9 w-full bg-background">
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
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Impacto regulatorio
                  </p>
                  <Select
                    value={regulatoryImpactFilter}
                    onValueChange={(value) =>
                      setRegulatoryImpactFilter(value as RegulatoryImpactFilter)
                    }
                  >
                    <SelectTrigger className="h-9 w-full bg-background">
                      <SelectValue placeholder="Impacto regulatorio" />
                    </SelectTrigger>
                    <SelectContent>
                      {REGULATORY_IMPACT_FILTERS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Subarea regulatoria
                  </p>
                  <Select
                    value={regulatorySubareaFilter}
                    onValueChange={(value) =>
                      setRegulatorySubareaFilter(
                        value as RegulatorySubareaFilter,
                      )
                    }
                  >
                    <SelectTrigger className="h-9 w-full bg-background">
                      <SelectValue placeholder="Subarea regulatoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {REGULATORY_SUBAREA_FILTERS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Calendario
                  </p>
                  <Select
                    value={calendarModeFilter}
                    onValueChange={(value) =>
                      setCalendarModeFilter(value as AnimalCalendarModeFilter)
                    }
                  >
                    <SelectTrigger className="h-9 w-full bg-background">
                      <SelectValue placeholder="Calendario" />
                    </SelectTrigger>
                    <SelectContent>
                      {CALENDAR_MODE_FILTERS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Ancora
                  </p>
                  <Select
                    value={calendarAnchorFilter}
                    onValueChange={(value) =>
                      setCalendarAnchorFilter(
                        value as AnimalCalendarAnchorFilter,
                      )
                    }
                  >
                    <SelectTrigger className="h-9 w-full bg-background">
                      <SelectValue placeholder="Ancora" />
                    </SelectTrigger>
                    <SelectContent>
                      {CALENDAR_ANCHOR_FILTERS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {hasFilters ? (
                <div className="flex justify-end border-t border-border/60 pt-2">
                  <Button
                    aria-label="Limpar filtros"
                    variant="ghost"
                    size="sm"
                    className="min-h-9"
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
                    <FilterX className="mr-2 h-4 w-4" />
                    Limpar filtros
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <AnimalDemographicsCard
        animalRows={animalRows}
        taxonomyByAnimal={taxonomyByAnimal}
        sexoFilter={sexoFilter}
      />

      {lifecyclePendingCount > 0 ? (
        <Card className="border-warning/20 bg-warning-muted/70 shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Transicoes de estagio no radar
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2 pt-0">
            <StatusBadge tone="warning">
              {lifecyclePendingCount} ajuste(s)
            </StatusBadge>
            <StatusBadge tone="neutral">
              {lifecycleStrategicCount} decisao(oes)
            </StatusBadge>
            <StatusBadge tone="neutral">
              {lifecycleBiologicalCount} marco(s)
            </StatusBadge>
            <Button asChild size="sm">
              <Link to="/animais/transicoes">Abrir mutacao em lote</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/agenda">Cruzar com agenda</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden border-transparent bg-transparent shadow-none">
        <CardContent className="p-0">
          <div className="mb-3 flex flex-wrap gap-2 text-xs font-medium text-muted-foreground">
            <span>Peso atual</span>
            <span>Ganho</span>
            <span>Proximo evento</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleAnimalRows.map(({ animal, depth }) => {
              const taxonomy = taxonomyByAnimal.get(animal.id);
              const categoriaLabel = taxonomy?.display.categoria ?? null;
              const mother = animal.mae_id
                ? (animaisMap.get(animal.mae_id) ?? null)
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
                <Card
                  key={animal.id}
                  className={cn(
                    "overflow-hidden border-border/70 shadow-none transition-colors hover:border-primary/25",
                    lifecyclePending && "border-warning/30 bg-warning-muted/40",
                    regulatoryProfile.hasBlockingIssues &&
                      "border-destructive/30 bg-destructive/10",
                  )}
                >
                  <CardContent className="flex h-full flex-col gap-4 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <AnimalVisualAvatar
                          categoriaLabel={categoriaLabel}
                          sexo={animal.sexo}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <Link
                            to={`/animais/${animal.id}`}
                            className="text-lg font-semibold tabular-nums text-foreground hover:underline"
                          >
                            {animal.identificacao}
                          </Link>
                          {animal.nome ? (
                            <p className="truncate text-sm text-muted-foreground">
                              {animal.nome}
                            </p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap gap-2">
                            <AnimalCategoryBadge
                              categoriaLabel={categoriaLabel}
                            />
                            {depth > 0 ? (
                              <StatusBadge tone="info">Cria</StatusBadge>
                            ) : null}
                            {depth === 0 && calves.length > 0 ? (
                              <StatusBadge tone="neutral">
                                {calves.length} cria(s)
                              </StatusBadge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <StatusBadge
                        tone={animal.status === "ativo" ? "success" : "warning"}
                      >
                        {animal.status}
                      </StatusBadge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 border-t border-border/50 pt-3 text-sm">
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          Peso
                        </p>
                        <p className="font-semibold tabular-nums text-foreground">
                          {weightSummary
                            ? formatWeight(
                                weightSummary.ultimoPesoKg,
                                farmMeasurementConfig.weight_unit,
                              )
                            : "Sem pesagem"}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          Ganho/dia
                        </p>
                        <p className="font-semibold tabular-nums text-foreground">
                          {weightSummary
                            ? formatWeightPerDay(
                                weightSummary.ganhoMedioDiaKg,
                                farmMeasurementConfig.weight_unit,
                              )
                            : "Aguardando serie"}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          Lote
                        </p>
                        <p className="truncate font-medium text-foreground">
                          {animal.lote_id
                            ? (lotesMap.get(animal.lote_id)?.nome ?? "Lote")
                            : "Sem lote"}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          Idade
                        </p>
                        <p className="font-medium text-foreground">
                          {calcularIdade(animal.data_nascimento) || "Sem idade"}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-border/50 pt-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                          Agenda
                        </p>
                        {nextAgenda ? (
                          <StatusBadge tone={getAgendaTone(nextAgenda.status)}>
                            {getAgendaStatusLabel(nextAgenda.status)}
                          </StatusBadge>
                        ) : null}
                      </div>
                      {nextAgenda ? (
                        <div className="mt-2 space-y-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {nextAgenda.titulo}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(nextAgenda.data)}
                          </p>
                          {nextAgenda.scheduleLabel ? (
                            <p className="text-xs text-muted-foreground">
                              {nextAgenda.scheduleLabel}
                            </p>
                          ) : null}
                          <div className="flex flex-wrap gap-2">
                            {nextAgenda.scheduleModeLabel ? (
                              <StatusBadge tone="info">
                                {nextAgenda.scheduleModeLabel}
                              </StatusBadge>
                            ) : null}
                            {nextAgenda.scheduleAnchorLabel ? (
                              <StatusBadge tone="neutral">
                                {nextAgenda.scheduleAnchorLabel}
                              </StatusBadge>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Sem agenda aberta.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {lifecyclePending ? (
                        <StatusBadge
                          tone={getLifecycleTone(lifecyclePending.canAutoApply)}
                        >
                          {getAnimalLifeStageLabel(
                            lifecyclePending.currentStage,
                          )}{" "}
                          para{" "}
                          {getAnimalLifeStageLabel(
                            lifecyclePending.targetStage,
                          )}
                        </StatusBadge>
                      ) : taxonomy ? (
                        <StatusBadge tone="neutral">
                          {taxonomy.display.estado_alias}
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
                      {depth > 0 && mother ? (
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                        >
                          <Link to={`/animais/${mother.id}`}>Abrir matriz</Link>
                        </Button>
                      ) : null}
                    </div>

                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="mt-auto min-h-10 w-full"
                    >
                      <Link to={`/animais/${animal.id}`}>
                        Abrir ficha do animal
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
            {animalRows.length === 0 && hasFilters ? (
              <div className="rounded-lg border bg-card py-8 text-center text-muted-foreground md:col-span-2 xl:col-span-3">
                Nenhum animal encontrado com os filtros aplicados.
              </div>
            ) : null}
          </div>

          {hasPagination ? (
            <div className="flex flex-col gap-3 border-t px-6 py-4 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-muted-foreground">
                Exibindo {visibleAnimalRows.length} linha(s) por vez para manter
                a leitura fluida em bases grandes.
              </p>

              <Pagination className="mx-0 w-full justify-start md:w-auto md:justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      aria-disabled={currentPage === 1}
                      className={
                        currentPage === 1
                          ? "pointer-events-none opacity-50"
                          : undefined
                      }
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


