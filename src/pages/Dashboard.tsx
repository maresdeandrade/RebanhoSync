import { useEffect, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
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

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  EMPTY_SANITARY_ATTENTION_SUMMARY,
  summarizeSanitaryAgendaAttention,
} from "@/lib/sanitario/compliance/attention";
import {
  buildRegulatoryOperationalReadModel,
  EMPTY_REGULATORY_OPERATIONAL_READ_MODEL,
  getRegulatoryAnalyticsImpactLabel,
  loadRegulatorySurfaceSource,
} from "@/lib/sanitario/compliance/regulatoryReadModel";
import { buildPilotMetricsSummary } from "@/lib/telemetry/pilotMetrics";

function buildAgendaCalendarModePath(mode: string) {
  return `/agenda?calendarMode=${mode}`;
}

function buildAgendaCalendarAnchorPath(anchor: string) {
  return `/agenda?calendarAnchor=${anchor}`;
}

function buildAnimalsCalendarModePath(mode: string) {
  return `/animais?calendarMode=${mode}`;
}

function buildAnimalsCalendarAnchorPath(anchor: string) {
  return `/animais?calendarAnchor=${anchor}`;
}

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

function resolveRejectionReasonLabel(reasonCode?: string): string {
  const reason = (reasonCode || "").toUpperCase();

  if (reason.includes("ANTI_TELEPORTE")) return "Movimentacao invalida";
  if (reason.includes("PERMISSION")) return "Permissao";
  if (reason.includes("EPISODE")) return "Vinculo reprodutivo";
  if (reason.includes("TAXONOMY")) return "Categoria derivada";
  if (reason.includes("VALIDATION")) return "Dados invalidos";
  if (reason.includes("SANITARIO")) return "Sanitario";
  if (reason.includes("FINANCEIRO")) return "Financeiro";
  return "Revisao operacional";
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

  const sanitaryAttention =
    useLiveQuery(async () => {
      if (!activeFarmId) return EMPTY_SANITARY_ATTENTION_SUMMARY;

      const [agenda, protocols, protocolItems] = await Promise.all([
        db.state_agenda_itens
          .where("[fazenda_id+status]")
          .equals([activeFarmId, "agendado"])
          .filter((item) => !item.deleted_at)
          .toArray(),
        db.state_protocolos_sanitarios
          .where("fazenda_id")
          .equals(activeFarmId)
          .filter((item) => !item.deleted_at)
          .toArray(),
        db.state_protocolos_sanitarios_itens
          .where("fazenda_id")
          .equals(activeFarmId)
          .filter((item) => !item.deleted_at)
          .toArray(),
      ]);

      return summarizeSanitaryAgendaAttention({
        agenda,
        protocols,
        protocolItems,
        limit: 3,
      });
    }, [activeFarmId]) || EMPTY_SANITARY_ATTENTION_SUMMARY;
  const regulatoryReadModel =
    useLiveQuery(async () => {
      if (!activeFarmId) return EMPTY_REGULATORY_OPERATIONAL_READ_MODEL;
      return buildRegulatoryOperationalReadModel(
        await loadRegulatorySurfaceSource(activeFarmId),
      );
    }, [activeFarmId]) || EMPTY_REGULATORY_OPERATIONAL_READ_MODEL;

  const rejectionSnapshot =
    useLiveQuery(async () => {
      if (!activeFarmId) {
        return EMPTY_REJECTION_SNAPSHOT;
      }

      const [recentPage, stats] = await Promise.all([
        listRejections(activeFarmId, {
          limit: DASHBOARD_REJECTION_SAMPLE_LIMIT,
        }),
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
        const reason = resolveRejectionReasonLabel(rejection.reason_code);
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
        title: "Registros para revisar",
        tone: totalRejections > 0 ? "danger" : "success",
        value: totalRejections,
        helper:
          totalRejections > 0
            ? "Ha registros que precisam de correcao antes de reenviar."
            : "Nenhum registro aguardando revisao.",
        path: totalRejections > 0 ? "/reconciliacao" : "/home",
        actionLabel: totalRejections > 0 ? "Revisar registros" : "Ver inicio",
      },
      {
        title: "Envio pendente",
        tone: operationalStats.backlog > 0 ? "warning" : "success",
        value: operationalStats.backlog,
        helper:
          operationalStats.backlog > 0
            ? "Acoes locais ainda aguardam conexao ou confirmacao."
            : "Tudo enviado para a fazenda ativa.",
        path: "/home",
        actionLabel:
          operationalStats.backlog > 0 ? "Acompanhar envio" : "Abrir inicio",
      },
      {
        title: "Conformidade",
        tone: regulatoryReadModel.hasBlockingIssues
          ? "danger"
          : regulatoryReadModel.attention.openCount > 0
            ? "warning"
            : "success",
        value: regulatoryReadModel.attention.openCount,
        helper:
          regulatoryReadModel.flows.sale.blockerCount > 0
            ? "Venda/transito estao restritos ate regularizar pendencias."
            : regulatoryReadModel.flows.nutrition.blockerCount > 0
              ? "Nutricao segue bloqueada por feed-ban ou checklist critico."
              : regulatoryReadModel.attention.openCount > 0
                ? "Ha pendencias procedurais abertas que exigem revisao."
                : "Sem restricoes regulatorias abertas no momento.",
        path: "/protocolos-sanitarios",
        actionLabel:
          regulatoryReadModel.attention.openCount > 0
            ? "Abrir conformidade"
            : "Revisar protocolos",
      },
      {
        title: "Sanitario critico",
        tone:
          sanitaryAttention.criticalCount > 0
            ? "danger"
            : sanitaryAttention.warningCount > 0
              ? "warning"
              : "success",
        value: sanitaryAttention.criticalCount,
        helper:
          sanitaryAttention.criticalCount > 0
            ? `${sanitaryAttention.mandatoryCount} obrigatorio(s), ${sanitaryAttention.requiresVetCount} com veterinario.${sanitaryAttention.scheduleModes[0] ? ` Predomina ${sanitaryAttention.scheduleModes[0].label.toLowerCase()}.` : ""}`
            : sanitaryAttention.warningCount > 0
              ? `${sanitaryAttention.warningCount} item(ns) entram na janela curta de manejo.`
              : "Sem protocolo sanitario critico no momento.",
        path: "/agenda",
        actionLabel:
          sanitaryAttention.totalOpen > 0 ? "Abrir agenda" : "Ver agenda",
      },
    ],
    [
      operationalStats.backlog,
      regulatoryReadModel,
      sanitaryAttention,
      totalRejections,
    ],
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
        variant="plain"
        eyebrow="Saude operacional"
        title="Painel gerencial"
        meta={
          <>
            <StatusBadge tone="info">{totalAnimais} animais</StatusBadge>
            <StatusBadge tone={pendenciasAgenda > 0 ? "warning" : "success"}>
              <span>Agenda aberta</span>
              <span>{pendenciasAgenda}</span>
            </StatusBadge>
            {operationalStats.backlog > 0 ? (
              <StatusBadge tone="warning">
                {operationalStats.backlog} envio(s) pendente(s)
              </StatusBadge>
            ) : (
              <StatusBadge tone="success">Envios em dia</StatusBadge>
            )}
            {totalRejections > 0 ? (
              <StatusBadge tone="danger">
                {totalRejections} registro(s) para revisar
              </StatusBadge>
            ) : null}
            {sanitaryAttention.criticalCount > 0 ? (
              <StatusBadge tone="danger">
                {sanitaryAttention.criticalCount} sanitario(s) critico(s)
              </StatusBadge>
            ) : null}
            {regulatoryReadModel.attention.openCount > 0 ? (
              <StatusBadge
                tone={
                  regulatoryReadModel.hasBlockingIssues ? "danger" : "warning"
                }
              >
                {regulatoryReadModel.attention.openCount} pendencia(s)
                regulatoria(s)
              </StatusBadge>
            ) : null}
          </>
        }
      />

      <Card className="shadow-none">
        <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
          <CardTitle>Prioridades administrativas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-0 divide-y overflow-hidden rounded-xl border border-border/70 bg-card p-0 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
          {adminPriorityActions.map((action) => (
            <div
              key={action.title}
              className="flex flex-col justify-between p-5 transition-colors hover:bg-muted/10"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {action.title}
                    </p>
                    <strong className="mt-2 block text-3xl tracking-[-0.02em] tabular-nums">
                      {action.value}
                    </strong>
                  </div>
                  <StatusBadge tone={action.tone}>
                    {action.tone === "success" ? "Em dia" : "Atenção"}
                  </StatusBadge>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {action.helper}
                </p>
              </div>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="mt-4 self-start border-transparent bg-transparent hover:border-border hover:bg-muted/30"
              >
                <Link to={action.path}>{action.actionLabel}</Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {sanitaryAttention.scheduleModes.length > 0 ? (
        <section className="grid gap-4 xl:grid-cols-2">
          <Card className="shadow-none">
            <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
              <CardTitle>Agenda sanitaria por calendario</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {sanitaryAttention.scheduleModes.map((mode) => (
                <div
                  key={mode.key}
                  className="rounded-xl border border-border/70 bg-muted/20 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{mode.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {mode.count} item(ns) aberto(s) neste recorte.
                      </p>
                    </div>
                    <StatusBadge tone="info">{mode.count}</StatusBadge>
                  </div>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="mt-4 bg-transparent"
                  >
                    <Link to={buildAgendaCalendarModePath(mode.key)}>
                      Abrir {mode.label.toLowerCase()}
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className="mt-2 px-0"
                  >
                    <Link to={buildAnimalsCalendarModePath(mode.key)}>
                      Ver animais
                    </Link>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          {sanitaryAttention.scheduleAnchors.length > 0 ? (
            <Card className="shadow-none">
              <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
                <CardTitle>Agenda sanitaria por ancora</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {sanitaryAttention.scheduleAnchors.map((anchor) => (
                  <div
                    key={anchor.key}
                    className="rounded-xl border border-border/70 bg-muted/20 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{anchor.label}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {anchor.count} item(ns) aberto(s) nesta ancora.
                        </p>
                      </div>
                      <StatusBadge tone="info">{anchor.count}</StatusBadge>
                    </div>
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="mt-4 bg-transparent"
                    >
                      <Link to={buildAgendaCalendarAnchorPath(anchor.key)}>
                        Abrir {anchor.label.toLowerCase()}
                      </Link>
                    </Button>
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="mt-2 px-0"
                    >
                      <Link to={buildAnimalsCalendarAnchorPath(anchor.key)}>
                        Ver animais
                      </Link>
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </section>
      ) : null}

      {regulatoryReadModel.attention.openCount > 0 ? (
        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="shadow-none">
            <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
              <CardTitle>Pendencias regulatorias por area</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {regulatoryReadModel.analytics.subareas.map((cut) => (
                <div
                  key={cut.key}
                  className="rounded-xl border border-border/70 bg-muted/20 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{cut.label}</p>
                        <StatusBadge tone={cut.tone}>
                          {cut.openCount} pendencia(s)
                        </StatusBadge>
                        {cut.blockerCount > 0 ? (
                          <StatusBadge tone="danger">
                            {cut.blockerCount} bloqueio(s)
                          </StatusBadge>
                        ) : null}
                        {cut.warningCount > 0 ? (
                          <StatusBadge tone="warning">
                            {cut.warningCount} revisao(oes)
                          </StatusBadge>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {cut.affectedImpacts.map((impact) => (
                          <StatusBadge key={impact} tone="info">
                            {getRegulatoryAnalyticsImpactLabel(impact)}
                          </StatusBadge>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {cut.recommendation}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 self-start">
                      <Button asChild variant="outline" size="sm">
                        <Link
                          to={`/protocolos-sanitarios?overlaySubarea=${cut.key}`}
                        >
                          Abrir area
                        </Link>
                      </Button>
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/animais?overlaySubarea=${cut.key}`}>
                          Ver animais
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
              <CardTitle>Impacto da conformidade</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {regulatoryReadModel.analytics.impacts.map((impact) => (
                <div
                  key={impact.key}
                  className="rounded-xl border border-border/70 bg-muted/20 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{impact.label}</p>
                        <StatusBadge tone={impact.tone}>
                          {impact.totalCount > 0
                            ? `${impact.totalCount} alerta(s)`
                            : "Sem restricao"}
                        </StatusBadge>
                        {impact.blockerCount > 0 ? (
                          <StatusBadge tone="danger">
                            {impact.blockerCount} bloqueio(s)
                          </StatusBadge>
                        ) : null}
                        {impact.warningCount > 0 ? (
                          <StatusBadge tone="warning">
                            {impact.warningCount} revisao(oes)
                          </StatusBadge>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {impact.message}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 self-start">
                      <Button asChild variant="ghost" size="sm">
                        <Link
                          to={`/protocolos-sanitarios?overlayImpact=${impact.key}`}
                        >
                          Abrir recorte
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/animais?overlayImpact=${impact.key}`}>
                          Ver animais
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="shadow-none">
          <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
            <CardTitle>Envio e revisao</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Registros para revisar
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
              <div className="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                Nenhuma rejeicao por regra no historico local.
              </div>
            ) : (
              <div className="space-y-3">
                {rejectionSampleIsPartial ? (
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                    Ultimas {recentRejections.length} revisoes locais. Total
                    para revisao: {totalRejections}.
                  </div>
                ) : null}
                {rejectionByRuleData.map((item) => (
                  <div
                    key={item.reason}
                    className="rounded-xl border border-border/70 bg-muted/20 p-4"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-medium">
                        {item.reason}
                      </span>
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

        <Card className="shadow-none">
          <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
            <CardTitle>Rejeicoes por dominio</CardTitle>
          </CardHeader>
          <CardContent className="h-[340px]">
            {rejectionByDomainData.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                Sem rejeicoes registradas nesta fazenda.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rejectionByDomainData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="domain" />
                  <YAxis />
                  <Tooltip />
                  <Bar
                    dataKey="total"
                    fill="hsl(var(--destructive))"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
            <CardTitle className="flex items-center gap-2">
              Evolucao de peso
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pesagemData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="data"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
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

        <Card className="shadow-none">
          <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
            <CardTitle>Agenda por categoria</CardTitle>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agendaData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="nome"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip />
                <Bar
                  dataKey="qtd"
                  fill="hsl(var(--success))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      <Card className="shadow-none">
        <CardContent className="p-0">
          <Accordion type="single" collapsible>
            <AccordionItem value="pilot-metrics" className="border-b-0">
              <AccordionTrigger className="px-6 py-5 text-left hover:no-underline">
                <div className="space-y-1">
                  <p className="text-base font-semibold text-foreground">
                    Telemetria de piloto
                  </p>
                  <p className="text-sm font-normal text-muted-foreground">
                    Expanda apenas quando precisar analisar adocao, rotas e
                    falhas instrumentadas.
                  </p>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                  <Card className="shadow-none">
                    <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
                      <CardTitle>Indicadores do piloto</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {pilotMetrics.totalEvents === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                          Ainda nao ha telemetria local suficiente para resumir
                          uso e falhas desta fazenda.
                        </div>
                      ) : (
                        <>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
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

                            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Upload className="h-4 w-4" />
                                Importacoes
                              </div>
                              <strong className="mt-3 block text-2xl">
                                {pilotMetrics.importedRecords}
                              </strong>
                              <span className="text-xs text-muted-foreground">
                                {pilotMetrics.importsCompleted} carga(s)
                                concluida(s)
                              </span>
                            </div>

                            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
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

                            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <AlertTriangle className="h-4 w-4" />
                                Falhas de envio
                              </div>
                              <strong className="mt-3 block text-2xl">
                                {pilotMetrics.syncFailures}
                              </strong>
                              <span className="text-xs text-muted-foreground">
                                {pilotMetrics.syncSuccesses} sucesso(s) no
                                periodo
                              </span>
                            </div>
                          </div>

                          <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                            {pilotMetrics.totalEvents} evento(s) de telemetria
                            local agregados no periodo.
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="shadow-none">
                    <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
                      <CardTitle>Rotas e alertas</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="space-y-3">
                        <div className="text-sm font-medium">
                          Rotas mais usadas
                        </div>
                        {pilotMetrics.topRoutes.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Sem navegacao registrada ainda.
                          </p>
                        ) : (
                          pilotMetrics.topRoutes.map((item) => (
                            <div
                              key={item.label}
                              className="rounded-xl border border-border/70 bg-muted/20 p-4"
                            >
                              <div className="flex items-center justify-between gap-3 text-sm">
                                <span>{routeLabel(item.label)}</span>
                                <span className="text-muted-foreground">
                                  {item.count}
                                </span>
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
                        <div className="text-sm font-medium">
                          Importacoes por entidade
                        </div>
                        {pilotMetrics.importsByEntity.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Nenhuma importacao concluida no periodo.
                          </p>
                        ) : (
                          pilotMetrics.importsByEntity.map((item) => (
                            <div
                              key={item.label}
                              className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 p-4 text-sm"
                            >
                              <span className="capitalize">{item.label}</span>
                              <strong>{item.count}</strong>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="text-sm font-medium">
                          Falhas registradas
                        </div>
                        {pilotMetrics.failuresByType.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Nenhuma falha instrumentada nos ultimos 7 dias.
                          </p>
                        ) : (
                          pilotMetrics.failuresByType.map((item) => (
                            <div
                              key={item.label}
                              className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 p-4 text-sm"
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

