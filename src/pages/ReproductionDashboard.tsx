import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Baby,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Dna,
  HeartPulse,
  History,
  ListTodo,
  Search,
} from "lucide-react";
import { db } from "@/lib/offline/db";
import { useAuth } from "@/hooks/useAuth";
import { isFemaleReproductionEligible } from "@/lib/animals/presentation";
import { classificarAnimal, getLabelCategoria } from "@/lib/domain/categorias";
import {
  getReproductionEventsJoined,
  type ReproEventJoined,
} from "@/lib/reproduction/selectors";
import {
  buildReproductionDashboard,
  type ReproActionUrgency,
  type ReproCycleLane,
  type ReproDashboardAnimal,
  type ReproDashboardFilter,
} from "@/lib/reproduction/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const FILTERS: Array<{
  key: ReproDashboardFilter;
  label: string;
}> = [
  { key: "todas", label: "Todas" },
  { key: "atencao", label: "Em atencao" },
  { key: "vazias", label: "Vazias / abertas" },
  { key: "servidas", label: "Servidas" },
  { key: "prenhas", label: "Prenhas" },
  { key: "paridas", label: "Paridas" },
];

const LANE_META: Record<
  ReproCycleLane,
  {
    label: string;
    helper: string;
    cardClassName: string;
  }
> = {
  vazias: {
    label: "Vazias / abertas",
    helper: "Femeas aptas para cobertura ou IA.",
    cardClassName: "border-slate-200 bg-slate-50/80",
  },
  servidas: {
    label: "Servidas",
    helper: "Cobertas ou inseminadas, aguardando diagnostico.",
    cardClassName: "border-amber-200 bg-amber-50/80",
  },
  prenhas: {
    label: "Prenhas",
    helper: "Diagnostico positivo com parto no radar.",
    cardClassName: "border-emerald-200 bg-emerald-50/80",
  },
  paridas: {
    label: "Paridas",
    helper: "Puerperio e retorno ao ciclo apos parto.",
    cardClassName: "border-sky-200 bg-sky-50/80",
  },
};

const STATUS_BADGE_CLASSNAME: Record<string, string> = {
  VAZIA: "border-slate-300 text-slate-700",
  SERVIDA: "border-amber-200 bg-amber-100 text-amber-800",
  PRENHA: "border-emerald-200 bg-emerald-100 text-emerald-800",
  PARIDA_PUERPERIO: "border-sky-200 bg-sky-100 text-sky-800",
  PARIDA_ABERTA: "border-indigo-200 bg-indigo-100 text-indigo-800",
};

const STATUS_LABEL: Record<string, string> = {
  VAZIA: "Vazia / aberta",
  SERVIDA: "Servida",
  PRENHA: "Prenha",
  PARIDA_PUERPERIO: "Parida em puerperio",
  PARIDA_ABERTA: "Parida e aberta",
};

const URGENCY_META: Record<
  ReproActionUrgency,
  {
    label: string;
    badgeClassName: string;
  }
> = {
  atencao: {
    label: "Em atencao",
    badgeClassName: "border-red-200 bg-red-100 text-red-800",
  },
  planejado: {
    label: "Planejado",
    badgeClassName: "border-amber-200 bg-amber-100 text-amber-800",
  },
  estavel: {
    label: "Estavel",
    badgeClassName: "border-slate-300 text-slate-700",
  },
};

function matchesFilter(
  animal: ReproDashboardAnimal,
  filter: ReproDashboardFilter,
): boolean {
  if (filter === "todas") return true;
  if (filter === "atencao") return animal.urgency === "atencao";
  return animal.lane === filter;
}

function formatDate(date: string | null) {
  if (!date) return "Sem data prevista";
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR");
}

function formatTimelineTitle(event: ReproEventJoined) {
  if (!event.details) return "Registro reprodutivo";

  switch (event.details.tipo) {
    case "cobertura":
      return "Cobertura";
    case "IA":
      return "Inseminacao artificial";
    case "diagnostico":
      return "Diagnostico de prenhez";
    case "parto":
      return "Parto";
    default:
      return "Registro reprodutivo";
  }
}

function formatTimelineDetail(event: ReproEventJoined) {
  if (!event.details) return event.observacoes ?? "Sem detalhe adicional.";

  const payload =
    event.details.payload && typeof event.details.payload === "object"
      ? (event.details.payload as Record<string, unknown>)
      : {};

  const detailParts: string[] = [];
  const resultado =
    typeof payload.resultado === "string"
      ? payload.resultado
      : typeof payload.diagnostico_resultado === "string"
        ? payload.diagnostico_resultado
        : null;
  const numeroCrias =
    typeof payload.numero_crias === "number" ? payload.numero_crias : null;

  if (event.details.macho_id) {
    detailParts.push(`Reprodutor ${event.details.macho_id.slice(0, 8)}`);
  }
  if (resultado) {
    detailParts.push(`Resultado ${resultado}`);
  }
  if (numeroCrias) {
    detailParts.push(`${numeroCrias} cria(s)`);
  }
  if (typeof payload.data_prevista_parto === "string") {
    detailParts.push(`Parto previsto ${formatDate(payload.data_prevista_parto)}`);
  }

  return detailParts.join(" · ") || event.observacoes || "Sem detalhe adicional.";
}

