import { useMemo, useState } from "react";
import { differenceInDays, parseISO } from "date-fns";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRightLeft,
  ClipboardCheck,
  MoreHorizontal,
  PawPrint,
  Repeat,
  UserPlus,
  Pencil,
  Search,
  X,
  Scale,
  TrendingUp,
  Layers,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Clock,
} from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { AdicionarAnimaisLote } from "@/components/manejo/AdicionarAnimaisLote";
import { MudarPastoLote } from "@/components/manejo/MudarPastoLote";
import { TrocarTouroLote } from "@/components/manejo/TrocarTouroLote";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageIntro } from "@/components/ui/page-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import { db } from "@/lib/offline/db";
import {
  buildRegulatoryOperationalReadModel,
  loadRegulatorySurfaceSource,
} from "@/lib/sanitario/compliance/regulatoryReadModel";
import { AnimalMovementHistoryTable } from "@/features/occupancy/AnimalMovementHistoryTable";
import { OccupancyEntryInfo } from "@/features/occupancy";
import { Input } from "@/components/ui/input";

import { calculateLoteMetrics } from "@/features/occupancy/cockpitManejoAdapter";
import { TimelineFactual } from "@/components/timeline/TimelineFactual";
import { useAuth } from "@/hooks/useAuth";

const EMPTY_ARRAY: never[] = [];

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

