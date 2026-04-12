import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Beef,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Handshake,
  History,
  Layers,
  Map,
  Move,
  PlusCircle,
  RefreshCw,
  Scale,
  Syringe,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { PageIntro } from "@/components/ui/page-intro";
import {
  summarizeSanitaryAgendaAttention,
  type SanitaryAttentionSummary,
} from "@/lib/sanitario/attention";
import {
  buildRegulatoryOperationalReadModel,
  loadRegulatorySurfaceSource,
  type RegulatoryOperationalReadModel,
} from "@/lib/sanitario/regulatoryReadModel";
import { StatusBadge } from "@/components/ui/status-badge";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";

type FarmSummary = {
  nome: string;
  municipio: string | null;
  estado: string | null;
  tipo_producao: "corte" | "leite" | "mista" | null;
};

type HomeSnapshot = {
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

const ROLE_LABEL: Record<string, string> = {
  cowboy: "Operacao",
  manager: "Gestao",
  owner: "Proprietario",
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

const QUICK_ACTIONS = [
  {
    href: "/registrar?quick=vacinacao",
    label: "Vacinacao",
    icon: Syringe,
  },
  {
    href: "/registrar?quick=vermifugacao",
    label: "Vermifugacao",
    icon: Syringe,
  },
  {
    href: "/registrar?quick=pesagem",
    label: "Pesagem",
    icon: Scale,
  },
  {
    href: "/registrar?quick=movimentacao",
    label: "Movimentacao",
    icon: Move,
  },
  {
    href: "/registrar?quick=compra",
    label: "Compra",
    icon: Handshake,
  },
  {
    href: "/registrar?quick=venda",
    label: "Venda",
    icon: Handshake,
  },
] as const;

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
});

function buildAgendaCalendarModePath(mode: string) {
  return `/agenda?calendarMode=${mode}`;
}

