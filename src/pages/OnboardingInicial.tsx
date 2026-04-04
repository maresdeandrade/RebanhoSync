import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowRight,
  Beef,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Map,
  Settings2,
  Upload,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { db } from "@/lib/offline/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

type OnboardingAction = {
  label: string;
  path: string;
  variant: "default" | "outline" | "secondary";
};

type OnboardingStep = {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  done: boolean;
  currentState: string;
  impact: string;
  successCriteria: string[];
  actions: OnboardingAction[];
  icon: typeof Settings2;
};

const EMPTY_SNAPSHOT = {
  pastos: 0,
  lotes: 0,
  animais: 0,
  protocolos: 0,
  eventos: 0,
};

const OnboardingInicial = () => {
  const { activeFarmId } = useAuth();
  const [farm, setFarm] = useState<FarmSummary | null>(null);
  const [selectedStepIndex, setSelectedStepIndex] = useState(0);

  useEffect(() => {
    const loadFarm = async () => {
      if (!activeFarmId) {
        setFarm(null);
        return;
      }

      const { data } = await supabase
        .from("fazendas")
        .select("nome, municipio, estado, tipo_producao")
        .eq("id", activeFarmId)
        .is("deleted_at", null)
        .maybeSingle();

      setFarm(data ?? null);
    };

    loadFarm();
  }, [activeFarmId]);

  const snapshot = useLiveQuery(
    async () => {
      if (!activeFarmId) return null;

      const [pastos, lotes, animais, protocolos, eventos] = await Promise.all([
        db.state_pastos.where("fazenda_id").equals(activeFarmId).toArray(),
        db.state_lotes.where("fazenda_id").equals(activeFarmId).toArray(),
        db.state_animais.where("fazenda_id").equals(activeFarmId).toArray(),
        db.state_protocolos_sanitarios
          .where("fazenda_id")
          .equals(activeFarmId)
          .toArray(),
        db.event_eventos.where("fazenda_id").equals(activeFarmId).toArray(),
      ]);

      return {
        pastos: pastos.filter((item) => !item.deleted_at).length,
        lotes: lotes.filter((item) => !item.deleted_at).length,
        animais: animais.filter((item) => !item.deleted_at).length,
        protocolos: protocolos.filter(
          (item) => !item.deleted_at && item.ativo,
        ).length,
        eventos: eventos.filter((item) => !item.deleted_at).length,
      };
    },
    [activeFarmId],
  );

  const counts = snapshot ?? EMPTY_SNAPSHOT;

  const steps = useMemo<OnboardingStep[]>(() => {
    const localizacao =
      farm?.municipio && farm?.estado
        ? `${farm.municipio} - ${farm.estado}`
        : "Localizacao nao revisada";
    const tipoProducao = farm?.tipo_producao
      ? `Producao ${farm.tipo_producao}`
      : "Tipo de producao nao definido";

    return [
      {
        id: "fazenda",
        title: "1. Revisar os dados da fazenda",
        shortTitle: "Fazenda",
        description:
          "Confirme localizacao e tipo de producao antes de montar a estrutura.",
        done: Boolean(farm?.tipo_producao || farm?.municipio || farm?.estado),
        currentState: `${localizacao} · ${tipoProducao}`,
        impact:
          "Isso evita cadastro torto logo no comeco e deixa a fazenda pronta para uso real.",
        successCriteria: [
          "Nome e localizacao revisados.",
          "Tipo de producao definido.",
        ],
        actions: [
          {
            label: "Editar fazenda",
            path: "/editar-fazenda",
            variant: "default",
          },
        ],
        icon: Settings2,
      },
      {
        id: "pastos",
        title: "2. Trazer os pastos",
        shortTitle: "Pastos",
        description:
          "Cadastre ou importe a estrutura fisica para preparar lotes e movimentacoes.",
        done: counts.pastos > 0,
        currentState: `${counts.pastos} pasto(s) cadastrado(s)`,
        impact:
          "Com pasto pronto, voce consegue organizar lotes e enxergar a ocupacao da fazenda.",
        successCriteria: [
          "Ao menos um pasto ativo cadastrado.",
          "Area e tipo de pasto informados no minimo basico.",
        ],
        actions: [
          {
            label: "Importar planilha",
            path: "/pastos/importar",
            variant: "default",
          },
          {
            label: "Novo pasto",
            path: "/pastos/novo",
            variant: "outline",
          },
        ],
        icon: Map,
      },
      {
        id: "lotes",
        title: "3. Organizar os lotes",
        shortTitle: "Lotes",
        description:
          "Monte os agrupamentos do rebanho antes de importar ou cadastrar os animais.",
        done: counts.lotes > 0,
        currentState: `${counts.lotes} lote(s) cadastrado(s)`,
        impact:
          "O lote deixa a rotina mais simples e evita retrabalho quando o rebanho entrar.",
        successCriteria: [
          "Ao menos um lote ativo criado.",
          "Lote vinculado ao pasto quando fizer sentido.",
        ],
        actions: [
          {
            label: "Importar planilha",
            path: "/lotes/importar",
            variant: "default",
          },
          {
            label: "Novo lote",
            path: "/lotes/novo",
            variant: "outline",
          },
        ],
        icon: ClipboardList,
      },
      {
        id: "animais",
        title: "4. Trazer o rebanho inicial",
        shortTitle: "Rebanho",
        description:
          "Importe a planilha ou cadastre os primeiros animais para sair do caderno.",
        done: counts.animais > 0,
        currentState: `${counts.animais} animal(is) cadastrados`,
        impact:
          "Sem rebanho dentro do sistema, agenda, manejo e financeiro nao geram valor diario.",
        successCriteria: [
          "Ao menos um animal ativo cadastrado.",
          "Identificacao e sexo preenchidos no minimo.",
        ],
        actions: [
          {
            label: "Importar planilha",
            path: "/animais/importar",
            variant: "default",
          },
          {
            label: "Cadastrar animal",
            path: "/animais/novo",
            variant: "outline",
          },
        ],
        icon: Beef,
      },
      {
        id: "protocolos",
        title: "5. Ativar protocolos sanitarios",
        shortTitle: "Protocolos",
        description:
          "Com o rebanho dentro, ligue os protocolos para a agenda automatica começar a trabalhar.",
        done: counts.protocolos > 0,
        currentState: `${counts.protocolos} protocolo(s) ativo(s)`,
        impact:
          "Essa etapa transforma cadastro em rotina acompanhada e reduz esquecimento operacional.",
        successCriteria: [
          "Ao menos um protocolo ativo.",
          "Agenda gerada para os proximos manejos.",
        ],
        actions: [
          {
            label: "Abrir protocolos",
            path: "/protocolos-sanitarios",
            variant: "default",
          },
        ],
        icon: CalendarClock,
      },
      {
        id: "manejo",
        title: "6. Registrar o primeiro manejo",
        shortTitle: "Primeiro manejo",
        description:
          "Valide o fluxo de campo registrando um manejo real e conferindo a fila offline.",
        done: counts.eventos > 0,
        currentState: `${counts.eventos} manejo(s) registrado(s)`,
        impact:
          "Aqui voce confirma que a fazenda entrou na rotina do app, nao so no cadastro.",
        successCriteria: [
          "Pelo menos um manejo registrado.",
          "Evento salvo localmente e pronto para sincronizar.",
        ],
        actions: [
          {
            label: "Registrar manejo",
            path: "/registrar?quick=vacinacao",
            variant: "default",
          },
          {
            label: "Abrir agenda",
            path: "/agenda",
            variant: "outline",
          },
        ],
        icon: CheckCircle2,
      },
    ];
  }, [counts.animais, counts.eventos, counts.lotes, counts.pastos, counts.protocolos, farm]);

  const completedSteps = steps.filter((step) => step.done).length;
  const recommendedStepIndex = useMemo(() => {
    const firstPending = steps.findIndex((step) => !step.done);
    return firstPending === -1 ? steps.length - 1 : firstPending;
  }, [steps]);

  useEffect(() => {
    setSelectedStepIndex((currentIndex) => {
      if (currentIndex < 0 || currentIndex >= steps.length) {
        return recommendedStepIndex;
      }

      if (steps[currentIndex]?.done && recommendedStepIndex !== currentIndex) {
        return recommendedStepIndex;
      }

      return currentIndex;
    });
  }, [recommendedStepIndex, steps]);

  const selectedStep = steps[selectedStepIndex] ?? steps[0];
  const progressValue = Math.round((completedSteps / steps.length) * 100);
  const nextAction = selectedStep?.actions[0] ?? null;
  const canGoBack = selectedStepIndex > 0;
  const canGoForward = selectedStepIndex < steps.length - 1;

  if (!activeFarmId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Selecione uma fazenda</CardTitle>
          <CardDescription>
            O onboarding inicial depende de uma fazenda ativa.
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

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <Badge variant="secondary">Wizard de implantacao</Badge>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">
                Implantacao guiada da fazenda
              </h1>
              <p className="text-sm text-muted-foreground">
                {farm?.nome ?? "Fazenda ativa"} · siga a ordem abaixo para sair
                do cadastro solto e entrar na rotina diaria.
              </p>
            </div>
          </div>

          <div className="min-w-[280px] rounded-xl border bg-muted/30 px-4 py-3">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Progresso</span>
              <span>
                {completedSteps}/{steps.length} etapas
              </span>
            </div>
            <Progress value={progressValue} className="mt-3 h-3" />
            <p className="mt-3 text-sm text-muted-foreground">
              Proxima recomendacao:{" "}
              <span className="font-medium text-foreground">
                {steps[recommendedStepIndex]?.shortTitle}
              </span>
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Sequencia recomendada</CardTitle>
            <CardDescription>
              O foco inicial e construir estrutura, trazer o rebanho e validar
              um manejo real.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {steps.map((step, index) => {
              const isSelected = index === selectedStepIndex;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setSelectedStepIndex(index)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <div className="rounded-lg bg-primary/10 p-2 text-primary">
                        <step.icon className="h-4 w-4" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-medium">{step.shortTitle}</div>
                        <div className="text-xs text-muted-foreground">
                          {step.currentState}
                        </div>
                      </div>
                    </div>
                    <Badge variant={step.done ? "secondary" : "outline"}>
                      {step.done ? "OK" : index === recommendedStepIndex ? "Agora" : "Pendente"}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <Badge variant={selectedStep.done ? "secondary" : "outline"}>
                    {selectedStep.done ? "Etapa concluida" : "Etapa em foco"}
                  </Badge>
                  <div>
                    <CardTitle className="text-2xl">{selectedStep.title}</CardTitle>
                    <CardDescription className="mt-2 text-sm">
                      {selectedStep.description}
                    </CardDescription>
                  </div>
                </div>
                <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm">
                  <div className="text-muted-foreground">Estado atual</div>
                  <div className="mt-1 font-medium">{selectedStep.currentState}</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="text-sm font-medium">Por que essa etapa importa</div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {selectedStep.impact}
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-xl border p-4">
                  <div className="text-sm font-medium">Concluida quando</div>
                  <div className="mt-3 space-y-2">
                    {selectedStep.successCriteria.map((criterion) => (
                      <div
                        key={criterion}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                        <span>{criterion}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border p-4">
                  <div className="text-sm font-medium">Acoes desta etapa</div>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {selectedStep.actions.map((action) => (
                      <Button key={action.path} asChild variant={action.variant}>
                        <Link to={action.path}>
                          {action.path.endsWith("/importar") && (
                            <Upload className="h-4 w-4" />
                          )}
                          {action.label}
                        </Link>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setSelectedStepIndex((current) => Math.max(0, current - 1))
                    }
                    disabled={!canGoBack}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Etapa anterior
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setSelectedStepIndex((current) =>
                        Math.min(steps.length - 1, current + 1),
                      )
                    }
                    disabled={!canGoForward}
                  >
                    Proxima etapa
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {nextAction && (
                  <Button asChild>
                    <Link to={nextAction.path}>
                      Abrir proximo passo
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Pastos</CardDescription>
                <CardTitle>{counts.pastos}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Lotes</CardDescription>
                <CardTitle>{counts.lotes}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Animais</CardDescription>
                <CardTitle>{counts.animais}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Protocolos</CardDescription>
                <CardTitle>{counts.protocolos}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Manejos</CardDescription>
                <CardTitle>{counts.eventos}</CardTitle>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingInicial;
