import { useMemo, useState } from "react";
import { differenceInDays, parseISO } from "date-fns";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ChevronLeft,
  ClipboardCheck,
  Map as MapIcon,
  PawPrint,
  MoreHorizontal,
  Pencil,
  Trees,
  Scale,
  TrendingUp,
  Layers,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Clock,
  ArrowRightLeft,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { EmptyState } from "@/components/EmptyState";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageIntro } from "@/components/ui/page-intro";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import type {
  PastoAguaStatusEnum,
  PastoAvaliacaoMomentoEnum,
  PastoCoberturaSoloEnum,
  PastoFezesScoreEnum,
  PastoInvasorasNivelEnum,
  SuplementoUnidadeEnum,
} from "@/lib/offline/types";
import { showError, showSuccess } from "@/utils/toast";
import { Card, CardContent } from "@/components/ui/card";
import { AnimalMovementHistoryTable } from "@/features/occupancy/AnimalMovementHistoryTable";
import { OccupancyEntryInfo, OccupancyTimeline, CollapsibleInfrastructure, OccupancyAlert } from "@/features/occupancy";

import { calculatePastoMetrics } from "@/features/occupancy/cockpitManejoAdapter";
import { TimelineFactual } from "@/components/timeline/TimelineFactual";
import { useAuth } from "@/hooks/useAuth";
import { usePastoWithdrawal } from "@/lib/sanitario/hooks/useWithdrawal";
import { WithdrawalBadgePanel } from "@/components/sanitario/WithdrawalBadgePanel";

const EMPTY_ARRAY: never[] = [];

function parseOptionalNumber(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return { value: null, valid: true };

  const parsed = Number(normalized);
  return {
    value: Number.isFinite(parsed) ? parsed : null,
    valid: Number.isFinite(parsed),
  };
}