function getTodayKey() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function formatDay(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00`));
}

const Home = () => {
  const { activeFarmId, role, farmLifecycleConfig } = useAuth();
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

  const snapshot = useLiveQuery<HomeSnapshot | null>(
    async () => {
      if (!activeFarmId) return null;

      const [
        animais,
        lotes,
        pastos,
        protocolos,
        protocoloItens,
        agendaItens,
        eventos,
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
        loadFarmSyncSummary(activeFarmId),
        loadRegulatorySurfaceSource(activeFarmId),
      ]);

      const todayKey = getTodayKey();
      const animaisDisponiveis = animais.filter((animal) => !animal.deleted_at);
      const animaisAtivos = animais.filter(
        (animal) => !animal.deleted_at && animal.status === "ativo",
      );
      const lotesDisponiveis = lotes.filter((lote) => !lote.deleted_at);
      const lotesAtivos = lotesDisponiveis.filter((lote) => !lote.deleted_at);
      const pastosAtivos = pastos.filter((pasto) => !pasto.deleted_at);
      const protocolosDisponiveis = protocolos.filter((protocolo) => !protocolo.deleted_at);
      const protocolosAtivos = protocolosDisponiveis.filter((protocolo) => protocolo.ativo);
      const protocoloItensDisponiveis = protocoloItens.filter((item) => !item.deleted_at);
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
      const regulatoryCompliance = buildRegulatoryOperationalReadModel(
        regulatorySource,
      );
      const proximosItens = agendaAberta
        .slice()
        .sort((left, right) => left.data_prevista.localeCompare(right.data_prevista))
        .slice(0, 6)
        .map((item) => {
          const animal = animaisAtivos.find((entry) => entry.id === item.animal_id);
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
          done: protocolosAtivos > 0,
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
      const lifecycleBiologicalCount = lifecycleQueue.length - lifecycleStrategicCount;

      return {
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
        proximosItens,
        eventosRecentes: eventosRecentes.map((evento) => {
          const animal = animaisAtivos.find((entry) => entry.id === evento.animal_id);
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
    },
    [activeFarmId, farmLifecycleConfig],
  );

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

  const checklistDone = useMemo(() => {
    if (!snapshot) return 0;
    return snapshot.checklist.filter((item) => item.done).length;
  }, [snapshot]);

  if (!activeFarmId) {
    return (
      <div className="space-y-6">
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>Escolha uma fazenda para comecar</CardTitle>
            <CardDescription>
              O app opera por fazenda ativa. Selecione uma fazenda ou crie a
              primeira para iniciar a rotina.
            </CardDescription>
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
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Carregando a rotina da fazenda</CardTitle>
            <CardDescription>
              Buscando agenda, rebanho e estado de sincronizacao local.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageIntro
        eyebrow="Rotina do dia"
        title={farm?.nome ?? "Sua fazenda"}
        description="Agenda, rebanho e sincronizacao ficam no primeiro plano. A interface privilegia o proximo passo operacional sem competir com informacoes secundarias."
        meta={
          <>
            {role ? <StatusBadge tone="info">{ROLE_LABEL[role] ?? role}</StatusBadge> : null}
            <StatusBadge tone="neutral">{farmSubtitle}</StatusBadge>
            {snapshot.syncSummary.pendingCount > 0 ? (
              <StatusBadge tone="warning">
                {snapshot.syncSummary.pendingCount} salvo(s) neste aparelho
              </StatusBadge>
            ) : null}
            {snapshot.agendaAtrasada > 0 ? (
              <StatusBadge tone="warning">
                {snapshot.agendaAtrasada} atraso{snapshot.agendaAtrasada > 1 ? "s" : ""}
              </StatusBadge>
            ) : null}
            {snapshot.sanitaryAttention.criticalCount > 0 ? (
              <StatusBadge tone="danger">
                {snapshot.sanitaryAttention.criticalCount} sanitario(s) critico(s)
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
                Abrir agenda
              </Link>
            </Button>
          </>
        }
      />

      <SyncStatusPanel summary={snapshot.syncSummary} />

      <Toolbar>
        <ToolbarGroup className="gap-2">
          {QUICK_ACTIONS.map((action) => (
            <Button
              key={action.href}
              asChild
              size="sm"
              variant="outline"
              className="justify-start"
            >
              <Link to={action.href}>
                <action.icon className="h-4 w-4" />
                {action.label}
              </Link>
            </Button>
          ))}
        </ToolbarGroup>
        <ToolbarGroup className="gap-2">
          <Button asChild size="sm" variant="ghost">
            <Link to="/animais">Rebanho</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link to="/onboarding-inicial">Guia inicial</Link>
          </Button>
        </ToolbarGroup>
      </Toolbar>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          label="Animais ativos"
          value={snapshot.animais}
          hint="Base pronta para manejo e historico."
          icon={<Beef className="h-4 w-4" />}
        />
        <MetricCard
          label="Agenda de hoje"
          value={snapshot.agendaHoje}
          hint={
            snapshot.sanitaryAttention.criticalCount > 0
              ? `${snapshot.sanitaryAttention.criticalCount} sanitario(s) critico(s) na agenda.`
              : snapshot.agendaAtrasada > 0
                ? `${snapshot.agendaAtrasada} item(ns) atrasado(s).`
              : "Sem atraso acumulado."
          }
          icon={<CalendarClock className="h-4 w-4" />}
          tone={
            snapshot.sanitaryAttention.criticalCount > 0
              ? "danger"
              : snapshot.agendaAtrasada > 0
                ? "warning"
                : "default"
          }
        />
        <MetricCard
          label="Fila local"
          value={snapshot.syncSummary.pendingCount}
          hint={
            snapshot.syncSummary.rejectionCount > 0
              ? `${snapshot.syncSummary.rejectionCount} rejeicao(oes) para revisar.`
              : snapshot.syncSummary.syncingCount > 0
                ? `${snapshot.syncSummary.syncingCount} gesto(s) em sincronizacao.`
                : snapshot.syncSummary.savedLocalCount > 0
                  ? `${snapshot.syncSummary.savedLocalCount} gesto(s) aguardando rede/worker.`
                  : snapshot.syncSummary.lastCompletedStage === "synced_altered"
                    ? "Ultima confirmacao teve ajuste do servidor."
                    : "Sem fila local pendente."
          }
          icon={<RefreshCw className="h-4 w-4" />}
          tone={
            snapshot.syncSummary.rejectionCount > 0
              ? "danger"
              : snapshot.syncSummary.pendingCount > 0
                ? "warning"
                : "success"
          }
        />
        <MetricCard
          label="Estrutura minima"
          value={`${checklistDone}/${snapshot.checklist.length}`}
          hint="Pastos, lotes, protocolos e primeiros registros."
          icon={<Activity className="h-4 w-4" />}
        />
        <MetricCard
          label="Transicoes de estagio"
          value={snapshot.lifecyclePendingCount}
          hint={
            snapshot.lifecyclePendingCount > 0
              ? `${snapshot.lifecycleStrategicCount} decisao(oes) e ${snapshot.lifecycleBiologicalCount} marco(s) biologico(s).`
              : "Sem transicoes pendentes."
          }
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={snapshot.lifecyclePendingCount > 0 ? "warning" : "default"}
        />
      </section>

      {snapshot.sanitaryAttention.totalOpen > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Alertas sanitarios</CardTitle>
            <CardDescription>
              Itens sanitarios priorizados por criticidade, obrigatoriedade e
              proximidade do prazo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                tone={
                  snapshot.sanitaryAttention.criticalCount > 0 ? "danger" : "neutral"
                }
              >
                {snapshot.sanitaryAttention.criticalCount} critico(s)
              </StatusBadge>
              <StatusBadge
                tone={
                  snapshot.sanitaryAttention.mandatoryCount > 0 ? "warning" : "neutral"
                }
              >
                {snapshot.sanitaryAttention.mandatoryCount} obrigatorio(s)
              </StatusBadge>
              <StatusBadge
                tone={
                  snapshot.sanitaryAttention.requiresVetCount > 0 ? "info" : "neutral"
                }
              >
                {snapshot.sanitaryAttention.requiresVetCount} exige(m) veterinario
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
            </div>

            {snapshot.sanitaryAttention.topItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                Nenhum item sanitario com criticidade destacada no momento.
              </div>
            ) : (
              snapshot.sanitaryAttention.topItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-border/70 bg-muted/35 p-4"
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
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {item.contexto}
                      </p>
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        Produto {item.produto}
                        {item.scheduleModeLabel ? ` | ${item.scheduleModeLabel}` : ""}
                        {item.scheduleAnchorLabel ? ` | ${item.scheduleAnchorLabel}` : ""}
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

            <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
              <Link to="/agenda">Abrir agenda sanitaria</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {snapshot.regulatoryCompliance.attention.openCount > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Pendencias regulatorias</CardTitle>
            <CardDescription>
              A mesma leitura do overlay oficial agora aparece aqui para expor
              restricoes de nutricao, transito e venda sem depender da agenda.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {snapshot.regulatoryCompliance.attention.badges.map((badge) => (
                <StatusBadge key={badge.key} tone={badge.tone}>
                  {badge.label} {badge.count}
                </StatusBadge>
              ))}
              {snapshot.regulatoryCompliance.flows.nutrition.blockerCount > 0 ? (
                <StatusBadge tone="danger">Bloqueia nutricao</StatusBadge>
              ) : null}
              {snapshot.regulatoryCompliance.flows.sale.blockerCount > 0 ? (
                <StatusBadge tone="danger">Bloqueia transito/venda</StatusBadge>
              ) : null}
              {snapshot.regulatoryCompliance.flows.movementInternal.warningCount > 0 &&
              snapshot.regulatoryCompliance.flows.sale.blockerCount === 0 ? (
                <StatusBadge tone="warning">Exige revisao de lote</StatusBadge>
              ) : null}
            </div>

            {snapshot.regulatoryCompliance.attention.topItems.map((item) => (
              <div
                key={item.key}
                className="rounded-2xl border border-border/70 bg-muted/35 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{item.label}</p>
                  <StatusBadge tone={item.tone}>{item.statusLabel}</StatusBadge>
                  <StatusBadge tone={item.tone}>{item.kindLabel}</StatusBadge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{item.detail}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.recommendation}
                </p>
              </div>
            ))}

            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/protocolos-sanitarios">Abrir overlay de conformidade</Link>
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
            <CardTitle>Rotina de hoje</CardTitle>
            <CardDescription>
              O que precisa acontecer agora, com atraso e proximidade visiveis
              sem poluir a tela.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.proximosItens.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                Nenhuma tarefa aberta na agenda. O proximo passo e registrar um
                manejo ou ativar protocolos sanitarios.
              </div>
            ) : (
              snapshot.proximosItens.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-border/70 bg-muted/35 p-4"
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
            <CardDescription>
              Sugestoes geradas pelo perfil do animal e pelas regras da fazenda.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.lifecyclePendings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                Nenhum animal precisa de transicao de estagio neste momento.
              </div>
            ) : (
              snapshot.lifecyclePendings.map((item) => (
                <div
                  key={item.animalId}
                  className="rounded-2xl border border-border/70 bg-muted/35 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{item.identificacao}</p>
                    <StatusBadge tone={item.canAutoApply ? "info" : "warning"}>
                      {item.canAutoApply ? "Auto/hibrido" : "Confirmacao manual"}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 text-sm text-foreground">
                    {item.currentStageLabel} para {item.targetStageLabel}
                  </p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
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

            {snapshot.lifecyclePendingCount > snapshot.lifecyclePendings.length ? (
              <Button asChild variant="ghost" size="sm" className="w-full">
                <Link to="/animais/transicoes">
                  Ver mais{" "}
                  {snapshot.lifecyclePendingCount - snapshot.lifecyclePendings.length}
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
            <CardDescription>
              Checklist minimo para sair do cadastro inicial e entrar em rotina.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.checklist.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-border/70 bg-muted/35 p-4"
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
                  <Button asChild variant={item.done ? "ghost" : "outline"} size="sm">
                    <Link to={item.path}>{item.done ? "Revisar" : "Abrir"}</Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Manejo recente</CardTitle>
            <CardDescription>
              Ultimos eventos registrados na fazenda.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.eventosRecentes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                Ainda nao ha eventos registrados. Use o fluxo de registro rapido
                para comecar pelo primeiro manejo.
              </div>
            ) : (
              snapshot.eventosRecentes.map((evento) => (
                <div
                  key={evento.id}
                  className="rounded-2xl border border-border/70 bg-muted/35 p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-muted-foreground" />
                        <p className="font-medium">{evento.titulo}</p>
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">
                        {evento.contexto}
                      </p>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatDay(evento.data)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumo da base</CardTitle>
            <CardDescription>
              Estrutura minima para tocar o dia a dia sem depender de planilha.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Layers className="h-4 w-4" />
                Lotes ativos
              </div>
              <p className="mt-3 text-2xl font-semibold">{snapshot.lotes}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Map className="h-4 w-4" />
                Pastos
              </div>
              <p className="mt-3 text-2xl font-semibold">{snapshot.pastos}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Activity className="h-4 w-4" />
                Protocolos ativos
              </div>
              <p className="mt-3 text-2xl font-semibold">{snapshot.protocolos}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4" />
                Erros de sync
              </div>
              <p className="mt-3 text-2xl font-semibold">
                {snapshot.syncSummary.rejectionCount}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default Home;
