import { useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  Beef,
  Calendar,
  CheckCircle2,
  FileText,
  MousePointerClick,
  RefreshCw,
  Upload,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { PageIntro } from "@/components/ui/page-intro";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { db } from "@/lib/offline/db";
import { getRejectionStats, listRejections } from "@/lib/offline/rejections";
import {
  EMPTY_FARM_OPERATIONAL_GESTURE_STATS,
  loadFarmOperationalGestureStats,
} from "@/lib/offline/syncQueries";
import { pullDataForFarm } from "@/lib/offline/pull";
import { useAuth } from "@/hooks/useAuth";
import { buildPilotMetricsSummary } from "@/lib/telemetry/pilotMetrics";

const EMPTY_LIST: never[] = [];
const DASHBOARD_REJECTION_SAMPLE_LIMIT = 120;
const EMPTY_REJECTION_SNAPSHOT = {
  recentItems: EMPTY_LIST,
  totalCount: 0,
};

function resolveRejectionDomain(table: string, reasonCode?: string): string {
  const reason = (reasonCode || "").toUpperCase();
  const tableName = (table || "").toLowerCase();

  if (reason.includes("ANTI_TELEPORTE") || reason.includes("MOVIMENTACAO")) {
    return "movimentacao";
  }
  if (reason.includes("FINANCEIRO")) return "financeiro";
  if (reason.includes("NUTRICAO")) return "nutricao";
  if (reason.includes("SANITARIO")) return "sanitario";
  if (reason.includes("PESAGEM")) return "pesagem";

  if (tableName.includes("movimentacao")) return "movimentacao";
  if (tableName.includes("financeiro")) return "financeiro";
  if (tableName.includes("nutricao")) return "nutricao";
  if (tableName.includes("sanitario")) return "sanitario";
  if (tableName.includes("pesagem")) return "pesagem";
  if (tableName === "animais" && reason.includes("ANTI_TELEPORTE")) {
    return "movimentacao";
  }

  return "geral";
}

const Dashboard = () => {
  const { activeFarmId } = useAuth();

  useEffect(() => {
    if (!activeFarmId) return;

    pullDataForFarm(activeFarmId, ["agenda_itens"], { mode: "merge" }).catch(
      (error) => {
        console.warn("[dashboard] failed to refresh agenda_itens", error);
      },
    );
  }, [activeFarmId]);

  const totalAnimais =
    useLiveQuery(async () => {
      if (!activeFarmId) return 0;
      return db.state_animais
        .where("fazenda_id")
        .equals(activeFarmId)
        .and((animal) => !animal.deleted_at)
        .count();
    }, [activeFarmId]) || 0;

  const pendenciasAgenda =
    useLiveQuery(async () => {
      if (!activeFarmId) return 0;
      return db.state_agenda_itens
        .where("[fazenda_id+status]")
        .equals([activeFarmId, "agendado"])
        .filter((item) => !item.deleted_at)
        .count();
    }, [activeFarmId]) || 0;

  const rejectionSnapshot =
    useLiveQuery(async () => {
      if (!activeFarmId) {
        return EMPTY_REJECTION_SNAPSHOT;
      }

      const [recentPage, stats] = await Promise.all([
        listRejections(activeFarmId, { limit: DASHBOARD_REJECTION_SAMPLE_LIMIT }),
        getRejectionStats(activeFarmId),
      ]);

      return {
        recentItems: recentPage.items,
        totalCount: stats.count,
      };
    }, [activeFarmId]) || EMPTY_REJECTION_SNAPSHOT;

  const recentRejections = rejectionSnapshot.recentItems;
  const totalRejections = rejectionSnapshot.totalCount;
  const rejectionSampleIsPartial = totalRejections > recentRejections.length;

  const operationalStats =
    useLiveQuery(
      async () => loadFarmOperationalGestureStats(activeFarmId),
      [activeFarmId],
    ) || EMPTY_FARM_OPERATIONAL_GESTURE_STATS;

  const pilotEventsQuery = useLiveQuery(async () => {
    if (!activeFarmId) return [];
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    return db.metrics_events
      .where("[fazenda_id+created_at]")
      .between([activeFarmId, since], [activeFarmId, "\uffff"], true, true)
      .toArray();
  }, [activeFarmId]);

  const pilotEvents = useMemo(
    () => pilotEventsQuery ?? EMPTY_LIST,
    [pilotEventsQuery],
  );

  const pesagemData =
    useLiveQuery(async () => {
      if (!activeFarmId) return [];

      const eventos = await db.event_eventos
        .where("[fazenda_id+occurred_at]")
        .between([activeFarmId, ""], [activeFarmId, "\uffff"], true, true)
        .reverse()
        .filter((evt) => evt.dominio === "pesagem" && !evt.deleted_at)
        .limit(10)
        .toArray();

      const orderedEventos = eventos.slice().reverse();

      const data = await Promise.all(
        orderedEventos.map(async (evt) => {
          const detalhes = await db.event_eventos_pesagem.get(evt.id);
          return {
            data: new Date(evt.occurred_at).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            }),
            media: detalhes?.peso_kg || 0,
          };
        }),
      );

      return data;
    }, [activeFarmId]) || [];

  const agendaData =
    useLiveQuery(async () => {
      if (!activeFarmId) return [];

      const itens = await db.state_agenda_itens
        .where("[fazenda_id+status]")
        .equals([activeFarmId, "agendado"])
        .filter((item) => !item.deleted_at)
        .toArray();

      const grouped = itens.reduce((acc: Record<string, number>, item) => {
        const tipo = item.tipo || "Outros";
        acc[tipo] = (acc[tipo] || 0) + 1;
        return acc;
      }, {});

      return Object.entries(grouped).map(([nome, qtd]) => ({ nome, qtd }));
    }, [activeFarmId]) || [];

  const rejectionByDomainData = useMemo(() => {
    const grouped = recentRejections.reduce(
      (acc: Record<string, number>, rejection) => {
        const domain = resolveRejectionDomain(
          rejection.table,
          rejection.reason_code,
        );
        acc[domain] = (acc[domain] || 0) + 1;
        return acc;
      },
      {},
    );

    return Object.entries(grouped)
      .map(([domain, total]) => ({ domain, total }))
      .sort((a, b) => b.total - a.total);
  }, [recentRejections]);

  const rejectionByRuleData = useMemo(() => {
    const total = recentRejections.length;
    const grouped = recentRejections.reduce(
      (acc: Record<string, number>, rejection) => {
        const reason = rejection.reason_code || "UNKNOWN";
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      },
      {},
    );

    return Object.entries(grouped)
      .map(([reason, count]) => ({
        reason,
        count,
        rate: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [recentRejections]);

  const pilotMetrics = useMemo(() => {
    return buildPilotMetricsSummary(pilotEvents);
  }, [pilotEvents]);

  const adminPriorityActions = useMemo(
    () => [
      {
        title: "DLQ local",
        tone: totalRejections > 0 ? "danger" : "success",
        value: totalRejections,
        helper:
          totalRejections > 0
            ? "Rejeicoes e rollbacks pedem revisao antes de novo retrabalho."
            : "Nenhuma rejeicao local aberta neste momento.",
        path: totalRejections > 0 ? "/reconciliacao" : "/home",
        actionLabel: totalRejections > 0 ? "Abrir reconciliacao" : "Ver status de sync",
      },
      {
        title: "Fila de sync",
        tone: operationalStats.backlog > 0 ? "warning" : "success",
        value: operationalStats.backlog,
        helper:
          operationalStats.backlog > 0
            ? "Gestos ainda aguardam worker, rede ou confirmacao do servidor."
            : "Fila local estabilizada para a fazenda ativa.",
        path: "/home",
        actionLabel:
          operationalStats.backlog > 0 ? "Acompanhar fila" : "Abrir painel inicial",
      },
      {
        title: "Agenda aberta",
        tone: pendenciasAgenda > 0 ? "warning" : "success",
        value: pendenciasAgenda,
        helper:
          pendenciasAgenda > 0
            ? "Itens agendados continuam pressionando a operacao."
            : "Agenda aberta sob controle no momento.",
        path: "/agenda",
        actionLabel: pendenciasAgenda > 0 ? "Abrir agenda" : "Ver agenda",
      },
    ],
    [operationalStats.backlog, pendenciasAgenda, totalRejections],
  );

  const routeLabel = (route: string) => {
    const labels: Record<string, string> = {
      "/home": "Hoje",
      "/registrar": "Registrar",
      "/agenda": "Agenda",
      "/animais": "Animais",
      "/lotes": "Lotes",
      "/pastos": "Pastos",
      "/relatorios": "Resumo",
      "/financeiro": "Financeiro",
      "/onboarding-inicial": "Onboarding",
    };
    return labels[route] ?? route;
  };

  return (
    <div className="space-y-5">
      <PageIntro
        eyebrow="Saude operacional"
        title="Dashboard administrativo"
        description="Monitoramento do sync, rejeicoes e adocao do produto. A rotina operacional continua protagonista; analytics entram como camada secundaria para gestao."
        meta={
          <>
            <StatusBadge tone="neutral">{operationalStats.processed} gestos processados</StatusBadge>
            {operationalStats.backlog > 0 ? (
              <StatusBadge tone="warning">
                {operationalStats.backlog} na fila
              </StatusBadge>
            ) : (
              <StatusBadge tone="success">Fila sob controle</StatusBadge>
            )}
            {totalRejections > 0 ? (
              <StatusBadge tone="danger">
                {totalRejections} rejeicoes locais
              </StatusBadge>
            ) : null}
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Animais"
          value={totalAnimais}
          hint="Cabecas ativas no rebanho."
          icon={<Beef className="h-4 w-4" />}
        />
        <MetricCard
          label="Agenda aberta"
          value={pendenciasAgenda}
          hint="Itens agendados ativos."
          icon={<Calendar className="h-4 w-4" />}
        />
        <MetricCard
          label="Backlog de sync"
          value={operationalStats.backlog}
          hint="Gestos em PENDING ou SYNCING."
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={operationalStats.backlog > 0 ? "warning" : "success"}
        />
        <MetricCard
          label="Taxa de sucesso"
          value={`${operationalStats.successRate.toFixed(1)}%`}
          hint={`${operationalStats.successful} sucesso(s) de ${operationalStats.processed} processado(s).`}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone={operationalStats.successRate < 95 ? "warning" : "success"}
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Prioridades administrativas</CardTitle>
          <CardDescription>
            Comece pela fila, pela DLQ e pela agenda. A telemetria detalhada fica
            recolhida para nao competir com a operacao.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-0 lg:grid-cols-3 lg:divide-x divide-y lg:divide-y-0 rounded-2xl border border-border overflow-hidden bg-card">
          {adminPriorityActions.map((action) => (
            <div
              key={action.title}
              className="p-5 flex flex-col justify-between hover:bg-muted/10 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{action.title}</p>
                    <strong className="mt-2 block text-3xl tracking-[-0.02em] tabular-nums">
                      {action.value}
                    </strong>
                  </div>
                  <StatusBadge tone={action.tone}>{action.title}</StatusBadge>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {action.helper}
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="mt-4 self-start bg-transparent border-transparent hover:border-border hover:bg-muted/30">
                <Link to={action.path}>{action.actionLabel}</Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Leitura do sync</CardTitle>
            <CardDescription>
              Backlog, taxa de sucesso e concentracao das rejeicoes por regra de
              negocio no recorte mais recente da DLQ local.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="app-surface-muted p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Taxa global de rejeicao
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-[-0.02em]">
                    {operationalStats.rejectionRate.toFixed(1)}%
                  </p>
                </div>
                <StatusBadge
                  tone={
                    operationalStats.rejectionRate > 5 ? "warning" : "success"
                  }
                >
                  {operationalStats.failed} gesto(s) com falha
                </StatusBadge>
              </div>
              <Progress
                value={Math.max(0, 100 - operationalStats.rejectionRate)}
                className="mt-4"
              />
            </div>

            {rejectionByRuleData.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                Nenhuma rejeicao por regra no historico local.
              </div>
            ) : (
              <div className="space-y-3">
                {rejectionSampleIsPartial ? (
                  <div className="rounded-2xl border border-border/70 bg-muted/35 p-4 text-sm text-muted-foreground">
                    Graficos baseados nas ultimas {recentRejections.length} rejeicoes locais
                    para manter a leitura administrativa leve. Total em fila/DLQ:
                    {" "}{totalRejections}.
                  </div>
                ) : null}
                {rejectionByRuleData.map((item) => (
                  <div key={item.reason} className="app-surface-muted p-4">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-mono">{item.reason}</span>
                      <span className="text-muted-foreground">
                        {item.count} ({item.rate.toFixed(1)}%)
                      </span>
                    </div>
                    <Progress value={item.rate} className="mt-3" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rejeicoes por dominio</CardTitle>
            <CardDescription>
              Onde o fluxo esta acumulando mais friccao no recorte recente da
              DLQ local.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[340px]">
            {rejectionByDomainData.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                Sem rejeicoes registradas nesta fazenda.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rejectionByDomainData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="domain" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" fill="hsl(var(--destructive))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Evolucao de peso
            </CardTitle>
            <CardDescription>
              Serie curta para leitura rapida das ultimas pesagens.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pesagemData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="data" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="media"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.5}
                  dot={{ r: 2, fill: "hsl(var(--primary))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Agenda por categoria</CardTitle>
            <CardDescription>
              Distribuicao dos itens abertos para leitura de carga operacional.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agendaData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="nome" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip />
                  <Bar dataKey="qtd" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardContent className="p-0">
          <Accordion type="single" collapsible>
            <AccordionItem value="pilot-metrics" className="border-b-0">
              <AccordionTrigger className="px-6 py-5 text-left hover:no-underline">
                <div className="space-y-1">
                  <p className="text-base font-semibold text-foreground">
                    Telemetria de piloto
                  </p>
                  <p className="text-sm font-normal text-muted-foreground">
                    Expanda apenas quando precisar analisar adocao, rotas e falhas
                    instrumentadas.
                  </p>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                  <Card>
                    <CardHeader>
                      <CardTitle>Indicadores do piloto</CardTitle>
                      <CardDescription>
                        Resumo dos ultimos 7 dias para acompanhar uso e falhas.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {pilotMetrics.totalEvents === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                          Ainda nao ha telemetria local suficiente para resumir uso e
                          falhas desta fazenda.
                        </div>
                      ) : (
                        <>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="app-surface-muted p-4">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MousePointerClick className="h-4 w-4" />
                                Paginas abertas
                              </div>
                              <strong className="mt-3 block text-2xl">
                                {pilotMetrics.pageViews}
                              </strong>
                              <span className="text-xs text-muted-foreground">
                                {pilotMetrics.activeDays} dia(s) com uso
                              </span>
                            </div>

                            <div className="app-surface-muted p-4">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Upload className="h-4 w-4" />
                                Importacoes
                              </div>
                              <strong className="mt-3 block text-2xl">
                                {pilotMetrics.importedRecords}
                              </strong>
                              <span className="text-xs text-muted-foreground">
                                {pilotMetrics.importsCompleted} carga(s) concluida(s)
                              </span>
                            </div>

                            <div className="app-surface-muted p-4">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <FileText className="h-4 w-4" />
                                Relatorios compartilhados
                              </div>
                              <strong className="mt-3 block text-2xl">
                                {pilotMetrics.reportsShared}
                              </strong>
                              <span className="text-xs text-muted-foreground">
                                {pilotMetrics.reportExports} CSV +{" "}
                                {pilotMetrics.reportPrints} impressos
                              </span>
                            </div>

                            <div className="app-surface-muted p-4">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <AlertTriangle className="h-4 w-4" />
                                Falhas de sync
                              </div>
                              <strong className="mt-3 block text-2xl">
                                {pilotMetrics.syncFailures}
                              </strong>
                              <span className="text-xs text-muted-foreground">
                                {pilotMetrics.syncSuccesses} sucesso(s) no periodo
                              </span>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-border/70 bg-muted/35 p-4 text-sm text-muted-foreground">
                            {pilotMetrics.totalEvents} evento(s) de telemetria local
                            agregados no periodo.
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Rotas e alertas</CardTitle>
                      <CardDescription>
                        Como o produto esta sendo usado e onde surgem desvios.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="space-y-3">
                        <div className="text-sm font-medium">Rotas mais usadas</div>
                        {pilotMetrics.topRoutes.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Sem navegacao registrada ainda.
                          </p>
                        ) : (
                          pilotMetrics.topRoutes.map((item) => (
                            <div key={item.label} className="app-surface-muted p-4">
                              <div className="flex items-center justify-between gap-3 text-sm">
                                <span>{routeLabel(item.label)}</span>
                                <span className="text-muted-foreground">{item.count}</span>
                              </div>
                              <Progress
                                value={
                                  (item.count /
                                    Math.max(
                                      pilotMetrics.topRoutes[0]?.count ?? 1,
                                      1,
                                    )) *
                                  100
                                }
                                className="mt-3"
                              />
                            </div>
                          ))
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="text-sm font-medium">Importacoes por entidade</div>
                        {pilotMetrics.importsByEntity.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Nenhuma importacao concluida no periodo.
                          </p>
                        ) : (
                          pilotMetrics.importsByEntity.map((item) => (
                            <div
                              key={item.label}
                              className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/35 p-4 text-sm"
                            >
                              <span className="capitalize">{item.label}</span>
                              <strong>{item.count}</strong>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="text-sm font-medium">Falhas registradas</div>
                        {pilotMetrics.failuresByType.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Nenhuma falha instrumentada nos ultimos 7 dias.
                          </p>
                        ) : (
                          pilotMetrics.failuresByType.map((item) => (
                            <div
                              key={item.label}
                              className="flex items-center justify-between rounded-2xl border border-border/70 bg-muted/35 p-4 text-sm"
                            >
                              <span className="font-mono">{item.label}</span>
                              <strong>{item.count}</strong>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </section>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
