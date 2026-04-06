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
  DollarSign,
  FileText,
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
import {
  getAnimalLifeStageLabel,
  getPendingAnimalLifecycleKindLabel,
  getPendingAnimalLifecycleTransitions,
} from "@/lib/animals/lifecycle";
import { supabase } from "@/lib/supabase";
import { db } from "@/lib/offline/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
  pendenciasSync: number;
  errosSync: number;
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
        agendaItens,
        eventos,
        gestos,
        rejeicoes,
      ] = await Promise.all([
        db.state_animais.where("fazenda_id").equals(activeFarmId).toArray(),
        db.state_lotes.where("fazenda_id").equals(activeFarmId).toArray(),
        db.state_pastos.where("fazenda_id").equals(activeFarmId).toArray(),
        db.state_protocolos_sanitarios
          .where("fazenda_id")
          .equals(activeFarmId)
          .toArray(),
        db.state_agenda_itens.where("fazenda_id").equals(activeFarmId).toArray(),
        db.event_eventos.where("fazenda_id").equals(activeFarmId).toArray(),
        db.queue_gestures.where("fazenda_id").equals(activeFarmId).toArray(),
        db.queue_rejections.where("fazenda_id").equals(activeFarmId).toArray(),
      ]);

      const todayKey = getTodayKey();
      const animaisAtivos = animais.filter(
        (animal) => !animal.deleted_at && animal.status === "ativo",
      );
      const lotesAtivos = lotes.filter((lote) => !lote.deleted_at);
      const pastosAtivos = pastos.filter((pasto) => !pasto.deleted_at);
      const protocolosAtivos = protocolos.filter(
        (protocolo) => !protocolo.deleted_at && protocolo.ativo,
      );
      const agendaAberta = agendaItens.filter(
        (item) => !item.deleted_at && item.status === "agendado",
      );
      const eventosRecentes = eventos
        .filter((evento) => !evento.deleted_at)
        .sort((left, right) => right.occurred_at.localeCompare(left.occurred_at))
        .slice(0, 5);
      const pendenciasSync = gestos.filter(
        (gesto) => gesto.status === "PENDING" || gesto.status === "SYNCING",
      ).length;
      const agendaHoje = agendaAberta.filter(
        (item) => item.data_prevista === todayKey,
      );
      const agendaAtrasada = agendaAberta.filter(
        (item) => item.data_prevista < todayKey,
      );
      const proximosItens = agendaAberta
        .slice()
        .sort((left, right) => left.data_prevista.localeCompare(right.data_prevista))
        .slice(0, 6)
        .map((item) => {
          const animal = animaisAtivos.find((entry) => entry.id === item.animal_id);
          const lote = lotesAtivos.find((entry) => entry.id === item.lote_id);
          const status =
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
      const lifecyclePendings = lifecycleQueue
        .slice(0, 5)
        .map((item) => ({
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
        pendenciasSync,
        errosSync: rejeicoes.length,
        lifecyclePendings,
        lifecyclePendingCount: lifecycleQueue.length,
        lifecycleStrategicCount,
        lifecycleBiologicalCount,
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
      farm?.municipio ? `${farm.municipio}${farm.estado ? ` - ${farm.estado}` : ""}` : null,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(" • ") : "Rotina operacional da fazenda";
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
              O app ja esta pronto para operar por fazenda ativa. Selecione uma
              fazenda ou crie a primeira para iniciar a rotina.
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
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Hoje na fazenda</Badge>
            {role && <Badge variant="outline">{ROLE_LABEL[role] ?? role}</Badge>}
            {snapshot.agendaAtrasada > 0 && (
              <Badge variant="destructive">
                {snapshot.agendaAtrasada} atraso
                {snapshot.agendaAtrasada > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {farm?.nome ?? "Sua fazenda"}
            </h1>
            <p className="text-sm text-muted-foreground">{farmSubtitle}</p>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Foco no que precisa acontecer hoje: agenda, rebanho e
            sincronizacao. O resto fica acessivel, mas nao disputa atencao com
            a operacao.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button asChild variant="outline" className="justify-start">
            <Link to="/onboarding-inicial">
              <CheckCircle2 className="h-4 w-4" />
              Guia inicial
            </Link>
          </Button>
          <Button asChild className="justify-start">
            <Link to="/registrar">
              <PlusCircle className="h-4 w-4" />
              Registrar manejo
            </Link>
          </Button>
          <Button asChild variant="outline" className="justify-start">
            <Link to="/agenda">
              <CalendarClock className="h-4 w-4" />
              Ver agenda
            </Link>
          </Button>
          <Button asChild variant="outline" className="justify-start">
            <Link to="/animais">
              <Beef className="h-4 w-4" />
              Abrir rebanho
            </Link>
          </Button>
          <Button asChild variant="outline" className="justify-start">
            <Link to="/financeiro">
              <DollarSign className="h-4 w-4" />
              Financeiro basico
            </Link>
          </Button>
          <Button asChild variant="outline" className="justify-start">
            <Link to="/relatorios">
              <FileText className="h-4 w-4" />
              Resumo operacional
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Button asChild variant="outline" className="h-auto justify-start py-4">
          <Link to="/registrar?quick=vacinacao">
            <Syringe className="h-4 w-4" />
            Vacinacao rapida
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto justify-start py-4">
          <Link to="/registrar?quick=vermifugacao">
            <Syringe className="h-4 w-4" />
            Vermifugacao
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto justify-start py-4">
          <Link to="/registrar?quick=pesagem">
            <Scale className="h-4 w-4" />
            Pesagem
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto justify-start py-4">
          <Link to="/registrar?quick=movimentacao">
            <Move className="h-4 w-4" />
            Movimentacao
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto justify-start py-4">
          <Link to="/registrar?quick=compra">
            <Handshake className="h-4 w-4" />
            Compra simples
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-auto justify-start py-4">
          <Link to="/registrar?quick=venda">
            <Handshake className="h-4 w-4" />
            Venda simples
          </Link>
        </Button>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription>Animais ativos</CardDescription>
            <Beef className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{snapshot.animais}</div>
            <p className="text-sm text-muted-foreground">
              Base pronta para manejo e historico.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription>Agenda de hoje</CardDescription>
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{snapshot.agendaHoje}</div>
            <p className="text-sm text-muted-foreground">
              {snapshot.agendaAtrasada > 0
                ? `${snapshot.agendaAtrasada} item(ns) atrasado(s).`
                : "Sem atraso acumulado na rotina."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription>Sincronizacao</CardDescription>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{snapshot.pendenciasSync}</div>
            <p className="text-sm text-muted-foreground">
              {snapshot.errosSync > 0
                ? `${snapshot.errosSync} erro(s) para revisar.`
                : "Fila local sob controle."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription>Estrutura minima</CardDescription>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {checklistDone}/{snapshot.checklist.length}
            </div>
            <p className="text-sm text-muted-foreground">
              Pastos, lotes, protocolos e primeiros registros.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardDescription>Transicoes de estagio</CardDescription>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{snapshot.lifecyclePendingCount}</div>
            <p className="text-sm text-muted-foreground">
              {snapshot.lifecyclePendingCount > 0
                ? `${snapshot.lifecycleStrategicCount} decisao(oes) e ${snapshot.lifecycleBiologicalCount} marco(s) biologico(s).`
                : "Sem transicoes de vida pendentes."}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Rotina de hoje</CardTitle>
            <CardDescription>
              Proximas tarefas do manejo, com destaque para o que ja esta em
              atraso.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.proximosItens.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Nenhuma tarefa aberta na agenda. O proximo passo e registrar um
                manejo ou ativar protocolos sanitarios.
              </div>
            ) : (
              snapshot.proximosItens.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.titulo}</p>
                      <Badge
                        variant={
                          item.status === "atrasado"
                            ? "destructive"
                            : item.status === "hoje"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {item.status === "atrasado"
                          ? "Atrasado"
                          : item.status === "hoje"
                            ? "Hoje"
                            : "Proximo"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {item.contexto}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Clock3 className="h-4 w-4" />
                    <span>{formatDay(item.data)}</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Transicoes de estagio</CardTitle>
            <CardDescription>
              Sugestoes vindas do perfil do animal e das regras da fazenda.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.lifecyclePendings.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Nenhum animal precisa de transicao de estagio neste momento.
              </div>
            ) : (
              snapshot.lifecyclePendings.map((item) => (
                <div
                  key={item.animalId}
                  className="space-y-2 rounded-xl border p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{item.identificacao}</p>
                    <Badge variant={item.canAutoApply ? "secondary" : "outline"}>
                      {item.canAutoApply ? "Auto/hibrido" : "Confirmacao manual"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.currentStageLabel} para {item.targetStageLabel}
                  </p>
                  <p className="text-xs font-medium text-muted-foreground">
                    {item.queueKindLabel}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.reason}</p>
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/animais/${item.animalId}`}>Abrir ficha</Link>
                  </Button>
                </div>
              ))
            )}
            {snapshot.lifecyclePendingCount > snapshot.lifecyclePendings.length && (
              <Button asChild variant="ghost" size="sm" className="w-full">
                <Link to="/animais/transicoes">
                  Ver mais {snapshot.lifecyclePendingCount - snapshot.lifecyclePendings.length}
                </Link>
              </Button>
            )}
            {snapshot.lifecyclePendingCount > 0 && (
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link to="/animais/transicoes">Abrir mutacao em lote</Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Primeiros passos da fazenda</CardTitle>
            <CardDescription>
              Checklist minimo para sair do cadastro inicial e entrar em rotina.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.checklist.map((item) => (
              <div
                key={item.label}
                className="flex items-start justify-between gap-3 rounded-xl border p-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {item.done ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                    )}
                    <p className="font-medium">{item.label}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.helper}</p>
                </div>
                <Button asChild variant={item.done ? "ghost" : "outline"} size="sm">
                  <Link to={item.path}>{item.done ? "Revisar" : "Abrir"}</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Manejo recente</CardTitle>
            <CardDescription>
              Ultimos eventos registrados na fazenda.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {snapshot.eventosRecentes.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Ainda nao ha eventos registrados. Use o fluxo de registro rapido
                para começar pelo primeiro manejo.
              </div>
            ) : (
              snapshot.eventosRecentes.map((evento) => (
                <div
                  key={evento.id}
                  className="flex items-center justify-between gap-3 rounded-xl border p-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <History className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">{evento.titulo}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {evento.contexto}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatDay(evento.data)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Resumo da base</CardTitle>
            <CardDescription>
              Estrutura minima para tocar o dia a dia sem depender de planilha.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Layers className="h-4 w-4" />
                Lotes ativos
              </div>
              <p className="mt-2 text-2xl font-semibold">{snapshot.lotes}</p>
            </div>
            <div className="rounded-xl border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Map className="h-4 w-4" />
                Pastos
              </div>
              <p className="mt-2 text-2xl font-semibold">{snapshot.pastos}</p>
            </div>
            <div className="rounded-xl border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Activity className="h-4 w-4" />
                Protocolos ativos
              </div>
              <p className="mt-2 text-2xl font-semibold">{snapshot.protocolos}</p>
            </div>
            <div className="rounded-xl border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4" />
                Erros de sync
              </div>
              <p className="mt-2 text-2xl font-semibold">{snapshot.errosSync}</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default Home;
