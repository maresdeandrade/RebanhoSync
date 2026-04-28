import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRightLeft,
  Beef,
  MapPin,
  MoreHorizontal,
  PawPrint,
  Repeat,
  UserPlus,
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
import { MetricCard } from "@/components/ui/metric-card";
import { PageIntro } from "@/components/ui/page-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import { db } from "@/lib/offline/db";
import {
  buildRegulatoryOperationalReadModel,
  loadRegulatorySurfaceSource,
} from "@/lib/sanitario/compliance/regulatoryReadModel";

export default function LoteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [showAdicionarAnimais, setShowAdicionarAnimais] = useState(false);
  const [showMudarPasto, setShowMudarPasto] = useState(false);
  const [showTrocarTouro, setShowTrocarTouro] = useState(false);

  const lote = useLiveQuery(() => (id ? db.state_lotes.get(id) : undefined), [id]);
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
  const regulatoryReadModel = useMemo(
    () =>
      buildRegulatoryOperationalReadModel(
        regulatorySurfaceSource ?? undefined,
      ),
    [regulatorySurfaceSource],
  );

  if (!id || !lote) {
    return (
      <div className="space-y-6">
        <PageIntro
          eyebrow="Estrutura"
          title="Lote nao encontrado"
          description="Verifique se o lote ainda existe na fazenda ativa ou volte para a listagem."
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
    <div className="space-y-6">
      <PageIntro
        eyebrow="Estrutura"
        title={lote.nome}
        description="Resumo do lote com localizacao, reprodutor e leitura rapida do rebanho alocado."
        meta={
          <>
            <StatusBadge tone="neutral">{lote.status ?? "Sem status"}</StatusBadge>
            <StatusBadge tone="info">{animaisCount} animal(is)</StatusBadge>
            {pasto ? <StatusBadge tone="neutral">Pasto {pasto.nome}</StatusBadge> : null}
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <MoreHorizontal className="mr-2 h-4 w-4" />
                  Acoes do lote
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to={`/lotes/${id}/editar`}>Editar cadastro</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowMudarPasto(true)}>
                  <ArrowRightLeft className="mr-2 h-4 w-4" />
                  Mudar pasto
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowTrocarTouro(true)}>
                  <Repeat className="mr-2 h-4 w-4" />
                  Trocar reprodutor
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              onClick={() => setShowAdicionarAnimais(true)}
              disabled={movementBlocked}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Adicionar animais
            </Button>
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
                  Overlay regulatorio impacta este lote
                </p>
              </div>
              <p className="text-sm text-muted-foreground">{movementMessage}</p>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate("/protocolos-sanitarios")}
            >
              Abrir overlay de conformidade
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Pasto"
          value={pasto?.nome ?? "Sem pasto"}
          hint={
            pasto?.area_ha
              ? `${pasto.area_ha} ha cadastrados nesta area.`
              : "Sem area vinculada ao lote."
          }
          icon={<MapPin className="h-5 w-5" />}
        />
        <MetricCard
          label="Reprodutor"
          value={touro?.identificacao ?? "Nao definido"}
          hint={
            touro?.nome
              ? `Nome de manejo: ${touro.nome}.`
              : "Sem touro responsavel pelo lote."
          }
          tone={touro ? "info" : "default"}
          icon={<Beef className="h-5 w-5" />}
        />
        <MetricCard
          label="Animais"
          value={animaisCount}
          hint="Total atual de animais alocados neste lote."
          icon={<PawPrint className="h-5 w-5" />}
        />
      </div>

      {animaisCount === 0 ? (
        <EmptyState
          icon={PawPrint}
          title="Lote sem animais"
          description="Use a acao principal para trazer animais para este lote e conectar a estrutura com a rotina."
          action={{
            label: "Adicionar animais",
            onClick: () => setShowAdicionarAnimais(true),
          }}
        />
      ) : (
        <Card className="shadow-none">
          <CardContent className="space-y-3 p-4">
            {animais?.map((animal) => (
              <Link
                key={animal.id}
                to={`/animais/${animal.id}`}
                className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/80 p-4 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{animal.identificacao}</p>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge tone="neutral">
                      {animal.sexo === "M" ? "Macho" : "Femea"}
                    </StatusBadge>
                    <StatusBadge tone="neutral">{animal.status}</StatusBadge>
                  </div>
                </div>
                <StatusBadge tone="info">Abrir animal</StatusBadge>
              </Link>
            ))}
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