function formatDateTime(value?: string | null) {
  if (!value) return "Data nao informada";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

const labelize = (value?: string | null) =>
  value ? value.replaceAll("_", " ") : "Nao informado";

const ECC_OPTIONS = [
  "1.0",
  "1.5",
  "2.0",
  "2.5",
  "3.0",
  "3.5",
  "4.0",
  "4.5",
  "5.0",
];

const SUPLEMENTO_OPTIONS = [
  { value: "nenhum", label: "Nenhum", unidade: "" },
  { value: "sal_mineral", label: "Sal Mineral", unidade: "sacos" },
  { value: "sal_ureado", label: "Sal Ureado", unidade: "sacos" },
  {
    value: "proteinado",
    label: "Proteinado (Suplemento Proteico)",
    unidade: "sacos",
  },
  {
    value: "proteico_energetico",
    label: "Proteico-Energetico",
    unidade: "sacos",
  },
  { value: "racao", label: "Racao (Concentrado)", unidade: "kg" },
] as const;

type SuplementoTipoValue = (typeof SUPLEMENTO_OPTIONS)[number]["value"];

const SUPLEMENTO_BY_VALUE = new Map(
  SUPLEMENTO_OPTIONS.map((option) => [option.value, option]),
);

interface CockpitCardProps {
  title: string;
  value: string | number | null;
  unit?: string;
  icon: React.ReactNode;
  status: "empty" | "partial" | "complete" | "blocked";
  reason?: string;
  source?: string;
  limitation?: string;
  extraContent?: React.ReactNode;
}

function CockpitCard({
  title,
  value,
  unit,
  icon,
  status,
  reason,
  source,
  limitation,
  extraContent,
}: CockpitCardProps) {
  const getStatusStyles = (s: typeof status) => {
    switch (s) {
      case "complete":
        return "border-emerald-200 bg-emerald-50/20 text-emerald-800 dark:border-emerald-800/20 dark:bg-emerald-950/10 dark:text-emerald-300";
      case "partial":
        return "border-amber-200 bg-amber-50/20 text-amber-800 dark:border-amber-800/20 dark:bg-amber-950/10 dark:text-amber-300";
      case "blocked":
        return "border-rose-200 bg-rose-50/20 text-rose-800 dark:border-rose-800/20 dark:bg-rose-950/10 dark:text-rose-300";
      default:
        return "border-slate-200 bg-slate-50/20 text-slate-800 dark:border-slate-800/20 dark:bg-slate-900/10 dark:text-slate-400";
    }
  };

  const getStatusLabel = (s: typeof status) => {
    switch (s) {
      case "complete":
        return "Completo";
      case "partial":
        return "Parcial";
      case "blocked":
        return "Bloqueado";
      default:
        return "Vazio";
    }
  };

  const getStatusBadgeStyles = (s: typeof status) => {
    switch (s) {
      case "complete":
        return "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800";
      case "partial":
        return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-800";
      case "blocked":
        return "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800";
      default:
        return "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    }
  };

  return (
    <div className={`flex flex-col justify-between rounded-xl border p-4 shadow-sm transition-all hover:shadow-md ${getStatusStyles(status)}`}>
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-background/50 border border-current/10">
              {icon}
            </div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {title}
            </h4>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getStatusBadgeStyles(status)}`}>
            {getStatusLabel(status)}
          </span>
        </div>

        <div className="space-y-1">
          <p className="text-2xl font-extrabold tracking-tight text-foreground">
            {value !== null ? (typeof value === "number" ? value.toFixed(1) : value) : "—"}
            {value !== null && unit && (
              <span className="text-xs font-semibold text-muted-foreground ml-1.5 uppercase tracking-wide">
                {unit}
              </span>
            )}
          </p>
          {reason && (
            <p className="text-xs font-medium text-foreground/80 leading-snug">
              {reason}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-current/10 space-y-1.5 text-[11px] text-muted-foreground">
        {source && (
          <p>
            <span className="font-semibold text-foreground/75">Fonte:</span> {source}
          </p>
        )}
        {limitation && (
          <p className="text-amber-700/90 dark:text-amber-400/90 font-medium">
            <span className="font-semibold">Nota:</span> {limitation}
          </p>
        )}
        {extraContent}
      </div>
    </div>
  );
}

const PastoDetalhe = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [rondaOpen, setRondaOpen] = useState(false);
  const [momento, setMomento] = useState<PastoAvaliacaoMomentoEnum>("ronda");
  const [alturaCm, setAlturaCm] = useState("");
  const [coberturaSolo, setCoberturaSolo] = useState<PastoCoberturaSoloEnum | "">("");
  const [invasorasNivel, setInvasorasNivel] = useState<PastoInvasorasNivelEnum | "">("");
  const [aguaStatus, setAguaStatus] = useState<PastoAguaStatusEnum | "">("");
  const [eccLoteMedio, setEccLoteMedio] = useState("");
  const [fezesScore, setFezesScore] = useState<PastoFezesScoreEnum | "">("");
  const [suplementoTipo, setSuplementoTipo] = useState<SuplementoTipoValue>("nenhum");
  const [suplementoQuantidade, setSuplementoQuantidade] = useState("");
  const [rondaObservacoes, setRondaObservacoes] = useState("");
  const [showSemEcc, setShowSemEcc] = useState(false);

  const { farmLifecycleConfig, activeFarmId } = useAuth();
  const weightFreshnessDays = farmLifecycleConfig?.weightFreshnessDays;
  const carenciaModel = usePastoWithdrawal(id ?? null, activeFarmId ?? null);

  // Dexie Reactive Queries
  const pasto = useLiveQuery(
    () => (id ? db.state_pastos.get(id) : undefined),
    [id],
  );
  const lotes = useLiveQuery(
    () => (id ? db.state_lotes.where("pasto_id").equals(id).toArray() : []),
    [id],
  );

  const pastos = useLiveQuery(() => db.state_pastos.toArray()) ?? EMPTY_ARRAY;
  const animals = useLiveQuery(() => db.state_animais.toArray()) ?? EMPTY_ARRAY;
  const events = useLiveQuery(() => db.event_eventos.toArray()) ?? EMPTY_ARRAY;
  const pesagens = useLiveQuery(() => db.event_eventos_pesagem.toArray()) ?? EMPTY_ARRAY;
  const eccs = useLiveQuery(() => db.event_eventos_ecc.toArray()) ?? EMPTY_ARRAY;
  const movimentacoes = useLiveQuery(() => db.event_eventos_movimentacao.toArray()) ?? EMPTY_ARRAY;
  const agendaItens = useLiveQuery(() => db.state_agenda_itens.toArray()) ?? EMPTY_ARRAY;
  const pastoOcupacoes = useLiveQuery(() => db.state_pasto_ocupacoes.toArray()) ?? EMPTY_ARRAY;

  const referenceDate = useMemo(() => new Date().toISOString(), []);

  // Pasto Cockpit Metrics Calculation
  const pastoMetrics = useMemo(() => {
    if (!id || !lotes || !animals) return null;
    return calculatePastoMetrics(
      id,
      referenceDate,
      weightFreshnessDays,
      animals,
      lotes,
      pastos,
      events,
      pesagens,
      eccs,
      movimentacoes,
      agendaItens,
      pastoOcupacoes
    );
  }, [id, referenceDate, weightFreshnessDays, animals, lotes, pastos, events, pesagens, eccs, movimentacoes, agendaItens, pastoOcupacoes]);

  // Unified Timeline for Pasto
  const timelineItems = useMemo(() => {
    if (!id || !events || !lotes || !animals) return [];
    const loteIdsInPasto = new Set(lotes.map(l => l.id));
    const activeAnimals = animals.filter(a => a.lote_id && loteIdsInPasto.has(a.lote_id) && a.status === "ativo");
    const activeAnimalIds = new Set(activeAnimals.map(a => a.id));
    const animalMap = new Map(activeAnimals.map(a => [a.id, a.identificacao]));

    const pastoEvents = events.filter(e => {
      if (e.deleted_at) return false;
      const isAnimalTarget = e.animal_id && activeAnimalIds.has(e.animal_id);
      
      if (e.dominio === "movimentacao") {
        const m = movimentacoes.find(x => x.evento_id === e.id);
        const touchesPasto = m && (m.from_pasto_id === id || m.to_pasto_id === id);
        return touchesPasto || isAnimalTarget;
      }
      
      return isAnimalTarget;
    });

    return pastoEvents.map(e => {
      let desc = "";
      const detail = e.observacoes || "";
      
      switch (e.dominio) {
        case "pesagem": {
          const p = pesagens.find(x => x.evento_id === e.id);
          desc = p ? `Pesagem registrada: ${p.peso_kg} kg` : "Pesagem registrada";
          break;
        }
        case "ecc": {
          const ecc = eccs.find(x => x.event_id === e.id);
          desc = ecc ? `Escore de Condição Corporal (ECC) avaliado: ${ecc.ecc}` : "ECC avaliado";
          break;
        }
        case "movimentacao": {
          const m = movimentacoes.find(x => x.evento_id === e.id);
          if (m) {
            if (m.to_pasto_id === id) {
              desc = "Entrada no Pasto";
            } else if (m.from_pasto_id === id) {
              desc = "Saída do Pasto";
            } else {
              desc = "Movimentação de pastagem";
            }
          } else {
            desc = "Movimentação registrada";
          }
          break;
        }
        case "sanitario": {
          desc = "Manejo sanitário realizado";
          break;
        }
        case "reproducao": {
          desc = "Manejo reprodutivo realizado";
          break;
        }
        default:
          desc = `${e.dominio.charAt(0).toUpperCase() + e.dominio.slice(1)} registrado`;
      }

      return {
        id: e.id,
        dominio: e.dominio,
        occurred_at: e.occurred_at,
        animalId: e.animal_id,
        animalIdentificacao: e.animal_id ? animalMap.get(e.animal_id) : null,
        descricao: desc,
        detalhe: detail,
      };
    });
  }, [id, events, pesagens, eccs, movimentacoes, lotes, animals]);

  // Historical trajectories for the table
  const pastoAnimalPeriods = useMemo(() => {
    if (!id || !movimentacoes || !events || !animals) return [];
    const pastoMovs = movimentacoes.filter(m => m.to_pasto_id === id || m.from_pasto_id === id);
    return pastoMovs.map(m => {
      const ev = events.find(e => e.id === m.evento_id);
      const anim = animals.find(a => a.id === ev?.animal_id);
      return {
        id: m.id,
        loteId: m.to_lote_id || "",
        pastoId: id,
        animalId: ev?.animal_id || "",
        animalIdentificacao: anim?.identificacao || "",
        entradaAt: ev?.occurred_at || "",
        saidaAt: m.from_pasto_id === id ? ev?.occurred_at : null,
      };
    });
  }, [id, movimentacoes, events, animals]);

  const animaisCount = useMemo(() => {
    if (!lotes || !animals) return 0;
    const loteIds = new Set(lotes.map(l => l.id));
    return animals.filter(a => a.lote_id && loteIds.has(a.lote_id) && a.status === "ativo").length;
  }, [lotes, animals]);

  const ocupacaoAberta = useLiveQuery(
    () =>
      id
        ? db.state_pasto_ocupacoes
            .where("pasto_id")
            .equals(id)
            .filter((o) => !o.saida_em)
            .first()
        : undefined,
    [id],
  );

  const ocupacoesPorLote = useMemo(() => {
    return new Map();
  }, []);

  const avaliacoesPasto = useLiveQuery(async () => {
    if (!id) return [];

    const detalhes = await db.event_eventos_pasto_avaliacao
      .where("pasto_id")
      .equals(id)
      .toArray();
    const ativos = detalhes.filter((avaliacao) => !avaliacao.deleted_at);
    const eventos = await db.event_eventos.bulkGet(
      ativos.map((avaliacao) => avaliacao.evento_id),
    );
    const eventosById = new Map(
      eventos.filter(Boolean).map((evento) => [evento!.id, evento!]),
    );

    return ativos
      .map((avaliacao) => ({
        avaliacao,
        evento: eventosById.get(avaliacao.evento_id) ?? null,
      }))
      .sort((a, b) => {
        const aDate = a.evento?.occurred_at ?? a.avaliacao.created_at;
        const bDate = b.evento?.occurred_at ?? b.avaliacao.created_at;
        return bDate.localeCompare(aDate);
      });
  }, [id]);

  if (!id || !pasto) {
    return (
      <div className="space-y-5">
        <PageIntro
          variant="plain"
          eyebrow="Estrutura do rebanho"
          title="Pasto nao encontrado"
          actions={
            <Button variant="outline" onClick={() => navigate("/pastos")}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          }
        />
      </div>
    );
  }

  const infraestrutura = pasto.infraestrutura;
  const tipoAreaLabel = pasto.tipo_area || pasto.tipo_pasto || "Nao informado";
  const forrageiraLabel =
    pasto.forrageira_cultivar ||
    pasto.forrageira_nome ||
    pasto.forrageira_genero ||
    pasto.tipo_area ||
    pasto.tipo_pasto ||
    "Nao informado";
  const ultimaAvaliacao = avaliacoesPasto?.[0] ?? null;
  const suplementoSelecionado =
    SUPLEMENTO_BY_VALUE.get(suplementoTipo) ?? SUPLEMENTO_OPTIONS[0];
  const suplementoUnidade = suplementoSelecionado.unidade as
    | SuplementoUnidadeEnum
    | "";

  const resetRondaForm = () => {
    setMomento("ronda");
    setAlturaCm("");
    setCoberturaSolo("");
    setInvasorasNivel("");
    setAguaStatus("");
    setEccLoteMedio("");
    setFezesScore("");
    setSuplementoTipo("nenhum");
    setSuplementoQuantidade("");
    setRondaObservacoes("");
  };

  const handleSalvarRonda = async () => {
    const alturaParsed = parseOptionalNumber(alturaCm);
    const eccParsed = parseOptionalNumber(eccLoteMedio);
    const suplementoParsed =
      suplementoTipo === "nenhum"
        ? { value: null, valid: true }
        : parseOptionalNumber(suplementoQuantidade);

    if (!alturaParsed.valid) {
      showError("Altura do capim deve ser um numero valido.");
      return;
    }
    if (alturaParsed.value !== null && alturaParsed.value <= 0) {
      showError("Altura do capim deve ser maior que zero.");
      return;
    }
    if (!eccParsed.valid) {
      showError("ECC medio deve ser um numero valido.");
      return;
    }
    if (
      eccParsed.value !== null &&
      (eccParsed.value < 1 || eccParsed.value > 5)
    ) {
      showError("ECC medio deve estar entre 1 e 5.");
      return;
    }
    if (!suplementoParsed.valid) {
      showError("Quantidade de suplemento deve ser um numero valido.");
      return;
    }
    if (suplementoParsed.value !== null && suplementoParsed.value < 0) {
      showError("Quantidade de suplemento deve ser maior ou igual a zero.");
      return;
    }

    try {
      const { ops } = buildEventGesture({
        dominio: "pastagem",
        fazendaId: pasto.fazenda_id,
        pastoId: pasto.id,
        loteId: ocupacaoAberta?.lote_id || null,
        ocupacaoId: ocupacaoAberta?.id || null,
        momento,
        alturaCm: alturaParsed.value,
        coberturaSolo: coberturaSolo || null,
        invasorasNivel: invasorasNivel || null,
        eccLoteMedio: eccParsed.value,
        aguaStatus: aguaStatus || null,
        fezesScore: fezesScore || null,
        suplementoTipo:
          suplementoTipo === "nenhum" ? null : suplementoSelecionado.label,
        suplementoQuantidade: suplementoParsed.value,
        suplementoUnidade: suplementoUnidade || null,
        observacoes: rondaObservacoes.trim() || null,
        payload: {},
      });

      await createGesture(pasto.fazenda_id, ops);
      showSuccess("Ronda registrada localmente.");
      resetRondaForm();
      setRondaOpen(false);
    } catch (error) {
      console.error(error);
      showError("Nao foi possivel registrar a ronda.");
    }
  };

  return (
    <div className="space-y-5">
      <PageIntro
        variant="plain"
        eyebrow="Estrutura do rebanho"
        title={pasto.nome}
        meta={
          <>
            <StatusBadge tone="neutral">
              {pasto.tipo_pasto ?? "Tipo nao informado"}
            </StatusBadge>
            <StatusBadge tone="neutral">{pasto.area_ha ?? 0} ha</StatusBadge>
            <StatusBadge tone="neutral">
              {pasto.capacidade_ua ?? "Sem capacidade"} UA
            </StatusBadge>
            <StatusBadge tone="neutral">
              {animaisCount ?? 0} animal(is)
            </StatusBadge>
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/pastos")}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <Button asChild>
              <Link to={`/registrar?pastoId=${encodeURIComponent(id)}`}>
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Manejar neste pasto
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setRondaOpen(true)}>
              <ClipboardCheck className="mr-2 h-4 w-4" />
              Registrar ronda
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <MoreHorizontal className="mr-2 h-4 w-4" />
                  Mais ações
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to={`/pastos/${id}/editar`}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar cadastro
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <WithdrawalBadgePanel readModel={carenciaModel} />

      {/* Cockpit Actions / Navigation CTAs */}
      <div className="flex flex-wrap gap-2.5 items-center bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 rounded-xl p-3.5 shadow-sm">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mr-1.5">Ações Rápidas:</span>
        <Button asChild variant="outline" size="sm" className="h-9">
          <Link to={`/registrar?dominio=ecc&pastoId=${encodeURIComponent(id)}`}>
            <Layers className="mr-1.5 h-4 w-4 text-purple-500" />
            Registrar ECC
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="h-9">
          <Link to={`/registrar?dominio=pesagem&pastoId=${encodeURIComponent(id)}`}>
            <Scale className="mr-1.5 h-4 w-4 text-emerald-500" />
            Registrar Pesagem
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="h-9">
          <Link to={`/registrar?dominio=movimentacao&pastoId=${encodeURIComponent(id)}`}>
            <ArrowRightLeft className="mr-1.5 h-4 w-4 text-blue-500" />
            Registrar Movimentação
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => {
            const el = document.getElementById("lotes-secao");
            el?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          <PawPrint className="mr-1.5 h-4 w-4 text-indigo-500" />
          Ver Lotes
        </Button>
        <Button asChild variant="outline" size="sm" className="h-9">
          <Link to={`/agenda?pastoId=${encodeURIComponent(id)}`}>
            <CalendarIcon className="mr-1.5 h-4 w-4 text-amber-500" />
            Ver Agenda
          </Link>
        </Button>
      </div>

      {/* Cockpit Manejo Metrics Grid */}
      {pastoMetrics ? (
        <div className="space-y-4">
          <div className="border-b border-border/50 pb-2">
            <h3 className="text-lg font-bold text-foreground">Cockpit de Manejo</h3>
            <p className="text-sm text-muted-foreground">Indicadores analíticos agregados de ocupação e cobertura do pasto</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Peso Médio Confiável */}
            <CockpitCard
              title="Peso Médio Confiável"
              value={pastoMetrics.pesoMedio}
              unit="kg"
              icon={<Scale className="h-4 w-4" />}
              status={pastoMetrics.pesoStatus.status}
              reason={pastoMetrics.pesoStatus.reason}
              source={pastoMetrics.pesoStatus.source}
              limitation={pastoMetrics.pesoStatus.limitation}
            />

            {/* GMD Médio */}
            <CockpitCard
              title="GMD Médio"
              value={pastoMetrics.gmdMedio}
              unit="kg/dia"
              icon={<TrendingUp className="h-4 w-4" />}
              status={pastoMetrics.gmdStatus.status}
              reason={pastoMetrics.gmdStatus.reason}
              source={pastoMetrics.gmdStatus.source}
              limitation={pastoMetrics.gmdStatus.limitation}
              extraContent={
                pastoMetrics.ganhoMedioPeso !== null && (
                  <p className="mt-1">
                    <span className="font-semibold text-foreground/75">Ganho Acumulado:</span> {pastoMetrics.ganhoMedioPeso.toFixed(1)} kg
                  </p>
                )
              }
            />

            {/* ECC Médio Factual */}
            <CockpitCard
              title="ECC Médio Factual"
              value={pastoMetrics.eccMedio}
              icon={<Layers className="h-4 w-4" />}
              status={pastoMetrics.eccStatus.status}
              reason={pastoMetrics.eccStatus.reason}
              source={pastoMetrics.eccStatus.source}
              limitation={pastoMetrics.eccStatus.limitation}
              extraContent={
                <div className="mt-2 space-y-2">
                  <p>
                    <span className="font-semibold text-foreground/75">Cobertura:</span> {pastoMetrics.eccCobertura.avaliados}/{pastoMetrics.eccCobertura.total} avaliados
                  </p>
                  {pastoMetrics.animaisSemEcc.length > 0 && (
                    <div className="pt-1.5 border-t border-current/10">
                      <button
                        onClick={() => setShowSemEcc(!showSemEcc)}
                        className="flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        {showSemEcc ? (
                          <>
                            <EyeOff className="h-3 w-3" /> Ocultar sem ECC
                          </>
                        ) : (
                          <>
                            <Eye className="h-3 w-3" /> Ver {pastoMetrics.animaisSemEcc.length} sem ECC
                          </>
                        )}
                      </button>
                      {showSemEcc && (
                        <div className="mt-1.5 max-h-24 overflow-y-auto rounded bg-background/50 p-2 border border-current/10 space-y-1 font-mono text-[10px]">
                          {pastoMetrics.animaisSemEcc.map((identificacao) => (
                            <div key={identificacao} className="text-foreground/70">• {identificacao}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              }
            />

            {/* Uso do Pasto */}
            <CockpitCard
              title="Tempo de Uso do Pasto"
              value={pastoMetrics.tempoUsoDias}
              unit="dias"
              icon={<CalendarIcon className="h-4 w-4" />}
              status={pastoMetrics.permanenciaStatus.status}
              reason={`Permanência Média Atual: ${pastoMetrics.tempoUsoDias.toFixed(0)} dias no pasto`}
              source={pastoMetrics.permanenciaStatus.source}
              limitation={pastoMetrics.permanenciaStatus.limitation}
              extraContent={
                pastoMetrics.ultimaMovimentacao && (
                  <p className="mt-1">
                    <span className="font-semibold text-foreground/75">Última Movimentação:</span> {new Date(pastoMetrics.ultimaMovimentacao).toLocaleDateString("pt-BR")}
                  </p>
                )
              }
            />

            {/* Taxa de Lotação UA/ha */}
            <CockpitCard
              title="Taxa de Lotação"
              value={pastoMetrics.taxaLotacaoUaHa}
              unit="UA/ha"
              icon={<Scale className="h-4 w-4 text-emerald-500" />}
              status={pastoMetrics.taxaLotacaoStatus.status}
              reason={pastoMetrics.taxaLotacaoStatus.reason || `${pastoMetrics.taxaLotacaoUaHa?.toFixed(2) ?? 0} UA/ha de taxa de lotação`}
              source={pastoMetrics.taxaLotacaoStatus.source}
              limitation={pastoMetrics.taxaLotacaoStatus.limitation}
              extraContent={
                <div className="mt-2 space-y-1">
                  <p>
                    <span className="font-semibold text-foreground/75">UAs Totais:</span> {pastoMetrics.uaTotal.toFixed(2)} UA
                  </p>
                  <p>
                    <span className="font-semibold text-foreground/75">Área do Pasto:</span> {pasto?.area_ha ? `${pasto.area_ha.toFixed(1)} ha` : "Não informada"}
                  </p>
                </div>
              }
            />

            {/* Pendências de Agenda */}
            <CockpitCard
              title="Pendências da Agenda"
              value={pastoMetrics.agendaItensAbertos.total}
              unit="itens"
              icon={<ClipboardCheck className="h-4 w-4" />}
              status={pastoMetrics.agendaItensAbertos.total > 0 ? "partial" : "complete"}
              reason={`${pastoMetrics.agendaItensAbertos.total} pendências agregadas ativas`}
              source="state_agenda_itens"
              extraContent={
                <div className="grid grid-cols-3 gap-1 mt-2 text-center text-[10px] font-bold">
                  <div className="p-1 rounded bg-rose-500/10 text-rose-700 border border-rose-200/20">
                    <div>{pastoMetrics.agendaItensAbertos.atrasados}</div>
                    <div className="uppercase text-[8px] opacity-75">Atrasados</div>
                  </div>
                  <div className="p-1 rounded bg-amber-500/10 text-amber-700 border border-amber-200/20">
                    <div>{pastoMetrics.agendaItensAbertos.hoje}</div>
                    <div className="uppercase text-[8px] opacity-75">Hoje</div>
                  </div>
                  <div className="p-1 rounded bg-blue-500/10 text-blue-700 border border-blue-200/20">
                    <div>{pastoMetrics.agendaItensAbertos.proximos}</div>
                    <div className="uppercase text-[8px] opacity-75">Próximos</div>
                  </div>
                </div>
              }
            />

            {/* Perfil Zootécnico */}
            <div className="flex flex-col justify-between rounded-xl border p-4 shadow-sm border-slate-200 bg-slate-50/20 dark:border-slate-800/20 dark:bg-slate-900/10">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-background/50 border border-slate-200 dark:border-slate-800">
                    <Clock className="h-4 w-4 text-indigo-500" />
                  </div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Perfil Zootécnico
                  </h4>
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-extrabold tracking-tight text-foreground">
                    {pastoMetrics.categoriaPredominante}
                  </p>
                  <p className="text-xs text-muted-foreground leading-snug">
                    Categoria zootécnica predominante no pasto
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-muted-foreground">
                <p>
                  <span className="font-semibold text-foreground/75">Total de Animais:</span> {pastoMetrics.lotacaoAtual} ativos
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Card className="shadow-none">
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            Calculando métricas do pasto...
          </CardContent>
        </Card>
      )}

      {/* Histórico de Movimentações */}
      {pastoAnimalPeriods.length > 0 && (
        <AnimalMovementHistoryTable
          periods={pastoAnimalPeriods}
          title="Histórico de Movimentação do Pasto"
          description="Trajetória dos animais neste pasto"
        />
      )}

      {/* Timeline Factual do Pasto */}
      <TimelineFactual items={timelineItems} title="Linha do Tempo Factual do Pasto" />

      <section className="rounded-xl border border-border/70 bg-card p-5 shadow-none sm:p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
            Manejo e Forrageira
          </h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
            <p className="mb-3 font-medium text-foreground">Pastagem</p>
            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <span>Tipo de pastagem: {tipoAreaLabel}</span>
              <span>Forrageira / cultivar: {forrageiraLabel}</span>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
            <p className="mb-3 font-medium text-foreground">Metas de Manejo</p>
            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              <span>
                Altura Entrada:{" "}
                {pasto.altura_entrada_alvo_cm
                  ? `${pasto.altura_entrada_alvo_cm} cm`
                  : "Nao informado"}
              </span>
              <span>
                Altura Saida:{" "}
                {pasto.altura_saida_alvo_cm
                  ? `${pasto.altura_saida_alvo_cm} cm`
                  : "Nao informado"}
              </span>
              <span>
                Capacidade Alvo:{" "}
                {pasto.capacidade_ua_alvo !== null &&
                pasto.capacidade_ua_alvo !== undefined
                  ? `${pasto.capacidade_ua_alvo} UA`
                  : "Nao informado"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border/70 bg-card p-5 shadow-none sm:p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-[-0.01em] text-foreground">
            Ultima ronda
          </h2>
        </div>

        {ultimaAvaliacao ? (
          <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusBadge tone="info">
                {labelize(ultimaAvaliacao.avaliacao.momento)}
              </StatusBadge>
              <span className="text-sm text-muted-foreground">
                {formatDateTime(
                  ultimaAvaliacao.evento?.occurred_at ??
                    ultimaAvaliacao.avaliacao.created_at,
                )}
              </span>
            </div>
            <div className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
              <span>
                Altura:{" "}
                {ultimaAvaliacao.avaliacao.altura_cm
                  ? `${ultimaAvaliacao.avaliacao.altura_cm} cm`
                  : "Nao informado"}
              </span>
              <span>
                Cobertura/aspecto:{" "}
                {labelize(ultimaAvaliacao.avaliacao.cobertura_solo)}
              </span>
              <span>
                Agua: {labelize(ultimaAvaliacao.avaliacao.agua_status)}
              </span>
              <span>
                ECC:{" "}
                {ultimaAvaliacao.avaliacao.ecc_lote_medio ?? "Nao informado"}
              </span>
              <span>
                Fezes: {labelize(ultimaAvaliacao.avaliacao.fezes_score)}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhuma ronda registrada para este pasto.
          </p>
        )}
      </section>

      {infraestrutura ? (
        <CollapsibleInfrastructure infraestrutura={infraestrutura} />
      ) : null}

      <section id="lotes-secao" className="scroll-mt-5">
        {lotes && lotes.length > 0 ? (
          <div className="rounded-xl border border-border/70 bg-card p-5 shadow-none sm:p-6">
            <div className="space-y-2 border-b border-border/50 pb-4">
              <h2 className="text-lg font-bold text-foreground">
                Lotes neste pasto
              </h2>
              <p className="text-sm text-muted-foreground">
                {lotes.length} lote(s) ocupando este pasto
              </p>
            </div>

            <div className="grid gap-3 mt-4">
              {lotes.map((lote) => {
                const lotesAnimaisCount = animals.filter(a => a.lote_id === lote.id && a.status === "ativo").length;
                
                return (
                  <Link
                    key={lote.id}
                    to={`/lotes/${lote.id}`}
                    className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/70 px-4 py-3 transition-colors hover:border-primary/25 hover:bg-muted/30"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <p className="font-medium text-foreground">{lote.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {lote.status === "ativo"
                            ? "Em operacao"
                            : "Fora da rotina principal"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {lotesAnimaisCount} animal(is) neste lote
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <StatusBadge
                          tone={lote.status === "ativo" ? "success" : "neutral"}
                        >
                          {lote.status}
                        </StatusBadge>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyState icon={Trees} title="Nenhum lote neste pasto" />
        )}
      </section>

      <Dialog open={rondaOpen} onOpenChange={setRondaOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Registrar ronda</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Momento</Label>
              <Select
                value={momento}
                onValueChange={(value) =>
                  setMomento(value as PastoAvaliacaoMomentoEnum)
                }
              >
                <SelectTrigger aria-label="Momento da ronda">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saida</SelectItem>
                  <SelectItem value="ronda">Ronda</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="altura-cm">Altura do capim (cm)</Label>
              <Input
                id="altura-cm"
                value={alturaCm}
                onChange={(event) => setAlturaCm(event.target.value)}
                inputMode="decimal"
              />
            </div>

            <div className="space-y-2">
              <Label>Taxa de cobertura do solo / Aspecto visual</Label>
              <Select
                value={coberturaSolo || "nao_informado"}
                onValueChange={(value) =>
                  setCoberturaSolo(
                    value === "nao_informado"
                      ? ""
                      : (value as PastoCoberturaSoloEnum),
                  )
                }
              >
                <SelectTrigger aria-label="Taxa de cobertura do solo / Aspecto visual">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao_informado">Nao informado</SelectItem>
                  <SelectItem value="excelente">
                    Excelente (sem solo exposto)
                  </SelectItem>
                  <SelectItem value="media">Media (falhas leves)</SelectItem>
                  <SelectItem value="ruim">
                    Ruim (solo exposto e plantas daninhas)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Invasoras</Label>
              <Select
                value={invasorasNivel || "nao_informado"}
                onValueChange={(value) =>
                  setInvasorasNivel(
                    value === "nao_informado"
                      ? ""
                      : (value as PastoInvasorasNivelEnum),
                  )
                }
              >
                <SelectTrigger aria-label="Nivel de invasoras">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao_informado">Nao informado</SelectItem>
                  <SelectItem value="nenhuma">Nenhuma</SelectItem>
                  <SelectItem value="leve">Leve</SelectItem>
                  <SelectItem value="moderada">Moderada</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Agua</Label>
              <Select
                value={aguaStatus || "nao_informado"}
                onValueChange={(value) =>
                  setAguaStatus(
                    value === "nao_informado"
                      ? ""
                      : (value as PastoAguaStatusEnum),
                  )
                }
              >
                <SelectTrigger aria-label="Status da agua">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao_informado">Nao informado</SelectItem>
                  <SelectItem value="limpo">Limpo</SelectItem>
                  <SelectItem value="sujo">Sujo</SelectItem>
                  <SelectItem value="nivel_baixo">Nivel baixo</SelectItem>
                  <SelectItem value="seco">Seco</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>ECC medio do lote</Label>
              <div
                className="grid grid-cols-3 gap-2 sm:grid-cols-5"
                role="group"
                aria-label="ECC medio do lote"
              >
                {ECC_OPTIONS.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    size="sm"
                    variant={eccLoteMedio === option ? "default" : "outline"}
                    aria-pressed={eccLoteMedio === option}
                    onClick={() => setEccLoteMedio(option)}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Escore de fezes</Label>
              <Select
                value={fezesScore || "nao_informado"}
                onValueChange={(value) =>
                  setFezesScore(
                    value === "nao_informado"
                      ? ""
                      : (value as PastoFezesScoreEnum),
                  )
                }
              >
                <SelectTrigger aria-label="Escore de fezes">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao_informado">Nao informado</SelectItem>
                  <SelectItem value="aneladas">Aneladas</SelectItem>
                  <SelectItem value="ressecadas_empilhadas">
                    Ressecadas empilhadas
                  </SelectItem>
                  <SelectItem value="liquidas">Liquidas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Suplemento tipo</Label>
              <Select
                value={suplementoTipo}
                onValueChange={(value) => {
                  setSuplementoTipo(value as SuplementoTipoValue);
                  setSuplementoQuantidade("");
                }}
              >
                <SelectTrigger aria-label="Suplemento tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPLEMENTO_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="suplemento-quantidade">
                {suplementoUnidade === "kg"
                  ? "Quantidade (Kg)"
                  : suplementoUnidade === "sacos"
                    ? "Quantidade (Sacos)"
                    : "Quantidade"}
              </Label>
              <Input
                id="suplemento-quantidade"
                value={suplementoQuantidade}
                onChange={(event) =>
                  setSuplementoQuantidade(event.target.value)
                }
                inputMode="decimal"
                disabled={suplementoTipo === "nenhum"}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ronda-observacoes">Observacoes</Label>
              <Textarea
                id="ronda-observacoes"
                value={rondaObservacoes}
                onChange={(event) => setRondaObservacoes(event.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRondaOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvarRonda}>Salvar ronda</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PastoDetalhe;
