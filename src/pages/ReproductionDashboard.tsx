import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Baby,
  CalendarClock,
  CheckCircle2,
  Dna,
  HeartPulse,
  History,
  ListTodo,
  MoreHorizontal,
  Search,
  type LucideIcon,
} from "lucide-react";

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
import { StatusBadge } from "@/components/ui/status-badge";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import { useAuth } from "@/hooks/useAuth";
import { deriveAnimalTaxonomy } from "@/lib/animals/taxonomy";
import {
  getAnimalLifeStageLabel,
  getPendingAnimalLifecycleKindLabel,
  getPendingAnimalLifecycleTransitions,
  summarizePendingAnimalLifecycleTransitions,
} from "@/lib/animals/lifecycle";
import { isFemaleReproductionEligible } from "@/lib/animals/presentation";
import { db } from "@/lib/offline/db";
import {
  buildReproductionDashboard,
  type ReproActionUrgency,
  type ReproDashboardAnimal,
  type ReproDashboardFilter,
} from "@/lib/reproduction/dashboard";
import {
  getReproductionEventsJoined,
  type ReproEventJoined,
} from "@/lib/reproduction/selectors";
import { cn } from "@/lib/utils";

const FILTERS: Array<{ key: ReproDashboardFilter; label: string }> = [
  { key: "todas", label: "Todas" },
  { key: "atencao", label: "Em atencao" },
  { key: "vazias", label: "Vazias / abertas" },
  { key: "servidas", label: "Servidas" },
  { key: "prenhas", label: "Prenhas" },
  { key: "paridas", label: "Paridas" },
];

const STATUS_LABEL: Record<string, string> = {
  VAZIA: "Vazia / aberta",
  SERVIDA: "Servida",
  PRENHA: "Prenha",
  PARIDA_PUERPERIO: "Parida em puerperio",
  PARIDA_ABERTA: "Parida e aberta",
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

  return detailParts.join(" | ") || event.observacoes || "Sem detalhe adicional.";
}

function getStatusTone(status: string) {
  if (status === "PRENHA") return "success";
  if (status === "SERVIDA") return "info";
  if (status.startsWith("PARIDA")) return "warning";
  return "neutral";
}

function getUrgencyTone(urgency: ReproActionUrgency) {
  if (urgency === "atencao") return "warning";
  if (urgency === "planejado") return "info";
  return "neutral";
}

function FocusMetric({
  title,
  value,
  helper,
  active,
  onClick,
}: {
  title: string;
  value: number;
  helper: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-2 text-3xl font-semibold tracking-[-0.02em]">{value}</p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{helper}</p>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "app-surface-muted w-full p-4 text-left transition-colors",
          active && "border-primary/30 bg-primary/5",
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "app-surface-muted w-full p-4 text-left transition-colors",
        active && "border-primary/30 bg-primary/5",
      )}
    >
      {content}
    </div>
  );
}

function EmptyMessage({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 p-5 text-sm text-muted-foreground">
      <div className="flex items-start gap-3">
        {Icon ? <Icon className="mt-0.5 h-4 w-4" /> : null}
        <div className="space-y-2">
          <p className="font-medium text-foreground">{title}</p>
          <p className="leading-6">{description}</p>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </div>
    </div>
  );
}

