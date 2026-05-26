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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { PageIntro } from "@/components/ui/page-intro";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Toolbar } from "@/components/ui/toolbar";
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
    detailParts.push(
      `Parto previsto ${formatDate(payload.data_prevista_parto)}`,
    );
  }

  return (
    detailParts.join(" | ") || event.observacoes || "Sem detalhe adicional."
  );
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

function EmptyMessage({
  icon: Icon,
  title,
  description,
  actions,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 p-5 text-sm text-muted-foreground">
      <div className="flex items-start gap-3">
        {Icon ? <Icon className="mt-0.5 h-4 w-4" /> : null}
        <div className="space-y-2">
          <p className="font-medium text-foreground">{title}</p>
          {description ? <p className="leading-6">{description}</p> : null}
          {actions ? (
            <div className="flex flex-wrap gap-2">{actions}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function ReproductionDashboard() {
  const { activeFarmId, farmLifecycleConfig } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] =
    useState<ReproDashboardFilter>("atencao");
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(null);
  const [agendaLimit, setAgendaLimit] = useState(12);

  const reproductionData = useLiveQuery(async () => {
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
  }, [activeFarmId, farmLifecycleConfig]);

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
    ? (lifecycleByAnimal.get(selectedAnimalId) ?? null)
    : null;
  const selectedHistory = selectedAnimalId
    ? (historyByAnimal.get(selectedAnimalId) ?? [])
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
      <div className="space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="shadow-none">
              <CardContent className="space-y-2 p-4">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-9 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="space-y-3 p-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageIntro
        variant="plain"
        title="Reproducao"
        description="Matrizes, prenhez, partos e pos-parto. IATF assistida permanece sem decisao automatica."
        meta={
          <>
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

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="shadow-none">
          <CardContent className="space-y-2 p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Matrizes
            </p>
            <p className="text-3xl font-semibold tabular-nums">
              {dashboardData.totals.femeasAtivas}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="space-y-2 p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Prenhez confirmada
            </p>
            <p className="text-3xl font-semibold tabular-nums text-success">
              {dashboardData.totals.prenhas}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="space-y-2 p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Servidas
            </p>
            <p className="text-3xl font-semibold tabular-nums">
              {dashboardData.totals.servidas}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="space-y-2 p-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              Em atencao
            </p>
            <p className="text-3xl font-semibold tabular-nums text-warning">
              {dashboardData.totals.atencao}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Matrizes</CardTitle>
              <span className="text-sm text-muted-foreground">
                {filteredAnimals.length}
                {dashboardData.totals.femeasAtivas !== filteredAnimals.length
                  ? ` de ${dashboardData.totals.femeasAtivas}`
                  : ""}
                {" "}em exibicao
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Toolbar className="border-0 bg-transparent p-0 shadow-none">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-9"
                  placeholder="Buscar por identificacao, nome ou lote"
                />
              </div>
            </Toolbar>

            {filteredAnimals.length === 0 ? (
              <EmptyMessage
                title="Nenhuma matriz encontrada"
                description="Nenhuma femea elegivel encontrada com os filtros atuais."
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
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedAnimalId(animal.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedAnimalId(animal.id);
                        }
                      }}
                      className={cn(
                        "cursor-pointer rounded-xl border border-border/70 bg-muted/30 p-4 transition-colors hover:bg-muted/50",
                        isSelected && "border-primary/30 bg-primary/5",
                      )}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1 space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-semibold tracking-[-0.01em]">
                              {animal.identificacao}
                            </p>
                            <StatusBadge
                              tone={getStatusTone(animal.reproStatus.status)}
                            >
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
                                  lifecyclePending.queueKind ===
                                  "decisao_estrategica"
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
                            <div className="rounded-xl border border-border/70 bg-background/80 p-4">
                              <p className="text-xs font-semibold uppercase text-muted-foreground">
                                Ultimo marco
                              </p>
                              <p className="mt-2 font-medium">
                                {animal.lastEventLabel}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {animal.lastEventDateLabel
                                  ? formatDate(animal.lastEventDateLabel)
                                  : "Sem data registrada"}
                              </p>
                            </div>

                            <div className="rounded-xl border border-border/70 bg-background/80 p-4">
                              <p className="text-xs font-semibold uppercase text-muted-foreground">
                                Proximo passo
                              </p>
                              <p className="mt-2 font-medium">
                                {animal.nextActionLabel}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {formatDate(animal.nextActionDate)}
                              </p>
                            </div>
                          </div>

                          {lifecyclePending ? (
                            <p className="text-sm leading-6 text-muted-foreground">
                              {getAnimalLifeStageLabel(
                                lifecyclePending.currentStage,
                              )}{" "}
                              para{" "}
                              {getAnimalLifeStageLabel(
                                lifecyclePending.targetStage,
                              )}{" "}
                              | {lifecyclePending.reason}
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
                              <DropdownMenuItem
                                onClick={() => setSelectedAnimalId(animal.id)}
                              >
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

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Em foco agora</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                {
                  label: "Todas as matrizes",
                  value: dashboardData.totals.femeasAtivas,
                  filter: "todas" as ReproDashboardFilter,
                },
                {
                  label: "Diagnosticos pendentes",
                  value: dashboardData.focus.diagnosticosPendentes,
                  filter: "atencao" as ReproDashboardFilter,
                },
                {
                  label: "Partos proximos",
                  value: dashboardData.focus.partosProximos,
                  filter: "prenhas" as ReproDashboardFilter,
                },
                {
                  label: "Puerperio ativo",
                  value: dashboardData.focus.puerperioAtivo,
                  filter: "paridas" as ReproDashboardFilter,
                },
                {
                  label: "Femeas aptas",
                  value: dashboardData.focus.femeasAptas,
                  filter: "vazias" as ReproDashboardFilter,
                },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setActiveFilter(item.filter)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-left transition-colors hover:bg-muted/70",
                    activeFilter === item.filter &&
                      "border-primary/30 bg-primary/5 text-primary",
                  )}
                >
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className="rounded-full bg-background px-2.5 py-1 text-xs font-semibold tabular-nums text-muted-foreground">
                    {item.value}
                  </span>
                </button>
              ))}

              {lifecycleSummary.total > 0 ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="mt-2 w-full justify-between rounded-xl"
                >
                  <Link to="/animais/transicoes">
                    <span>Marcos de vida</span>
                    <span>{lifecycleSummary.total}</span>
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </aside>
      </section>
      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Agenda reprodutiva automatica</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {visibleAgenda.length === 0 ? (
              <EmptyMessage
                icon={ListTodo}
                title="Nenhuma recomendacao encontrada"
                description="A agenda sera preenchida conforme eventos reprodutivos forem registrados."
              />
            ) : (
              visibleAgenda.slice(0, agendaLimit).map((item) => {
                const lifecyclePending = lifecycleByAnimal.get(item.animalId);

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-border/70 bg-muted/30 p-4"
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
                                lifecyclePending.queueKind ===
                                "decisao_estrategica"
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
                            {getAnimalLifeStageLabel(
                              lifecyclePending.currentStage,
                            )}{" "}
                            para{" "}
                            {getAnimalLifeStageLabel(
                              lifecyclePending.targetStage,
                            )}
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

            {visibleAgenda.length > agendaLimit && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setAgendaLimit((current) => current + 12)}
              >
                Ver mais ({visibleAgenda.length - agendaLimit} restante
                {visibleAgenda.length - agendaLimit > 1 ? "s" : ""})
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Timeline da matriz em foco</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {!selectedAnimal ? (
              <EmptyMessage
                icon={History}
                title="Selecione uma matriz"
                description="Clique em uma matriz na lista ao lado para ver a timeline."
              />
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold tracking-[-0.01em]">
                      {selectedAnimal.identificacao}
                    </p>
                    <StatusBadge
                      tone={getStatusTone(selectedAnimal.reproStatus.status)}
                    >
                      {STATUS_LABEL[selectedAnimal.reproStatus.status]}
                    </StatusBadge>
                    {selectedLifecyclePending ? (
                      <StatusBadge
                        tone={
                          selectedLifecyclePending.queueKind ===
                          "decisao_estrategica"
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
                      {getAnimalLifeStageLabel(
                        selectedLifecyclePending.currentStage,
                      )}{" "}
                      para{" "}
                      {getAnimalLifeStageLabel(
                        selectedLifecyclePending.targetStage,
                      )}{" "}
                      | {selectedLifecyclePending.reason}
                    </p>
                  ) : null}
                </div>

                {selectedHistory.length === 0 ? (
                  <EmptyMessage
                title="Sem eventos reprodutivos"
                description="Esta matriz nao possui registros reprodutivos no historico."
              />
                ) : (
                  <div className="relative pl-5">
                    <div className="absolute bottom-1 left-[0.45rem] top-1 w-px bg-border/80" />
                    <div className="space-y-4">
                      {selectedHistory.map((event) => (
                        <div key={event.id} className="relative">
                          <div className="absolute -left-[1.15rem] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                          <div className="rounded-xl border border-border/70 bg-background/80 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="font-medium">
                                {formatTimelineTitle(event)}
                              </p>
                              <span className="text-xs text-muted-foreground">
                                {new Date(event.occurred_at).toLocaleDateString(
                                  "pt-BR",
                                )}
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



