import { useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
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

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { PageIntro } from "@/components/ui/page-intro";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { db } from "@/lib/offline/db";
import { pullDataForFarm } from "@/lib/offline/pull";
import { useAuth } from "@/hooks/useAuth";
import { buildPilotMetricsSummary } from "@/lib/telemetry/pilotMetrics";

const EMPTY_LIST: never[] = [];

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
        .where("fazenda_id")
        .equals(activeFarmId)
        .and((item) => item.status === "agendado" && !item.deleted_at)
        .count();
    }, [activeFarmId]) || 0;

  const queueGesturesQuery = useLiveQuery(async () => {
    if (!activeFarmId) return [];
    return db.queue_gestures.where("fazenda_id").equals(activeFarmId).toArray();
  }, [activeFarmId]);

  const queueRejectionsQuery = useLiveQuery(async () => {
    if (!activeFarmId) return [];
    return db.queue_rejections.where("fazenda_id").equals(activeFarmId).toArray();
  }, [activeFarmId]);

  const queueGestures = useMemo(
    () => queueGesturesQuery ?? EMPTY_LIST,
    [queueGesturesQuery],
  );
  const queueRejections = useMemo(
    () => queueRejectionsQuery ?? EMPTY_LIST,
    [queueRejectionsQuery],
  );

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

      const eventos = (
        await db.event_eventos.where("fazenda_id").equals(activeFarmId).toArray()
      )
        .filter((evt) => evt.dominio === "pesagem" && !evt.deleted_at)
        .sort(
          (a, b) =>
            new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
        )
        .slice(-10);

      const data = await Promise.all(
        eventos.map(async (evt) => {
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
        .where("fazenda_id")
        .equals(activeFarmId)
        .and((item) => item.status === "agendado" && !item.deleted_at)
        .toArray();

      const grouped = itens.reduce((acc: Record<string, number>, item) => {
        const tipo = item.tipo || "Outros";
        acc[tipo] = (acc[tipo] || 0) + 1;
        return acc;
      }, {});

      return Object.entries(grouped).map(([nome, qtd]) => ({ nome, qtd }));
    }, [activeFarmId]) || [];

  const operationalStats = useMemo(() => {
    const successful = queueGestures.filter(
      (gesture) => gesture.status === "DONE" || gesture.status === "SYNCED",
    ).length;
    const failed = queueGestures.filter(
      (gesture) => gesture.status === "ERROR" || gesture.status === "REJECTED",
    ).length;
    const backlog = queueGestures.filter(
      (gesture) => gesture.status === "PENDING" || gesture.status === "SYNCING",
    ).length;
    const processed = successful + failed;

    return {
      successful,
      failed,
      backlog,
      processed,
      successRate: processed > 0 ? (successful / processed) * 100 : 100,
      rejectionRate: processed > 0 ? (failed / processed) * 100 : 0,
    };
  }, [queueGestures]);

  const rejectionByDomainData = useMemo(() => {
    const grouped = queueRejections.reduce(
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
  }, [queueRejections]);

  const rejectionByRuleData = useMemo(() => {
    const total = queueRejections.length;
    const grouped = queueRejections.reduce(
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
  }, [queueRejections]);

  const pilotMetrics = useMemo(() => {
    return buildPilotMetricsSummary(pilotEvents);
  }, [pilotEvents]);

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
            {queueRejections.length > 0 ? (
              <StatusBadge tone="danger">
                {queueRejections.length} rejeicoes locais
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

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Leitura do sync</CardTitle>
            <CardDescription>
              Backlog, taxa de sucesso e concentracao das rejeicoes por regra de
              negocio.
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
              Onde o fluxo esta acumulando mais friccao localmente.
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
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              Evolucao de peso
            </CardTitle>
            <CardDescription>
              Serie curta para leitura rapida das ultimas pesagens.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pesagemData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="data" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="media"
                  stroke="hsl(var(--info))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
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
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="nome" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="qtd" fill="hsl(var(--success))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

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
                          Math.max(pilotMetrics.topRoutes[0]?.count ?? 1, 1)) *
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
    </div>
  );
};

export default Dashboard;
