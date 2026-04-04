import { useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Beef,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  FileText,
  MousePointerClick,
  Upload,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { db } from "@/lib/offline/db";
import { pullDataForFarm } from "@/lib/offline/pull";
import { useAuth } from "@/hooks/useAuth";
import { buildPilotMetricsSummary } from "@/lib/telemetry/pilotMetrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

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

    pullDataForFarm(activeFarmId, ["agenda_itens"], { mode: "merge" }).catch((error) => {
      console.warn("[dashboard] failed to refresh agenda_itens", error);
    });
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
    const grouped = queueRejections.reduce((acc: Record<string, number>, rejection) => {
      const domain = resolveRejectionDomain(rejection.table, rejection.reason_code);
      acc[domain] = (acc[domain] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([domain, total]) => ({ domain, total }))
      .sort((a, b) => b.total - a.total);
  }, [queueRejections]);

  const rejectionByRuleData = useMemo(() => {
    const total = queueRejections.length;
    const grouped = queueRejections.reduce((acc: Record<string, number>, rejection) => {
      const reason = rejection.reason_code || "UNKNOWN";
      acc[reason] = (acc[reason] || 0) + 1;
      return acc;
    }, {});

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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Animais
            </CardTitle>
            <Beef className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAnimais}</div>
            <p className="text-xs text-muted-foreground">Cabecas ativas no rebanho</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Agenda Pendente
            </CardTitle>
            <Calendar className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendenciasAgenda}</div>
            <p className="text-xs text-muted-foreground">Itens agendados ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Backlog de Sync
            </CardTitle>
            <AlertTriangle
              className={`h-4 w-4 ${
                operationalStats.backlog > 0
                  ? "text-destructive animate-pulse"
                  : "text-emerald-500"
              }`}
            />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{operationalStats.backlog}</div>
            <p className="text-xs text-muted-foreground">Gestos em PENDING ou SYNCING</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taxa de Sucesso do Sync
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold">{operationalStats.successRate.toFixed(1)}%</div>
            <Progress value={operationalStats.successRate} />
            <p className="text-xs text-muted-foreground">
              {operationalStats.successful} sucesso(s) de {operationalStats.processed} processado(s)
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Rejeicoes por Dominio</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {rejectionByDomainData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem rejeicoes registradas nesta fazenda.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rejectionByDomainData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="domain" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="total" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Rejeicoes por Regra</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-md border p-3">
              <span className="text-sm text-muted-foreground">Taxa global de rejeicao</span>
              <strong>{operationalStats.rejectionRate.toFixed(1)}%</strong>
            </div>

            {rejectionByRuleData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma rejeicao por regra no historico local.</p>
            ) : (
              rejectionByRuleData.map((item) => (
                <div key={item.reason} className="space-y-1">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-mono">{item.reason}</span>
                    <span className="text-muted-foreground">
                      {item.count} ({item.rate.toFixed(1)}%)
                    </span>
                  </div>
                  <Progress value={item.rate} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Evolucao de Peso (Media)</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pesagemData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="data" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="media"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Agenda por Categoria</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agendaData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="nome" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="qtd" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Indicadores do Piloto (7 dias)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pilotMetrics.totalEvents === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ainda nao ha telemetria local suficiente para resumir uso e falhas desta fazenda.
              </p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border p-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MousePointerClick className="h-4 w-4" />
                      Paginas abertas
                    </div>
                    <strong className="mt-2 block text-2xl">{pilotMetrics.pageViews}</strong>
                    <span className="text-xs text-muted-foreground">
                      {pilotMetrics.activeDays} dia(s) com uso
                    </span>
                  </div>

                  <div className="rounded-md border p-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Upload className="h-4 w-4" />
                      Importacoes
                    </div>
                    <strong className="mt-2 block text-2xl">
                      {pilotMetrics.importedRecords}
                    </strong>
                    <span className="text-xs text-muted-foreground">
                      {pilotMetrics.importsCompleted} carga(s) concluida(s)
                    </span>
                  </div>

                  <div className="rounded-md border p-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      Relatorios compartilhados
                    </div>
                    <strong className="mt-2 block text-2xl">
                      {pilotMetrics.reportsShared}
                    </strong>
                    <span className="text-xs text-muted-foreground">
                      {pilotMetrics.reportExports} CSV + {pilotMetrics.reportPrints} impressos
                    </span>
                  </div>

                  <div className="rounded-md border p-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <AlertTriangle className="h-4 w-4" />
                      Falhas de sync
                    </div>
                    <strong className="mt-2 block text-2xl">
                      {pilotMetrics.syncFailures}
                    </strong>
                    <span className="text-xs text-muted-foreground">
                      {pilotMetrics.syncSuccesses} sucesso(s) no periodo
                    </span>
                  </div>
                </div>

                <div className="rounded-md border p-3 text-sm text-muted-foreground">
                  {pilotMetrics.totalEvents} evento(s) de telemetria local agregados no periodo.
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Rotas e Alertas do Piloto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="text-sm font-medium">Rotas mais usadas</div>
              {pilotMetrics.topRoutes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sem navegacao registrada ainda.
                </p>
              ) : (
                pilotMetrics.topRoutes.map((item) => (
                  <div key={item.label} className="space-y-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span>{routeLabel(item.label)}</span>
                      <span className="text-muted-foreground">{item.count}</span>
                    </div>
                    <Progress
                      value={(item.count / Math.max(pilotMetrics.topRoutes[0]?.count ?? 1, 1)) * 100}
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
                    className="flex items-center justify-between rounded-md border p-3 text-sm"
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
                    className="flex items-center justify-between rounded-md border p-3 text-sm"
                  >
                    <span className="font-mono">{item.label}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;