function FocusCard({
  title,
  value,
  helper,
  filter,
  activeFilter,
  onSelect,
}: {
  title: string;
  value: number;
  helper: string;
  filter: ReproDashboardFilter;
  activeFilter: ReproDashboardFilter;
  onSelect: (filter: ReproDashboardFilter) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(filter)}
      className={cn(
        "rounded-xl border p-4 text-left transition-colors hover:bg-muted/40",
        activeFilter === filter && "border-primary bg-primary/5",
      )}
    >
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
    </button>
  );
}

export default function ReproductionDashboard() {
  const { activeFarmId } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] =
    useState<ReproDashboardFilter>("todas");
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(null);

  const reproductionData = useLiveQuery(
    async () => {
      if (!activeFarmId) return null;

      const [animals, lotes, events, categorias] = await Promise.all([
        db.state_animais
          .where("fazenda_id")
          .equals(activeFarmId)
          .and(
            (animal) =>
              animal.sexo === "F" &&
              animal.status === "ativo" &&
              (!animal.deleted_at || animal.deleted_at === null),
          )
          .toArray(),
        db.state_lotes.where("fazenda_id").equals(activeFarmId).toArray(),
        getReproductionEventsJoined(activeFarmId),
        db.state_categorias_zootecnicas
          .where("fazenda_id")
          .equals(activeFarmId)
          .filter((categoria) => !categoria.deleted_at && categoria.ativa)
          .toArray(),
      ]);

      const eligibleAnimals = animals.filter((animal) => {
        const categoriaAtual = classificarAnimal(animal, categorias);
        const categoriaLabel = categoriaAtual
          ? getLabelCategoria(categoriaAtual)
          : null;
        return isFemaleReproductionEligible(animal, categoriaLabel);
      });

      return {
        dashboard: buildReproductionDashboard({
          animals: eligibleAnimals,
          lotes,
          events,
        }),
        events,
      };
    },
    [activeFarmId],
  );

  const dashboardData = reproductionData?.dashboard ?? null;

  const filteredAnimals = useMemo(() => {
    if (!dashboardData) return [];

    return dashboardData.animals.filter((animal) => {
      const normalizedSearch = searchTerm.trim().toLowerCase();
      const matchesSearch =
        normalizedSearch.length === 0 ||
        animal.identificacao.toLowerCase().includes(normalizedSearch) ||
        (animal.nome?.toLowerCase().includes(normalizedSearch) ?? false) ||
        (animal.loteNome?.toLowerCase().includes(normalizedSearch) ?? false);

      return matchesSearch && matchesFilter(animal, activeFilter);
    });
  }, [activeFilter, dashboardData, searchTerm]);

  useEffect(() => {
    if (filteredAnimals.length === 0) {
      setSelectedAnimalId(null);
      return;
    }

    if (
      selectedAnimalId &&
      filteredAnimals.some((animal) => animal.id === selectedAnimalId)
    ) {
      return;
    }

    const preferredAnimal =
      filteredAnimals.find((animal) => animal.urgency === "atencao") ??
      filteredAnimals[0];

    setSelectedAnimalId(preferredAnimal.id);
  }, [filteredAnimals, selectedAnimalId]);

  const historyByAnimal = useMemo(() => {
    const grouped = new Map<string, ReproEventJoined[]>();

    for (const event of reproductionData?.events ?? []) {
      if (!event.animal_id) continue;

      const current = grouped.get(event.animal_id) ?? [];
      current.push(event);
      grouped.set(event.animal_id, current);
    }

    for (const [animalId, history] of grouped.entries()) {
      grouped.set(
        animalId,
        [...history].sort((left, right) => right.occurred_at.localeCompare(left.occurred_at)),
      );
    }

    return grouped;
  }, [reproductionData]);

  const selectedAnimal =
    filteredAnimals.find((animal) => animal.id === selectedAnimalId) ?? null;
  const selectedHistory = selectedAnimalId
    ? historyByAnimal.get(selectedAnimalId) ?? []
    : [];
  const visibleAnimalIds = new Set(filteredAnimals.map((animal) => animal.id));
  const visibleAgenda = dashboardData
    ? dashboardData.agenda.filter((item) => visibleAnimalIds.has(item.animalId))
    : [];

  if (!activeFarmId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Selecione uma fazenda</CardTitle>
          <CardDescription>
            O painel reprodutivo depende de uma fazenda ativa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/select-fazenda">Escolher fazenda</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!dashboardData) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Carregando ciclo reprodutivo</CardTitle>
            <CardDescription>
              Buscando femeas ativas, historico reprodutivo e proximos marcos.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border bg-gradient-to-br from-amber-50 via-white to-sky-50 p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Area dedicada</Badge>
              <Badge variant="outline">Ciclo reprodutivo</Badge>
              {dashboardData.totals.atencao > 0 && (
                <Badge className="border-red-200 bg-red-100 text-red-800">
                  {dashboardData.totals.atencao} ponto(s) em atencao
                </Badge>
              )}
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Reproducao das matrizes
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Painel proprio para acompanhar cobertura, IA, diagnostico,
                prenhez, parto e retorno ao ciclo, com foco em proximo passo
                por animal.
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <Button asChild className="justify-start">
              <Link to="/registrar?dominio=reproducao&reproTipo=cobertura">
                <Dna className="h-4 w-4" />
                Cobertura / IA
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/registrar?dominio=reproducao&reproTipo=diagnostico">
                <HeartPulse className="h-4 w-4" />
                Diagnostico
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link to="/registrar?dominio=reproducao&reproTipo=parto">
                <Baby className="h-4 w-4" />
                Parto
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Femeas ativas</CardDescription>
            <CardTitle>{dashboardData.totals.femeasAtivas}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Servidas</CardDescription>
            <CardTitle>{dashboardData.totals.servidas}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Prenhas</CardDescription>
            <CardTitle>{dashboardData.totals.prenhas}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Paridas</CardDescription>
            <CardTitle>{dashboardData.totals.paridas}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Vazias / abertas</CardDescription>
            <CardTitle>{dashboardData.totals.abertas}</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Etapas do ciclo</CardTitle>
            <CardDescription>
              Use as etapas para filtrar rapidamente as matrizes por momento do
              ciclo reprodutivo.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {(Object.keys(LANE_META) as ReproCycleLane[]).map((lane) => {
              const meta = LANE_META[lane];
              const count = dashboardData.animals.filter(
                (animal) => animal.lane === lane,
              ).length;

              return (
                <button
                  key={lane}
                  type="button"
                  onClick={() => setActiveFilter(lane)}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition-colors",
                    meta.cardClassName,
                    activeFilter === lane && "border-primary ring-1 ring-primary/20",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-muted-foreground">{meta.label}</p>
                      <p className="mt-2 text-3xl font-semibold">{count}</p>
                    </div>
                    <CircleDot className="h-5 w-5 text-primary" />
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {meta.helper}
                  </p>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Em foco agora</CardTitle>
            <CardDescription>
              Pendencias e proximos marcos que pedem acompanhamento dedicado.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <FocusCard
              title="Diagnosticos pendentes"
              value={dashboardData.focus.diagnosticosPendentes}
              helper="Servidas cujo diagnostico ja deveria estar registrado."
              filter="atencao"
              activeFilter={activeFilter}
              onSelect={setActiveFilter}
            />
            <FocusCard
              title="Partos proximos"
              value={dashboardData.focus.partosProximos}
              helper="Prenhas com parto previsto nas proximas semanas."
              filter="prenhas"
              activeFilter={activeFilter}
              onSelect={setActiveFilter}
            />
            <FocusCard
              title="Puerperio ativo"
              value={dashboardData.focus.puerperioAtivo}
              helper="Paridas recentes que ainda pedem acompanhamento."
              filter="paridas"
              activeFilter={activeFilter}
              onSelect={setActiveFilter}
            />
            <FocusCard
              title="Femeas aptas"
              value={dashboardData.focus.femeasAptas}
              helper="Vazias ou abertas, prontas para nova cobertura."
              filter="vazias"
              activeFilter={activeFilter}
              onSelect={setActiveFilter}
            />
          </CardContent>
        </Card>
      </section>

      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Acompanhamento por animal</h2>
            <p className="text-sm text-muted-foreground">
              Cada card resume o ponto do ciclo, o ultimo marco registrado e a
              acao recomendada.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 lg:max-w-xl lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-9"
                placeholder="Buscar por identificacao, nome ou lote"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((filter) => (
                <Button
                  key={filter.key}
                  type="button"
                  variant={activeFilter === filter.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveFilter(filter.key)}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {filteredAnimals.length === 0 ? (
            <Card className="border-dashed lg:col-span-2">
              <CardHeader>
                <CardTitle>Nenhuma matriz encontrada</CardTitle>
                <CardDescription>
                  Ajuste o filtro atual ou traga o rebanho inicial para comecar o
                  acompanhamento reprodutivo.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 sm:flex-row">
                <Button asChild>
                  <Link to="/animais/importar">Importar animais</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/registrar?dominio=reproducao&reproTipo=cobertura">
                    Registrar primeira cobertura
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            filteredAnimals.map((animal) => {
              const urgencyMeta = URGENCY_META[animal.urgency];

              return (
                <Card key={animal.id} className="overflow-hidden">
                  <CardHeader className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-xl">
                            {animal.identificacao}
                          </CardTitle>
                          <Badge
                            variant="outline"
                            className={STATUS_BADGE_CLASSNAME[animal.reproStatus.status]}
                          >
                            {STATUS_LABEL[animal.reproStatus.status]}
                          </Badge>
                        </div>
                        <CardDescription>
                          {animal.nome ?? "Matriz sem nome"} ·{" "}
                          {animal.loteNome ?? "Sem lote definido"}
                        </CardDescription>
                      </div>

                      <Badge
                        variant="outline"
                        className={urgencyMeta.badgeClassName}
                      >
                        {urgencyMeta.label}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border bg-muted/30 p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Ultimo marco
                        </p>
                        <p className="mt-2 text-base font-medium">
                          {animal.lastEventLabel}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {animal.lastEventDateLabel
                            ? formatDate(animal.lastEventDateLabel)
                            : "Sem data registrada"}
                        </p>
                      </div>

                      <div className="rounded-xl border bg-muted/30 p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Proximo passo
                        </p>
                        <p className="mt-2 text-base font-medium">
                          {animal.nextActionLabel}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatDate(animal.nextActionDate)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm">
                        <Link to={animal.actionHref}>
                          <CalendarClock className="h-4 w-4" />
                          {animal.actionLabel}
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/animais/${animal.id}`}>
                          <CheckCircle2 className="h-4 w-4" />
                          Ver historico
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedAnimalId(animal.id)}
                      >
                        <History className="h-4 w-4" />
                        Ver timeline
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-primary" />
              <CardTitle>Agenda reprodutiva automatica</CardTitle>
            </div>
            <CardDescription>
              Lista derivada do estagio atual de cada matriz, sem depender de
              cadastro manual para mostrar o proximo passo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {visibleAgenda.length === 0 ? (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                Nenhuma recomendacao encontrada para o filtro atual.
              </div>
            ) : (
              visibleAgenda.slice(0, 12).map((item) => {
                const urgencyMeta = URGENCY_META[item.urgency];

                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 rounded-xl border p-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{item.title}</p>
                        <Badge
                          variant="outline"
                          className={urgencyMeta.badgeClassName}
                        >
                          {urgencyMeta.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {item.animalIdentificacao} · {item.helper}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(item.date)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedAnimalId(item.animalId)}
                      >
                        <History className="h-4 w-4" />
                        Focar matriz
                      </Button>
                      <Button asChild size="sm">
                        <Link to={item.actionHref}>
                          {item.actionLabel}
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              <CardTitle>Timeline da matriz em foco</CardTitle>
            </div>
            <CardDescription>
              Historico cronologico para acompanhar a sequencia real do ciclo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedAnimal ? (
              <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                Selecione uma matriz nos cards acima para abrir a timeline.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border bg-muted/30 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold">
                      {selectedAnimal.identificacao}
                    </p>
                    <Badge
                      variant="outline"
                      className={
                        STATUS_BADGE_CLASSNAME[selectedAnimal.reproStatus.status]
                      }
                    >
                      {STATUS_LABEL[selectedAnimal.reproStatus.status]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selectedAnimal.loteNome ?? "Sem lote definido"} · proximo
                    passo: {selectedAnimal.nextActionLabel}
                  </p>
                </div>

                <div className="space-y-4 border-l pl-4">
                  {selectedHistory.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      Sem eventos reprodutivos registrados para esta matriz.
                    </div>
                  ) : (
                    selectedHistory.map((event) => (
                      <div key={event.id} className="relative space-y-1">
                        <div className="absolute -left-[1.35rem] top-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">
                            {formatTimelineTitle(event)}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {new Date(event.occurred_at).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {formatTimelineDetail(event)}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link to={selectedAnimal.actionHref}>
                      {selectedAnimal.actionLabel}
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/animais/${selectedAnimal.id}`}>
                      Abrir ficha completa
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
          <div className="space-y-1">
            <h2 className="font-semibold">Leitura do ciclo</h2>
            <p className="text-sm text-muted-foreground">
              O painel usa o historico de eventos de reproducao ja registrado no
              app para classificar as matrizes em vazias, servidas, prenhas e
              paridas. O valor operacional vem do proximo passo recomendado, nao
              apenas do status.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