export default function LoteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [showAdicionarAnimais, setShowAdicionarAnimais] = useState(false);
  const [showMudarPasto, setShowMudarPasto] = useState(false);
  const [showTrocarTouro, setShowTrocarTouro] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSemEcc, setShowSemEcc] = useState(false);

  const { farmLifecycleConfig } = useAuth();
  const weightFreshnessDays = farmLifecycleConfig?.weightFreshnessDays;

  // Dexie Reactive Queries
  const lote = useLiveQuery(
    () => (id ? db.state_lotes.get(id) : undefined),
    [id],
  );
  const pasto = useLiveQuery(
    () => (lote?.pasto_id ? db.state_pastos.get(lote.pasto_id) : undefined),
    [lote?.pasto_id],
  );
  const touro = useLiveQuery(
    () => (lote?.touro_id ? db.state_animais.get(lote.touro_id) : undefined),
    [lote?.touro_id],
  );
  const animais = useLiveQuery(
    () => (id ? db.state_animais.where("lote_id").equals(id).toArray() : []),
    [id],
  );
  const regulatorySurfaceSource = useLiveQuery(
    () => (lote ? loadRegulatorySurfaceSource(lote.fazenda_id) : null),
    [lote?.fazenda_id],
  );

  const events = useLiveQuery(() => db.event_eventos.toArray()) ?? EMPTY_ARRAY;
  const pesagens = useLiveQuery(() => db.event_eventos_pesagem.toArray()) ?? EMPTY_ARRAY;
  const eccs = useLiveQuery(() => db.event_eventos_ecc.toArray()) ?? EMPTY_ARRAY;
  const movimentacoes = useLiveQuery(() => db.event_eventos_movimentacao.toArray()) ?? EMPTY_ARRAY;
  const agendaItens = useLiveQuery(() => db.state_agenda_itens.toArray()) ?? EMPTY_ARRAY;

  const referenceDate = useMemo(() => new Date().toISOString(), []);

  // Regulatory Read Model
  const regulatoryReadModel = useMemo(
    () =>
      buildRegulatoryOperationalReadModel(regulatorySurfaceSource ?? undefined),
    [regulatorySurfaceSource],
  );

  // Computação das Métricas do Cockpit
  const loteMetrics = useMemo(() => {
    if (!id || !animais) return null;
    return calculateLoteMetrics(
      id,
      referenceDate,
      weightFreshnessDays,
      animais,
      events,
      pesagens,
      eccs,
      movimentacoes,
      agendaItens
    );
  }, [id, referenceDate, weightFreshnessDays, animais, events, pesagens, eccs, movimentacoes, agendaItens]);

  // Unified Timeline selector
  const timelineItems = useMemo(() => {
    if (!id || !events || !animais) return [];
    const activeAnimalIds = new Set(animais.filter(a => a.status === "ativo").map(a => a.id));
    const animalMap = new Map(animais.map(a => [a.id, a.identificacao]));

    const loteEvents = events.filter(e => {
      if (e.deleted_at) return false;
      const isLoteTarget = e.lote_id === id;
      const isAnimalTarget = e.animal_id && activeAnimalIds.has(e.animal_id);
      return isLoteTarget || isAnimalTarget;
    });

    return loteEvents.map(e => {
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
          desc = "Movimentação registrada";
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
  }, [id, events, pesagens, eccs, animais]);

  // Tempo de permanência histórico para a tabela antiga
  const loteAnimalPeriods = useMemo(() => {
    if (!id || !movimentacoes || !events) return [];
    // We map movements to compute active periods for the table
    // A simplified layout that filters movements related to this lote
    const loteMovs = movimentacoes.filter(m => m.to_lote_id === id || m.from_lote_id === id);
    return loteMovs.map(m => {
      const ev = events.find(e => e.id === m.evento_id);
      const anim = animais.find(a => a.id === ev?.animal_id);
      return {
        id: m.id,
        loteId: id,
        pastoId: m.to_pasto_id || "",
        animalId: ev?.animal_id || "",
        animalIdentificacao: anim?.identificacao || "",
        entradaAt: ev?.occurred_at || "",
        saidaAt: m.from_lote_id === id ? ev?.occurred_at : null,
      };
    });
  }, [id, movimentacoes, events, animais]);

  const animalEntradaMap = useMemo(() => {
    const map = new Map<string, string>();
    loteAnimalPeriods.forEach((period) => {
      if (period.saidaAt === null) {
        map.set(period.animalId, period.entradaAt);
      }
    });
    return map;
  }, [loteAnimalPeriods]);

  const getDiasNoLote = (dataEntrada: string): number => {
    return differenceInDays(new Date(), parseISO(dataEntrada));
  };

  const animaisFiltrados = useMemo(() => {
    if (!animais) return [];
    if (!searchTerm.trim()) return animais;
    
    const termo = searchTerm.toLowerCase().trim();
    return animais.filter((animal) =>
      animal.identificacao?.toLowerCase().includes(termo)
    );
  }, [animais, searchTerm]);

  if (!id || !lote) {
    return (
      <div className="space-y-5">
        <PageIntro
          variant="plain"
          eyebrow="Estrutura"
          title="Lote não encontrado"
          actions={
            <Button variant="outline" onClick={() => navigate("/lotes")}>
              Voltar para lotes
            </Button>
          }
        />
      </div>
    );
  }

  const animaisCount = animais?.length ?? 0;
  const movementCompliance = regulatoryReadModel.flows.movementInternal;
  const movementBlocked = movementCompliance.blockerCount > 0;
  const movementWarning = movementCompliance.warningCount > 0;
  const movementMessage =
    movementCompliance.firstBlockerMessage ??
    movementCompliance.firstWarningMessage;

  return (
    <div className="space-y-5">
      <PageIntro
        variant="plain"
        eyebrow="Estrutura"
        title={lote.nome}
        meta={
          <>
            <StatusBadge tone="neutral">
              {lote.status ?? "Sem status"}
            </StatusBadge>
            <StatusBadge tone="info">{animaisCount} animal(is)</StatusBadge>
            {pasto ? (
              <StatusBadge tone="neutral">Pasto {pasto.nome}</StatusBadge>
            ) : null}
            {movementBlocked ? (
              <StatusBadge tone="danger">Movimentação restrita</StatusBadge>
            ) : movementWarning ? (
              <StatusBadge tone="warning">Movimentação sob revisão</StatusBadge>
            ) : null}
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/lotes")}>
              Voltar
            </Button>
            <Button asChild>
              <Link to={`/registrar?loteId=${encodeURIComponent(id)}`}>
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Manejar este lote
              </Link>
            </Button>
            <Button
              onClick={() => setShowAdicionarAnimais(true)}
              disabled={movementBlocked}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Adicionar animais
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <MoreHorizontal className="mr-2 h-4 w-4" />
                  Mais ações
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowMudarPasto(true)}>
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  Mudar pasto
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowTrocarTouro(true)}>
                  <Repeat className="mr-2 h-4 w-4" />
                  Trocar reprodutor
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to={`/lotes/${id}/editar`}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar cadastro
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {movementMessage ? (
        <Card
          className={
            movementBlocked
              ? "border-amber-200 bg-amber-50/60"
              : "border-warning/30 bg-warning-muted/70"
          }
        >
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <p className="font-medium text-foreground">
                  Conformidade impacta este lote
                </p>
              </div>
              <p className="text-sm text-muted-foreground">{movementMessage}</p>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate("/protocolos-sanitarios")}
            >
              Abrir conformidade
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Cockpit Actions / Navigation CTAs */}
      <div className="flex flex-wrap gap-2.5 items-center bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 rounded-xl p-3.5 shadow-sm">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mr-1.5">Ações Rápidas:</span>
        <Button asChild variant="outline" size="sm" className="h-9">
          <Link to={`/registrar?dominio=ecc&loteId=${encodeURIComponent(id)}`}>
            <Layers className="mr-1.5 h-4 w-4 text-purple-500" />
            Registrar ECC
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="h-9">
          <Link to={`/registrar?dominio=pesagem&loteId=${encodeURIComponent(id)}`}>
            <Scale className="mr-1.5 h-4 w-4 text-emerald-500" />
            Registrar Pesagem
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="h-9">
          <Link to={`/registrar?dominio=movimentacao&loteId=${encodeURIComponent(id)}`}>
            <ArrowRightLeft className="mr-1.5 h-4 w-4 text-blue-500" />
            Registrar Movimentação
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={() => {
            const el = document.getElementById("animais-secao");
            el?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          <PawPrint className="mr-1.5 h-4 w-4 text-indigo-500" />
          Ver Animais
        </Button>
        <Button asChild variant="outline" size="sm" className="h-9">
          <Link to={`/agenda?loteId=${encodeURIComponent(id)}`}>
            <CalendarIcon className="mr-1.5 h-4 w-4 text-amber-500" />
            Ver Agenda
          </Link>
        </Button>
      </div>

      {/* Cockpit Manejo Metrics Grid */}
      {loteMetrics ? (
        <div className="space-y-4">
          <div className="border-b border-border/50 pb-2">
            <h3 className="text-lg font-bold text-foreground">Cockpit de Manejo</h3>
            <p className="text-sm text-muted-foreground">Indicadores analíticos factuais e de cobertura de dados</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Peso Médio Confiável */}
            <CockpitCard
              title="Peso Médio Confiável"
              value={loteMetrics.pesoMedio}
              unit="kg"
              icon={<Scale className="h-4 w-4" />}
              status={loteMetrics.pesoStatus.status}
              reason={loteMetrics.pesoStatus.reason}
              source={loteMetrics.pesoStatus.source}
              limitation={loteMetrics.pesoStatus.limitation}
            />

            {/* GMD Médio */}
            <CockpitCard
              title="GMD Médio"
              value={loteMetrics.gmdMedio}
              unit="kg/dia"
              icon={<TrendingUp className="h-4 w-4" />}
              status={loteMetrics.gmdStatus.status}
              reason={loteMetrics.gmdStatus.reason}
              source={loteMetrics.gmdStatus.source}
              limitation={loteMetrics.gmdStatus.limitation}
            />

            {/* ECC Médio Factual */}
            <CockpitCard
              title="ECC Médio Factual"
              value={loteMetrics.eccMedio}
              icon={<Layers className="h-4 w-4" />}
              status={loteMetrics.eccStatus.status}
              reason={loteMetrics.eccStatus.reason}
              source={loteMetrics.eccStatus.source}
              limitation={loteMetrics.eccStatus.limitation}
              extraContent={
                <div className="mt-2 space-y-2">
                  <p>
                    <span className="font-semibold text-foreground/75">Cobertura:</span> {loteMetrics.eccCobertura.avaliados}/{loteMetrics.eccCobertura.total} avaliados
                  </p>
                  {loteMetrics.animaisSemEcc.length > 0 && (
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
                            <Eye className="h-3 w-3" /> Ver {loteMetrics.animaisSemEcc.length} sem ECC
                          </>
                        )}
                      </button>
                      {showSemEcc && (
                        <div className="mt-1.5 max-h-24 overflow-y-auto rounded bg-background/50 p-2 border border-current/10 space-y-1 font-mono text-[10px]">
                          {loteMetrics.animaisSemEcc.map((identificacao) => (
                            <div key={identificacao} className="text-foreground/70">• {identificacao}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              }
            />

            {/* Lotação / Permanência */}
            <CockpitCard
              title="Lotação & Permanência"
              value={loteMetrics.tempoMedioPermanencia}
              unit="dias"
              icon={<CalendarIcon className="h-4 w-4" />}
              status={loteMetrics.tempoLotacaoStatus.status}
              reason={`Permanência Média: ${loteMetrics.tempoMedioPermanencia.toFixed(0)} dias (Máx: ${loteMetrics.tempoMaximoPermanencia} dias)`}
              source={loteMetrics.tempoLotacaoStatus.source}
              limitation={loteMetrics.tempoLotacaoStatus.limitation}
              extraContent={
                loteMetrics.ultimaMovimentacao && (
                  <p className="mt-1">
                    <span className="font-semibold text-foreground/75">Última Movimentação:</span> {new Date(loteMetrics.ultimaMovimentacao).toLocaleDateString("pt-BR")}
                  </p>
                )
              }
            />

            {/* Pendências de Agenda */}
            <CockpitCard
              title="Pendências da Agenda"
              value={loteMetrics.agendaItensAbertos.total}
              unit="itens"
              icon={<ClipboardCheck className="h-4 w-4" />}
              status={loteMetrics.agendaItensAbertos.total > 0 ? "partial" : "complete"}
              reason={`${loteMetrics.agendaItensAbertos.total} pendências ativas vinculadas`}
              source="state_agenda_itens"
              extraContent={
                <div className="grid grid-cols-3 gap-1 mt-2 text-center text-[10px] font-bold">
                  <div className="p-1 rounded bg-rose-500/10 text-rose-700 border border-rose-200/20">
                    <div>{loteMetrics.agendaItensAbertos.atrasados}</div>
                    <div className="uppercase text-[8px] opacity-75">Atrasados</div>
                  </div>
                  <div className="p-1 rounded bg-amber-500/10 text-amber-700 border border-amber-200/20">
                    <div>{loteMetrics.agendaItensAbertos.hoje}</div>
                    <div className="uppercase text-[8px] opacity-75">Hoje</div>
                  </div>
                  <div className="p-1 rounded bg-blue-500/10 text-blue-700 border border-blue-200/20">
                    <div>{loteMetrics.agendaItensAbertos.proximos}</div>
                    <div className="uppercase text-[8px] opacity-75">Próximos</div>
                  </div>
                </div>
              }
            />

            {/* Categoria Predominante */}
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
                    {loteMetrics.categoriaPredominante}
                  </p>
                  <p className="text-xs text-muted-foreground leading-snug">
                    Categoria zootécnica predominante no lote
                  </p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-muted-foreground">
                <p>
                  <span className="font-semibold text-foreground/75">Total de Animais:</span> {loteMetrics.quantidadeAtual} ativos
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Card className="shadow-none">
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            Calculando métricas do cockpit de manejo...
          </CardContent>
        </Card>
      )}

      {/* Histórico de Movimentações */}
      {loteAnimalPeriods.length > 0 && (
        <AnimalMovementHistoryTable
          periods={loteAnimalPeriods}
          title="Histórico de Movimentação do Lote"
          description="Trajetória dos animais neste lote entre pastos"
        />
      )}

      {/* Timeline Factual Unificada */}
      <TimelineFactual items={timelineItems} title="Linha do Tempo Factual do Lote" />

      {/* Animais do Lote */}
      <section id="animais-secao" className="scroll-mt-5">
        {animaisCount === 0 ? (
          <EmptyState
            icon={PawPrint}
            title="Lote sem animais"
            action={{
              label: "Adicionar animais",
              onClick: () => setShowAdicionarAnimais(true),
            }}
          />
        ) : (
          <Card className="shadow-none">
            <CardContent className="space-y-4 p-4">
              <div className="space-y-3 border-b border-border/50 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    Animais do lote
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {animaisFiltrados.length} de {animaisCount} registro(s).
                  </p>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por identificação..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-10"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              {animaisFiltrados.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    {searchTerm ? "Nenhum animal encontrado com esse termo de busca." : "Nenhum animal neste lote."}
                  </p>
                </div>
              ) : (
                animaisFiltrados.map((animal) => {
                  const dataEntrada = animalEntradaMap.get(animal.id);
                  const diasNoLote = dataEntrada ? getDiasNoLote(dataEntrada) : null;
                  const isRecente = diasNoLote !== null && diasNoLote <= 7;

                  return (
                    <Link
                      key={animal.id}
                      to={`/animais/${animal.id}`}
                      className="flex flex-col gap-3 rounded-xl border border-border/70 bg-background/80 p-4 transition-colors hover:border-primary/25 hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">
                            {animal.identificacao}
                          </p>
                          {isRecente && (
                            <StatusBadge tone="success" className="text-xs">Novo</StatusBadge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge tone="neutral">
                            {animal.sexo === "M" ? "Macho" : "Femea"}
                          </StatusBadge>
                          <StatusBadge tone="neutral">{animal.status}</StatusBadge>
                        </div>
                        {dataEntrada && (
                          <OccupancyEntryInfo
                            dataEntrada={dataEntrada}
                            label="Entrada"
                            showDays={true}
                            showBadge={false}
                          />
                        )}
                      </div>
                      <StatusBadge tone="info">Abrir animal</StatusBadge>
                    </Link>
                  );
                })
              )}
            </CardContent>
          </Card>
        )}
      </section>

      <AdicionarAnimaisLote
        lote={lote}
        open={showAdicionarAnimais}
        onOpenChange={setShowAdicionarAnimais}
        onSuccess={() => undefined}
      />
      <MudarPastoLote
        lote={lote}
        open={showMudarPasto}
        onOpenChange={setShowMudarPasto}
        onSuccess={() => undefined}
      />
      <TrocarTouroLote
        lote={lote}
        open={showTrocarTouro}
        onOpenChange={setShowTrocarTouro}
        onSuccess={() => undefined}
      />
    </div>
  );
}
