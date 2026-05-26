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
  X
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
import { useOccupancyData } from "@/features/occupancy/useOccupancyData";
import { OccupancyMetricCards } from "@/features/occupancy/OccupancyMetricCards";
import { AnimalMovementHistoryTable } from "@/features/occupancy/AnimalMovementHistoryTable";
import { OccupancyEntryInfo } from "@/features/occupancy";
import { Input } from "@/components/ui/input";

export default function LoteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [showAdicionarAnimais, setShowAdicionarAnimais] = useState(false);
  const [showMudarPasto, setShowMudarPasto] = useState(false);
  const [showTrocarTouro, setShowTrocarTouro] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

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
  const ocupacaoAberta = useLiveQuery(
    () =>
      id && lote
        ? db.state_pasto_ocupacoes
            .where("[fazenda_id+lote_id]")
            .equals([lote.fazenda_id, id])
            .filter((o) => o.status === "aberta" && !o.deleted_at)
            .first()
        : undefined,
    [id, lote?.fazenda_id],
  );
  const regulatorySurfaceSource = useLiveQuery(
    () => (lote ? loadRegulatorySurfaceSource(lote.fazenda_id) : null),
    [lote?.fazenda_id],
  );
  const regulatoryReadModel = useMemo(
    () =>
      buildRegulatoryOperationalReadModel(regulatorySurfaceSource ?? undefined),
    [regulatorySurfaceSource],
  );

  const { getLoteMetrics, allAnimalPeriods } = useOccupancyData(
    lote?.fazenda_id ?? "",
    new Date().toISOString(),
  );

  const loteMetrics = useMemo(
    () => (id ? getLoteMetrics(id) : null),
    [id, getLoteMetrics],
  );

  const loteAnimalPeriods = useMemo(
    () => allAnimalPeriods.filter((p) => p.loteId === id),
    [allAnimalPeriods, id],
  );

  // Mapa de data de entrada por animal para fácil acesso
  const animalEntradaMap = useMemo(() => {
    const map = new Map<string, string>();
    loteAnimalPeriods.forEach((period) => {
      if (period.saidaAt === null) { // Apenas animais ativos
        map.set(period.animalId, period.entradaAt);
      }
    });
    return map;
  }, [loteAnimalPeriods]);

  const formatDate = (dateString: string): string => {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
    }).format(new Date(dateString));
  };

  const getDiasNoLote = (dataEntrada: string): number => {
    return differenceInDays(new Date(), parseISO(dataEntrada));
  };

  // Filtrar animais baseado no termo de busca
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
          title="Lote nao encontrado"
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
              <StatusBadge tone="danger">Movimentacao restrita</StatusBadge>
            ) : movementWarning ? (
              <StatusBadge tone="warning">Movimentacao sob revisao</StatusBadge>
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

      <OccupancyMetricCards metrics={loteMetrics} type="lote" />

      <AnimalMovementHistoryTable
        periods={loteAnimalPeriods}
        title="Histórico de Movimentação do Lote"
        description="Trajetória dos animais neste lote entre pastos"
      />

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
