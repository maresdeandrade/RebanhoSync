import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Beef,
  CalendarClock,
  CheckCircle2,
  Clock3,
  PackageSearch,
  PlusCircle,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { SyncStatusPanel } from "@/components/offline/SyncStatusPanel";
import {
  getAnimalLifeStageLabel,
  getPendingAnimalLifecycleKindLabel,
  getPendingAnimalLifecycleTransitions,
} from "@/lib/animals/lifecycle";
import { supabase } from "@/lib/supabase";
import { db } from "@/lib/offline/db";
import type { FarmSyncSummary } from "@/lib/offline/syncPresentation";
import { loadFarmSyncSummary } from "@/lib/offline/syncQueries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageIntro } from "@/components/ui/page-intro";
import {
  getSanitaryAttentionOperationalClassLabel,
  summarizeSanitaryAgendaAttention,
  type SanitaryAttentionSummary,
} from "@/lib/sanitario/compliance/attention";
import {
  buildRegulatoryOperationalReadModel,
  loadRegulatorySurfaceSource,
  type RegulatoryOperationalReadModel,
} from "@/lib/sanitario/compliance/regulatoryReadModel";
import { StatusBadge } from "@/components/ui/status-badge";
import { OperationalInsightsPanel } from "@/features/operationalInsights/OperationalInsightsPanel";
import { useOperationalInsights } from "@/features/operationalInsights/useOperationalInsights";
import type {
  BuildOperationalInsightsInput,
  OperationalInsightsLoadedSources,
} from "@/features/operationalInsights/operationalInsightsAdapter";
import { cn } from "@/lib/utils";
import {
  buildAgendaCalendarModePath,
  buildAgendaOperationalClassPath,
} from "@/lib/agenda/navigation";
import {
  buildOperationalSummary,
  type InventoryReplenishmentAlertRow,
} from "@/lib/reports/operationalSummary";

type FarmSummary = {
  nome: string;
  municipio: string | null;
  estado: string | null;
  tipo_producao: "corte" | "leite" | "mista" | null;
};

type HomeSnapshot = {
  generatedAt: string;
  referenceDate: string;
  monthlyPeriod: {
    start: string;
    end: string;
  };
  operationalInsightSources: OperationalInsightsLoadedSources;
  animais: number;
  lotes: number;
  pastos: number;
  protocolos: number;
  agendaHoje: number;
  agendaAtrasada: number;
  syncSummary: FarmSyncSummary;
  lifecyclePendings: {
    animalId: string;
    identificacao: string;
    currentStageLabel: string;
    targetStageLabel: string;
    queueKindLabel: string;
    canAutoApply: boolean;
    reason: string;
  }[];
  lifecyclePendingCount: number;
  lifecycleStrategicCount: number;
  lifecycleBiologicalCount: number;
  sanitaryAttention: SanitaryAttentionSummary;
  regulatoryCompliance: RegulatoryOperationalReadModel;
  replenishmentAlerts: InventoryReplenishmentAlertRow[];
  proximosItens: {
    id: string;
    data: string;
    titulo: string;
    contexto: string;
    status: "hoje" | "atrasado" | "proximo";
  }[];
  eventosRecentes: {
    id: string;
    titulo: string;
    contexto: string;
    data: string;
  }[];
  checklist: {
    label: string;
    helper: string;
    path: string;
    done: boolean;
  }[];
};

const PRODUCTION_LABEL: Record<string, string> = {
  corte: "Pecuaria de corte",
  leite: "Pecuaria de leite",
  mista: "Producao mista",
};

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

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
});

const EMPTY_OPERATIONAL_INSIGHT_SOURCES: OperationalInsightsLoadedSources = {};
const EMPTY_MONTHLY_PERIOD = {
  start: "1970-01-01",
  end: "1970-01-31",
};