export default function ReproductionDashboard() {
  const { activeFarmId, farmLifecycleConfig } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] =
    useState<ReproDashboardFilter>("todas");
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(null);

  const reproductionData = useLiveQuery(
    async () => {
      if (!activeFarmId) return null;

      const [animals, lotes, events] = await Promise.all([
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
      ]);

      const eligibleAnimals = animals.filter((animal) => {
        const categoriaLabel = deriveAnimalTaxonomy(animal, {
          config: farmLifecycleConfig,
        }).display.categoria;
        return isFemaleReproductionEligible(animal, categoriaLabel);
      });

      return {
        dashboard: buildReproductionDashboard({
          animals: eligibleAnimals,
          lotes,
          events,
        }),
        events,
        eligibleAnimals,
      };
    },
    [activeFarmId, farmLifecycleConfig],
  );

  const dashboardData = reproductionData?.dashboard ?? null;
  const lifecycleQueue = useMemo(() => {
    if (!reproductionData?.eligibleAnimals) return [];
    return getPendingAnimalLifecycleTransitions(
      reproductionData.eligibleAnimals,
      farmLifecycleConfig,
    );
  }, [farmLifecycleConfig, reproductionData?.eligibleAnimals]);
  const lifecycleSummary = useMemo(
    () => summarizePendingAnimalLifecycleTransitions(lifecycleQueue),
    [lifecycleQueue],
  );
  const lifecycleByAnimal = useMemo(
    () => new Map(lifecycleQueue.map((item) => [item.animalId, item])),
    [lifecycleQueue],
  );

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
        [...history].sort((left, right) =>
          right.occurred_at.localeCompare(left.occurred_at),
        ),
      );
    }

    return grouped;
  }, [reproductionData]);

  const selectedAnimal =
    filteredAnimals.find((animal) => animal.id === selectedAnimalId) ?? null;
  const selectedLifecyclePending = selectedAnimalId
    ? lifecycleByAnimal.get(selectedAnimalId) ?? null
    : null;
  const selectedHistory = selectedAnimalId
    ? historyByAnimal.get(selectedAnimalId) ?? []
    : [];
  const visibleAnimalIds = new Set(filteredAnimals.map((animal) => animal.id));
  const visibleAgenda = dashboardData
    ? dashboardData.agenda.filter((item) => visibleAnimalIds.has(item.animalId))
    : [];
  const filterCounts = useMemo(() => {
    if (!dashboardData) return new Map<ReproDashboardFilter, number>();

    return new Map<ReproDashboardFilter, number>([
      ["todas", dashboardData.animals.length],
      ["atencao", dashboardData.totals.atencao],
      [
        "vazias",
        dashboardData.animals.filter((animal) => animal.lane === "vazias").length,
      ],
      [
        "servidas",
        dashboardData.animals.filter((animal) => animal.lane === "servidas").length,
      ],
      [
        "prenhas",
        dashboardData.animals.filter((animal) => animal.lane === "prenhas").length,
      ],
      [
        "paridas",
        dashboardData.animals.filter((animal) => animal.lane === "paridas").length,
      ],
    ]);
  }, [dashboardData]);

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
      <Card>
        <CardHeader>
          <CardTitle>Carregando ciclo reprodutivo</CardTitle>
          <CardDescription>
            Buscando femeas ativas, historico reprodutivo e proximos marcos.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <PageIntro
        eyebrow="Ciclo reprodutivo"
        title="Reproducao das matrizes"
        description="Painel operacional para acompanhar servico, diagnostico, prenhez, parto e retorno ao ciclo com foco no proximo passo por animal."
        meta={
          <>
            <StatusBadge tone="neutral">
              {dashboardData.totals.femeasAtivas} femeas acompanhadas
            </StatusBadge>
            {dashboardData.totals.atencao > 0 ? (
              <StatusBadge tone="warning">
                {dashboardData.totals.atencao} ponto(s) em atencao
              </StatusBadge>
            ) : (
              <StatusBadge tone="success">Fluxo sob controle</StatusBadge>
            )}
          </>
        }
        actions={
          <>
            <Button asChild>
              <Link to="/registrar?dominio=reproducao&reproTipo=cobertura">
                <Dna className="h-4 w-4" />
                Cobertura / IA
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/registrar?dominio=reproducao&reproTipo=diagnostico">
                <HeartPulse className="h-4 w-4" />
                Diagnostico
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/registrar?dominio=reproducao&reproTipo=parto">
                <Baby className="h-4 w-4" />
                Parto
              </Link>
            </Button>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Femeas ativas"
          value={dashboardData.totals.femeasAtivas}
          hint="Base apta para leitura do ciclo."
        />
        <MetricCard
          label="Servidas"
          value={dashboardData.totals.servidas}
          hint="Aguardando diagnostico."
          tone="info"
        />
        <MetricCard
          label="Prenhas"
          value={dashboardData.totals.prenhas}
          hint="Com parto no radar."
          tone="success"
        />
        <MetricCard
          label="Paridas"
          value={dashboardData.totals.paridas}
          hint="Puerperio e retorno ao ciclo."
          tone="warning"
        />
        <MetricCard
          label="Vazias / abertas"
          value={dashboardData.totals.abertas}
          hint="Prontas para nova cobertura."
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Acompanhamento por animal</CardTitle>
            <CardDescription>
              Uma leitura compacta do ciclo com busca, filtro e proximo passo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Toolbar className="border-0 bg-transparent p-0 shadow-none">
              <ToolbarGroup className="flex-1">
                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="pl-9"
                    placeholder="Buscar por identificacao, nome ou lote"
                  />
                </div>
              </ToolbarGroup>
              <ToolbarGroup className="gap-2">
                {FILTERS.map((filter) => (
                  <Button
                    key={filter.key}
                    type="button"
                    variant={activeFilter === filter.key ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveFilter(filter.key)}
                  >
                    <span>{filter.label}</span>
                    <span className="ml-1 text-xs opacity-80">
                      {filterCounts.get(filter.key) ?? 0}
                    </span>
                  </Button>
                ))}
              </ToolbarGroup>
            </Toolbar>

            {filteredAnimals.length === 0 ? (
              <EmptyMessage
                title="Nenhuma matriz encontrada"
                description="Ajuste o filtro atual ou traga o rebanho inicial para comecar o acompanhamento reprodutivo."
                actions={
                  <>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/animais/importar">Importar animais</Link>
                    </Button>
                    <Button asChild size="sm">
                      <Link to="/registrar?dominio=reproducao&reproTipo=cobertura">
                        Registrar primeira cobertura
                      </Link>
                    </Button>
                  </>
                }
              />
            ) : (
              <div className="space-y-3">
                {filteredAnimals.map((animal) => {
                  const lifecyclePending = lifecycleByAnimal.get(animal.id);
                  const isSelected = animal.id === selectedAnimalId;

                  return (
                    <article
                      key={animal.id}
                      className={cn(
                        "rounded-2xl border border-border/70 bg-muted/30 p-4 transition-colors",
                        isSelected && "border-primary/30 bg-primary/5",
                      )}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-semibold tracking-[-0.01em]">
                              {animal.identificacao}
                            </p>
                            <StatusBadge tone={getStatusTone(animal.reproStatus.status)}>
                              {STATUS_LABEL[animal.reproStatus.status]}
                            </StatusBadge>
                            <StatusBadge tone={getUrgencyTone(animal.urgency)}>
                              {animal.urgency === "atencao"
                                ? "Em atencao"
                                : animal.urgency === "planejado"
                                  ? "Planejado"
                                  : "Estavel"}
                            </StatusBadge>
                            {lifecyclePending ? (
                              <StatusBadge
                                tone={
                                  lifecyclePending.queueKind === "decisao_estrategica"
                                    ? "warning"
                                    : "info"
                                }
                              >
                                {getPendingAnimalLifecycleKindLabel(
                                  lifecyclePending.queueKind,
                                )}
                              </StatusBadge>
                            ) : null}
                          </div>

                          <p className="text-sm text-muted-foreground">
                            {animal.nome ?? "Matriz sem nome"} |{" "}
                            {animal.loteNome ?? "Sem lote definido"}
                          </p>

                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                Ultimo marco
                              </p>
                              <p className="mt-2 font-medium">{animal.lastEventLabel}</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {animal.lastEventDateLabel
                                  ? formatDate(animal.lastEventDateLabel)
                                  : "Sem data registrada"}
                              </p>
                            </div>

                            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                Proximo passo
                              </p>
                              <p className="mt-2 font-medium">{animal.nextActionLabel}</p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {formatDate(animal.nextActionDate)}
                              </p>
                            </div>
                          </div>

                          {lifecyclePending ? (
                            <p className="text-sm leading-6 text-muted-foreground">
                              {getAnimalLifeStageLabel(lifecyclePending.currentStage)} para{" "}
                              {getAnimalLifeStageLabel(lifecyclePending.targetStage)} |{" "}
                              {lifecyclePending.reason}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2">
                          <Button asChild size="sm">
                            <Link to={animal.actionHref}>
                              <CalendarClock className="h-4 w-4" />
                              {animal.actionLabel}
                            </Link>
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                aria-label={`Mais acoes para ${animal.identificacao}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setSelectedAnimalId(animal.id)}>
                                <History className="mr-2 h-4 w-4" />
                                Focar timeline
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link to={`/animais/${animal.id}`}>
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Abrir ficha
                                </Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Em foco agora</CardTitle>
            <CardDescription>
              Pendencias e marcos que merecem acompanhamento dedicado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <FocusMetric
              title="Diagnosticos pendentes"
              value={dashboardData.focus.diagnosticosPendentes}
              helper="Servidas cujo diagnostico ja deveria estar registrado."
              active={activeFilter === "atencao"}
              onClick={() => setActiveFilter("atencao")}
            />
            <FocusMetric
              title="Partos proximos"
              value={dashboardData.focus.partosProximos}
              helper="Prenhas com parto previsto nas proximas semanas."
              active={activeFilter === "prenhas"}
              onClick={() => setActiveFilter("prenhas")}
            />
            <FocusMetric
              title="Puerperio ativo"
              value={dashboardData.focus.puerperioAtivo}
              helper="Paridas recentes que ainda pedem acompanhamento."
              active={activeFilter === "paridas"}
              onClick={() => setActiveFilter("paridas")}
            />
            <FocusMetric
              title="Femeas aptas"
              value={dashboardData.focus.femeasAptas}
              helper="Vazias ou abertas, prontas para nova cobertura."
              active={activeFilter === "vazias"}
              onClick={() => setActiveFilter("vazias")}
            />
            <FocusMetric
              title="Marcos de vida pendentes"
              value={lifecycleSummary.total}
              helper={`${lifecycleSummary.strategic} estrategica(s) e ${lifecycleSummary.biological} biologica(s) entre as femeas acompanhadas.`}
            />
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link to="/animais/transicoes">Abrir fila de estagios</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Agenda reprodutiva automatica</CardTitle>
            </div>
            <CardDescription>
              Lista derivada do estagio atual de cada matriz, sem depender de
              cadastro manual para mostrar o proximo passo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {visibleAgenda.length === 0 ? (
              <EmptyMessage
                icon={ListTodo}
                title="Nenhuma recomendacao encontrada"
                description="O filtro atual nao produziu novas recomendacoes automatizadas."
              />
            ) : (
              visibleAgenda.slice(0, 12).map((item) => {
                const lifecyclePending = lifecycleByAnimal.get(item.animalId);

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-border/70 bg-muted/30 p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{item.title}</p>
                          <StatusBadge tone={getUrgencyTone(item.urgency)}>
                            {item.urgency === "atencao"
                              ? "Em atencao"
                              : item.urgency === "planejado"
                                ? "Planejado"
                                : "Estavel"}
                          </StatusBadge>
                          {lifecyclePending ? (
                            <StatusBadge
                              tone={
                                lifecyclePending.queueKind === "decisao_estrategica"
                                  ? "warning"
                                  : "info"
                              }
                            >
                              {getPendingAnimalLifecycleKindLabel(
                                lifecyclePending.queueKind,
                              )}
                            </StatusBadge>
                          ) : null}
                        </div>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {item.animalIdentificacao} | {item.helper}
                        </p>
                        {lifecyclePending ? (
                          <p className="text-sm text-muted-foreground">
                            {getAnimalLifeStageLabel(lifecyclePending.currentStage)} para{" "}
                            {getAnimalLifeStageLabel(lifecyclePending.targetStage)}
                          </p>
                        ) : null}
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
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Timeline da matriz em foco</CardTitle>
            </div>
            <CardDescription>
              Sequencia cronologica real do ciclo, sem ruido de formulario.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedAnimal ? (
              <EmptyMessage
                icon={History}
                title="Selecione uma matriz"
                description="Use a lista da esquerda ou a agenda automatica para abrir a timeline."
              />
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border/70 bg-muted/30 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold tracking-[-0.01em]">
                      {selectedAnimal.identificacao}
                    </p>
                    <StatusBadge tone={getStatusTone(selectedAnimal.reproStatus.status)}>
                      {STATUS_LABEL[selectedAnimal.reproStatus.status]}
                    </StatusBadge>
                    {selectedLifecyclePending ? (
                      <StatusBadge
                        tone={
                          selectedLifecyclePending.queueKind === "decisao_estrategica"
                            ? "warning"
                            : "info"
                        }
                      >
                        {getPendingAnimalLifecycleKindLabel(
                          selectedLifecyclePending.queueKind,
                        )}
                      </StatusBadge>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {selectedAnimal.loteNome ?? "Sem lote definido"} | proximo
                    passo: {selectedAnimal.nextActionLabel}
                  </p>
                  {selectedLifecyclePending ? (
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {getAnimalLifeStageLabel(selectedLifecyclePending.currentStage)} para{" "}
                      {getAnimalLifeStageLabel(selectedLifecyclePending.targetStage)} |{" "}
                      {selectedLifecyclePending.reason}
                    </p>
                  ) : null}
                </div>

                {selectedHistory.length === 0 ? (
                  <EmptyMessage
                    title="Sem eventos reprodutivos"
                    description="Ainda nao ha registros reprodutivos para esta matriz."
                  />
                ) : (
                  <div className="relative pl-5">
                    <div className="absolute bottom-1 left-[0.45rem] top-1 w-px bg-border/80" />
                    <div className="space-y-4">
                      {selectedHistory.map((event) => (
                        <div key={event.id} className="relative">
                          <div className="absolute -left-[1.15rem] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                          <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-medium">{formatTimelineTitle(event)}</p>
                              <span className="text-xs text-muted-foreground">
                                {new Date(event.occurred_at).toLocaleDateString("pt-BR")}
                              </span>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                              {formatTimelineDetail(event)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
    </div>
  );
}