function getTodayKey() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function getMonthPeriod(referenceDate: string) {
  const [year, month] = referenceDate.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthKey = referenceDate.slice(0, 7);

  return {
    start: `${monthKey}-01`,
    end: `${monthKey}-${String(lastDay).padStart(2, "0")}`,
  };
}

function formatDay(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00`));
}

const Home = () => {
  const { activeFarmId, farmLifecycleConfig } = useAuth();
  const [farm, setFarm] = useState<FarmSummary | null>(null);

  useEffect(() => {
    const loadFarm = async () => {
      if (!activeFarmId) {
        setFarm(null);
        return;
      }

      const { data, error } = await supabase
        .from("fazendas")
        .select("nome, municipio, estado, tipo_producao")
        .eq("id", activeFarmId)
        .is("deleted_at", null)
        .maybeSingle();

      if (error || !data) {
        setFarm(null);
        return;
      }

      setFarm(data);
    };

    loadFarm();
  }, [activeFarmId]);

  const snapshot = useLiveQuery<HomeSnapshot | null>(async () => {
    if (!activeFarmId) return null;

    const todayKey = getTodayKey();
    const monthlyPeriod = getMonthPeriod(todayKey);
    const [
      animais,
      lotes,
      pastos,
      protocolos,
      protocoloItens,
      agendaItens,
      eventos,
      eventosMensais,
      insumos,
      insumoLotes,
      insumoApresentacoes,
      insumoMovimentacoes,
      syncSummary,
      regulatorySource,
    ] = await Promise.all([
      db.state_animais.where("fazenda_id").equals(activeFarmId).toArray(),
      db.state_lotes.where("fazenda_id").equals(activeFarmId).toArray(),
      db.state_pastos.where("fazenda_id").equals(activeFarmId).toArray(),
      db.state_protocolos_sanitarios
        .where("fazenda_id")
        .equals(activeFarmId)
        .toArray(),
      db.state_protocolos_sanitarios_itens
        .where("fazenda_id")
        .equals(activeFarmId)
        .toArray(),
      db.state_agenda_itens
        .where("[fazenda_id+status]")
        .equals([activeFarmId, "agendado"])
        .filter((item) => !item.deleted_at)
        .toArray(),
      db.event_eventos
        .where("[fazenda_id+occurred_at]")
        .between([activeFarmId, ""], [activeFarmId, "\uffff"], true, true)
        .reverse()
        .filter((evento) => !evento.deleted_at)
        .limit(5)
        .toArray(),
      db.event_eventos
        .where("[fazenda_id+occurred_at]")
        .between(
          [activeFarmId, `${monthlyPeriod.start}T00:00:00.000Z`],
          [activeFarmId, `${monthlyPeriod.end}T23:59:59.999Z`],
          true,
          true,
        )
        .filter((evento) => !evento.deleted_at)
        .toArray(),
      db.state_insumos.where("fazenda_id").equals(activeFarmId).toArray(),
      db.state_insumo_lotes.where("fazenda_id").equals(activeFarmId).toArray(),
      db.state_insumo_apresentacoes
        .where("fazenda_id")
        .equals(activeFarmId)
        .toArray(),
      db.state_insumo_movimentacoes
        .where("fazenda_id")
        .equals(activeFarmId)
        .toArray(),
      loadFarmSyncSummary(activeFarmId),
      loadRegulatorySurfaceSource(activeFarmId),
    ]);

    const animaisDisponiveis = animais.filter((animal) => !animal.deleted_at);
    const animaisAtivos = animais.filter(
      (animal) => !animal.deleted_at && animal.status === "ativo",
    );
    const lotesDisponiveis = lotes.filter((lote) => !lote.deleted_at);
    const lotesAtivos = lotesDisponiveis.filter((lote) => !lote.deleted_at);
    const pastosAtivos = pastos.filter((pasto) => !pasto.deleted_at);
    const protocolosDisponiveis = protocolos.filter(
      (protocolo) => !protocolo.deleted_at,
    );
    const protocolosAtivos = protocolosDisponiveis.filter(
      (protocolo) => protocolo.ativo,
    );
    const protocoloItensDisponiveis = protocoloItens.filter(
      (item) => !item.deleted_at,
    );
    const agendaAberta = agendaItens.filter(
      (item) => !item.deleted_at && item.status === "agendado",
    );
    const eventosRecentes = eventos.slice();
    const agendaHoje = agendaAberta.filter(
      (item) => item.data_prevista === todayKey,
    );
    const agendaAtrasada = agendaAberta.filter(
      (item) => item.data_prevista < todayKey,
    );
    const sanitaryAttention = summarizeSanitaryAgendaAttention({
      agenda: agendaAberta,
      animals: animaisDisponiveis,
      lotes: lotesDisponiveis,
      protocols: protocolosDisponiveis,
      protocolItems: protocoloItensDisponiveis,
      limit: 4,
    });
    const regulatoryCompliance =
      buildRegulatoryOperationalReadModel(regulatorySource);
    const operationalSummary = buildOperationalSummary(
      {
        animals: animaisDisponiveis,
        lotes: lotesDisponiveis,
        pastos: pastosAtivos,
        agenda: agendaAberta,
        eventos: eventosMensais,
        eventosPesagem: [],
        eventosFinanceiro: [],
        gestures: [],
        rejections: [],
        protocolosSanitarios: protocolosDisponiveis,
        protocoloItensSanitarios: protocoloItensDisponiveis,
        insumos,
        insumoApresentacoes,
        insumoLotes,
        insumoMovimentacoes,
      },
      {
        preset: "30d",
        from: monthlyPeriod.start,
        to: monthlyPeriod.end,
        label: "Mes atual",
        filenameTag: monthlyPeriod.start.slice(0, 7),
      },
      new Date(`${todayKey}T12:00:00`),
    );
    const proximosItens = agendaAberta
      .slice()
      .sort((left, right) =>
        left.data_prevista.localeCompare(right.data_prevista),
      )
      .slice(0, 6)
      .map((item) => {
        const animal = animaisAtivos.find(
          (entry) => entry.id === item.animal_id,
        );
        const lote = lotesAtivos.find((entry) => entry.id === item.lote_id);
        const status: "hoje" | "atrasado" | "proximo" =
          item.data_prevista < todayKey
            ? "atrasado"
            : item.data_prevista === todayKey
              ? "hoje"
              : "proximo";

        return {
          id: item.id,
          data: item.data_prevista,
          titulo: `${DOMAIN_LABEL[item.dominio] ?? "Agenda"}: ${item.tipo.replaceAll("_", " ")}`,
          contexto:
            animal?.identificacao ??
            animal?.nome ??
            lote?.nome ??
            "Sem animal ou lote vinculado",
          status,
        };
      });
    const checklist = [
      {
        label: "Cadastrar o primeiro pasto",
        helper: "Define a estrutura minima para lotes e movimentacoes.",
        path: "/pastos/novo",
        done: pastosAtivos.length > 0,
      },
      {
        label: "Cadastrar o primeiro lote",
        helper: "Permite organizar o rebanho por manejo.",
        path: "/lotes/novo",
        done: lotesAtivos.length > 0,
      },
      {
        label: "Cadastrar os primeiros animais",
        helper: "Sem animais nao existe rotina de campo no app.",
        path: "/animais/novo",
        done: animaisAtivos.length > 0,
      },
      {
        label: "Ativar protocolos sanitarios",
        helper: "Ajuda a gerar agenda e padronizar o manejo.",
        path: "/protocolos-sanitarios",
        done: protocolosAtivos.length > 0,
      },
      {
        label: "Registrar o primeiro manejo",
        helper: "Confirma que a rotina ja esta acontecendo no sistema.",
        path: "/registrar",
        done: eventosRecentes.length > 0,
      },
    ];
    const lifecycleQueue = getPendingAnimalLifecycleTransitions(
      animaisAtivos,
      farmLifecycleConfig,
    );
    const lifecyclePendings = lifecycleQueue.slice(0, 5).map((item) => ({
      animalId: item.animalId,
      identificacao: item.identificacao,
      currentStageLabel: getAnimalLifeStageLabel(item.currentStage),
      targetStageLabel: getAnimalLifeStageLabel(item.targetStage),
      queueKindLabel: getPendingAnimalLifecycleKindLabel(item.queueKind),
      canAutoApply: item.canAutoApply,
      reason: item.reason,
    }));
    const lifecycleStrategicCount = lifecycleQueue.filter(
      (item) => item.queueKind === "decisao_estrategica",
    ).length;
    const lifecycleBiologicalCount =
      lifecycleQueue.length - lifecycleStrategicCount;

    return {
      generatedAt: new Date().toISOString(),
      referenceDate: todayKey,
      monthlyPeriod,
      operationalInsightSources: {
        agendaItems: agendaAberta,
        animals: animaisDisponiveis,
        events: eventosMensais,
        protocolItems: protocoloItensDisponiveis,
      },
      animais: animaisAtivos.length,
      lotes: lotesAtivos.length,
      pastos: pastosAtivos.length,
      protocolos: protocolosAtivos.length,
      agendaHoje: agendaHoje.length,
      agendaAtrasada: agendaAtrasada.length,
      syncSummary,
      lifecyclePendings,
      lifecyclePendingCount: lifecycleQueue.length,
      lifecycleStrategicCount,
      lifecycleBiologicalCount,
      sanitaryAttention,
      regulatoryCompliance,
      replenishmentAlerts: operationalSummary.inventory.replenishmentAlerts.slice(0, 5),
      proximosItens,
      eventosRecentes: eventosRecentes.map((evento) => {
        const animal = animaisAtivos.find(
          (entry) => entry.id === evento.animal_id,
        );
        const lote = lotesAtivos.find((entry) => entry.id === evento.lote_id);

        return {
          id: evento.id,
          titulo: DOMAIN_LABEL[evento.dominio] ?? "Evento",
          contexto:
            animal?.identificacao ??
            animal?.nome ??
            lote?.nome ??
            "Registro sem animal ou lote vinculado",
          data: evento.occurred_on ?? evento.occurred_at.slice(0, 10),
        };
      }),
      checklist,
    };
  }, [activeFarmId, farmLifecycleConfig]);

  const farmSubtitle = useMemo(() => {
    const parts = [
      farm?.tipo_producao ? PRODUCTION_LABEL[farm.tipo_producao] : null,
      farm?.municipio
        ? `${farm.municipio}${farm.estado ? ` - ${farm.estado}` : ""}`
        : null,
    ].filter(Boolean);

    return parts.length > 0
      ? parts.join(" | ")
      : "Rotina operacional da fazenda";
  }, [farm]);

  const operationalInsightsInput = useMemo<BuildOperationalInsightsInput>(
    () => ({
      generatedAt: snapshot?.generatedAt ?? "1970-01-01T00:00:00.000Z",
      referenceDate: snapshot?.referenceDate ?? "1970-01-01",
      monthlyPeriod: snapshot?.monthlyPeriod ?? EMPTY_MONTHLY_PERIOD,
      sources:
        snapshot?.operationalInsightSources ??
        EMPTY_OPERATIONAL_INSIGHT_SOURCES,
      upcomingDays: 7,
      requireSanitaryProductSource: true,
    }),
    [snapshot],
  );
  const operationalInsights = useOperationalInsights(operationalInsightsInput);

  if (!activeFarmId) {
    return (
      <div className="space-y-5">
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Escolha uma fazenda para comecar</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <Link to="/select-fazenda">Selecionar fazenda</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/criar-fazenda">Criar fazenda</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Carregando a rotina da fazenda</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const overdueItems = snapshot.proximosItens.filter(
    (item) => item.status === "atrasado",
  );
  const todayItems = snapshot.proximosItens.filter(
    (item) => item.status === "hoje",
  );
  const upcomingItems = snapshot.proximosItens.filter(
    (item) => item.status === "proximo",
  );

  return (
    <div className="space-y-5">
      <PageIntro
        variant="plain"
        title="Central Operacional"
        description="O que precisa ser feito, o que ja aconteceu e o estado atual do rebanho."
        meta={
          <>
            <StatusBadge tone="neutral">{farmSubtitle}</StatusBadge>
            {snapshot.syncSummary.pendingCount > 0 ? (
              <StatusBadge tone="warning">
                {snapshot.syncSummary.pendingCount} salvo(s) neste aparelho
              </StatusBadge>
            ) : null}
            {snapshot.agendaAtrasada > 0 ? (
              <StatusBadge tone="warning">
                {snapshot.agendaAtrasada} atraso
                {snapshot.agendaAtrasada > 1 ? "s" : ""}
              </StatusBadge>
            ) : null}
            {snapshot.sanitaryAttention.criticalCount > 0 ? (
              <StatusBadge tone="danger">
                {snapshot.sanitaryAttention.criticalCount} sanitario(s)
                critico(s)
              </StatusBadge>
            ) : snapshot.sanitaryAttention.warningCount > 0 ? (
              <StatusBadge tone="warning">
                {snapshot.sanitaryAttention.warningCount} sanitario(s) no radar
              </StatusBadge>
            ) : null}
            {snapshot.regulatoryCompliance.attention.openCount > 0 ? (
              <StatusBadge
                tone={
                  snapshot.regulatoryCompliance.hasBlockingIssues
                    ? "danger"
                    : "warning"
                }
              >
                {snapshot.regulatoryCompliance.attention.openCount} pendencia(s)
                regulatoria(s)
              </StatusBadge>
            ) : null}
            {snapshot.replenishmentAlerts.length > 0 ? (
              <StatusBadge
                tone={
                  snapshot.replenishmentAlerts.some(
                    (item) => item.severity === "critical",
                  )
                    ? "danger"
                    : "warning"
                }
              >
                {snapshot.replenishmentAlerts.length} reposicao
              </StatusBadge>
            ) : null}
          </>
        }
        actions={
          <>
            <Button asChild>
              <Link to="/registrar">
                <PlusCircle className="h-4 w-4" />
                Registrar manejo
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/agenda">
                <CalendarClock className="h-4 w-4" />
                Ver agenda completa
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/animais">
                <Beef className="h-4 w-4" />
                Ver rebanho
              </Link>
            </Button>
          </>
        }
      />

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
        {[
          {
            label: "Atrasadas",
            value: overdueItems.length,
            hint: "Pendencias vencidas",
            tone: overdueItems.length > 0 ? "danger" : "neutral",
            icon: AlertTriangle,
          },
          {
            label: "Hoje",
            value: todayItems.length,
            hint: "Agenda do dia",
            tone: todayItems.length > 0 ? "warning" : "neutral",
            icon: CalendarClock,
          },
          {
            label: "Animais ativos",
            value: snapshot.animais,
            hint: `${snapshot.lotes} lotes`,
            tone: "success",
            icon: Beef,
          },
          {
            label: "Fila local",
            value: snapshot.syncSummary.pendingCount,
            hint: "A sincronizar",
            tone: snapshot.syncSummary.pendingCount > 0 ? "warning" : "neutral",
            icon: Clock3,
          },
          {
            label: "Estrutura",
            value: `${snapshot.lotes}L`,
            hint: `${snapshot.pastos} pastos`,
            tone: "neutral",
            icon: CheckCircle2,
          },
          {
            label: "Alertas sanitarios",
            value: snapshot.sanitaryAttention.criticalCount,
            hint: "Criticos no horizonte",
            tone:
              snapshot.sanitaryAttention.criticalCount > 0 ? "danger" : "neutral",
            icon: AlertTriangle,
          },
          {
            label: "Reposicao",
            value: snapshot.replenishmentAlerts.length,
            hint: "Estoque no radar",
            tone: snapshot.replenishmentAlerts.some(
              (item) => item.severity === "critical",
            )
              ? "danger"
              : snapshot.replenishmentAlerts.length > 0
                ? "warning"
                : "neutral",
            icon: PackageSearch,
          },
        ].map((item) => (
          <Card
            key={item.label}
            className={cn(
              "shadow-none",
              item.tone === "danger" && "border-destructive/25 bg-destructive/10",
              item.tone === "warning" && "border-warning/20 bg-warning-muted/60",
              item.tone === "success" && "border-success/20 bg-success-muted/60",
            )}
          >
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  {item.label}
                </p>
                <item.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-3xl font-semibold tabular-nums text-foreground">
                {item.value}
              </p>
              <p className="text-sm text-muted-foreground">{item.hint}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Acoes rapidas</CardTitle>
            <span className="text-sm text-muted-foreground">
              Salvo neste aparelho · sincroniza depois
            </span>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Vacinacao", "/registrar?dominio=sanitario"],
            ["Pesagem", "/registrar?dominio=pesagem"],
            ["Movimentacao", "/registrar?dominio=movimentacao"],
            ["Compra", "/registrar?dominio=financeiro&natureza=compra"],
            ["Venda", "/registrar?dominio=financeiro&natureza=venda"],
          ].map(([label, href]) => (
            <Button
              key={label}
              asChild
              variant="outline"
              className="h-20 flex-col gap-2 rounded-xl"
            >
              <Link to={href}>
                <PlusCircle className="h-5 w-5 text-primary" />
                {label}
              </Link>
            </Button>
          ))}
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card
          className={
            overdueItems.length > 0
              ? "border-destructive/25 bg-destructive/10"
              : undefined
          }
        >
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Pendencias atrasadas</CardTitle>
              </div>
              <StatusBadge
                tone={overdueItems.length > 0 ? "danger" : "success"}
              >
                {overdueItems.length} atrasada
                {overdueItems.length === 1 ? "" : "s"}
              </StatusBadge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {overdueItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
                Sem pendencias atrasadas no recorte carregado.
              </div>
            ) : (
              overdueItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-destructive/20 bg-background/70 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{item.titulo}</p>
                        <StatusBadge tone="danger">Atrasado</StatusBadge>
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {item.contexto}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock3 className="h-4 w-4" />
                      <span>{formatDay(item.data)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Agenda de hoje</CardTitle>
              </div>
              <StatusBadge tone={todayItems.length > 0 ? "info" : "neutral"}>
                {todayItems.length} hoje
              </StatusBadge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {todayItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                Nada vence hoje no recorte carregado.
              </div>
            ) : (
              todayItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-info/15 bg-info-muted/35 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{item.titulo}</p>
                        <StatusBadge tone="info">Hoje</StatusBadge>
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {item.contexto}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock3 className="h-4 w-4" />
                      <span>{formatDay(item.data)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

      </section>

      <OperationalInsightsPanel viewModel={operationalInsights} />

      {snapshot.replenishmentAlerts.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Reposicao de estoque</CardTitle>
              <StatusBadge
                tone={
                  snapshot.replenishmentAlerts.some(
                    (item) => item.severity === "critical",
                  )
                    ? "danger"
                    : "warning"
                }
              >
                {snapshot.replenishmentAlerts.length} alerta
                {snapshot.replenishmentAlerts.length === 1 ? "" : "s"}
              </StatusBadge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.replenishmentAlerts.map((item) => (
              <div
                key={item.insumoId}
                className={cn(
                  "rounded-xl border p-4",
                  item.severity === "critical"
                    ? "border-destructive/25 bg-destructive/10"
                    : "border-warning/20 bg-warning-muted/60",
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.insumo}</p>
                      <StatusBadge
                        tone={item.severity === "critical" ? "danger" : "warning"}
                      >
                        {item.severity === "critical" ? "Critico" : "Atencao"}
                      </StatusBadge>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {item.reasons.join(" + ")}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground sm:text-right">
                    <p className="font-medium text-foreground">
                      {item.currentBalanceBase.toLocaleString("pt-BR")}{" "}
                      {item.unidadeBase}
                    </p>
                    <p>
                      Demanda{" "}
                      {item.futureDemandBase == null
                        ? "nao calculada"
                        : `${item.futureDemandBase.toLocaleString("pt-BR")} ${item.unidadeBase}`}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {snapshot.sanitaryAttention.totalOpen > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Alertas sanitarios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                tone={
                  snapshot.sanitaryAttention.criticalCount > 0
                    ? "danger"
                    : "neutral"
                }
              >
                {snapshot.sanitaryAttention.criticalCount} critico(s)
              </StatusBadge>
              <StatusBadge
                tone={
                  snapshot.sanitaryAttention.mandatoryCount > 0
                    ? "warning"
                    : "neutral"
                }
              >
                {snapshot.sanitaryAttention.mandatoryCount} obrigatorio(s)
              </StatusBadge>
              <StatusBadge
                tone={
                  snapshot.sanitaryAttention.requiresVetCount > 0
                    ? "info"
                    : "neutral"
                }
              >
                {snapshot.sanitaryAttention.requiresVetCount} exige(m)
                veterinario
              </StatusBadge>
              {snapshot.sanitaryAttention.scheduleModes.map((mode) => (
                <Button
                  key={mode.key}
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-auto rounded-full px-3 py-1 text-[11px] leading-none"
                >
                  <Link to={buildAgendaCalendarModePath(mode.key)}>
                    {mode.label} {mode.count}
                  </Link>
                </Button>
              ))}
              {snapshot.sanitaryAttention.operationalClasses.map((item) => (
                <Button
                  key={item.key}
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-auto rounded-full px-3 py-1 text-[11px] leading-none"
                >
                  <Link to={buildAgendaOperationalClassPath(item.key)}>
                    {item.label} {item.count}
                  </Link>
                </Button>
              ))}
            </div>

            {snapshot.sanitaryAttention.topItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                Nenhum item sanitario com criticidade destacada no momento.
              </div>
            ) : (
              snapshot.sanitaryAttention.topItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-border/70 bg-muted/35 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{item.titulo}</p>
                        <StatusBadge tone={item.priorityTone}>
                          {item.priorityLabel}
                        </StatusBadge>
                        {item.mandatory ? (
                          <StatusBadge tone="warning">Obrigatorio</StatusBadge>
                        ) : null}
                        {item.requiresVet ? (
                          <StatusBadge tone="info">Veterinario</StatusBadge>
                        ) : null}
                        <StatusBadge tone="neutral">
                          {getSanitaryAttentionOperationalClassLabel(
                            item.operationalClass,
                          )}
                        </StatusBadge>
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {item.contexto}
                      </p>
                      <p className="text-xs uppercase text-muted-foreground">
                        Produto {item.produto}
                        {item.scheduleModeLabel
                          ? ` | ${item.scheduleModeLabel}`
                          : ""}
                        {item.scheduleAnchorLabel
                          ? ` | ${item.scheduleAnchorLabel}`
                          : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock3 className="h-4 w-4" />
                      <span>{formatDay(item.data)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}

            <Button
              asChild
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
            >
              <Link to="/agenda">Abrir agenda sanitaria</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {snapshot.regulatoryCompliance.attention.openCount > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Pendencias regulatorias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {snapshot.regulatoryCompliance.attention.badges.map((badge) => (
                <StatusBadge key={badge.key} tone={badge.tone}>
                  {badge.label} {badge.count}
                </StatusBadge>
              ))}
              {snapshot.regulatoryCompliance.flows.nutrition.blockerCount >
              0 ? (
                <StatusBadge tone="danger">Bloqueia nutricao</StatusBadge>
              ) : null}
              {snapshot.regulatoryCompliance.flows.sale.blockerCount > 0 ? (
                <StatusBadge tone="danger">Bloqueia transito/venda</StatusBadge>
              ) : null}
              {snapshot.regulatoryCompliance.flows.movementInternal
                .warningCount > 0 &&
              snapshot.regulatoryCompliance.flows.sale.blockerCount === 0 ? (
                <StatusBadge tone="warning">Exige revisao de lote</StatusBadge>
              ) : null}
            </div>

            {snapshot.regulatoryCompliance.attention.topItems.map((item) => (
              <div
                key={item.key}
                className="rounded-xl border border-border/70 bg-muted/35 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{item.label}</p>
                  <StatusBadge tone={item.tone}>{item.statusLabel}</StatusBadge>
                  <StatusBadge tone={item.tone}>{item.kindLabel}</StatusBadge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.detail}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.recommendation}
                </p>
              </div>
            ))}

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/protocolos-sanitarios">
                  Abrir overlay de conformidade
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/financeiro">Revisar vendas e transito</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Proximos manejos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                Nenhum manejo futuro no recorte carregado.
              </div>
            ) : (
              upcomingItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-border/70 bg-muted/35 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{item.titulo}</p>
                        <StatusBadge
                          tone={
                            item.status === "atrasado"
                              ? "warning"
                              : item.status === "hoje"
                                ? "info"
                                : "neutral"
                          }
                        >
                          {item.status === "atrasado"
                            ? "Atrasado"
                            : item.status === "hoje"
                              ? "Hoje"
                              : "Proximo"}
                        </StatusBadge>
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {item.contexto}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock3 className="h-4 w-4" />
                      <span>{formatDay(item.data)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Transicoes de estagio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.lifecyclePendings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                Nenhum animal precisa de transicao de estagio neste momento.
              </div>
            ) : (
              snapshot.lifecyclePendings.map((item) => (
                <div
                  key={item.animalId}
                  className="rounded-xl border border-border/70 bg-muted/35 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{item.identificacao}</p>
                    <StatusBadge tone={item.canAutoApply ? "info" : "warning"}>
                      {item.canAutoApply
                        ? "Auto/hibrido"
                        : "Confirmacao manual"}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-sm text-foreground">
                    {item.currentStageLabel} para {item.targetStageLabel}
                  </p>
                  <p className="mt-1 text-xs font-medium uppercase text-muted-foreground">
                    {item.queueKindLabel}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {item.reason}
                  </p>
                  <Button asChild size="sm" variant="outline" className="mt-3">
                    <Link to={`/animais/${item.animalId}`}>Abrir ficha</Link>
                  </Button>
                </div>
              ))
            )}

            {snapshot.lifecyclePendingCount >
            snapshot.lifecyclePendings.length ? (
              <Button asChild variant="ghost" size="sm" className="w-full">
                <Link to="/animais/transicoes">
                  Ver mais{" "}
                  {snapshot.lifecyclePendingCount -
                    snapshot.lifecyclePendings.length}
                </Link>
              </Button>
            ) : null}

            {snapshot.lifecyclePendingCount > 0 ? (
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link to="/animais/transicoes">Abrir mutacao em lote</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Primeiros passos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.checklist.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-border/70 bg-muted/35 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {item.done ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-warning" />
                      )}
                      <p className="font-medium">{item.label}</p>
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {item.helper}
                    </p>
                  </div>
                  <Button
                    asChild
                    variant={item.done ? "ghost" : "outline"}
                    size="sm"
                  >
                    <Link to={item.path}>
                      {item.done ? "Revisar" : "Abrir"}
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <SyncStatusPanel summary={snapshot.syncSummary} />
    </div>
  );
};

export default Home;



