import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  buildAnimalLifecyclePayload,
  getAnimalLifeStageLabel,
  type PendingAnimalLifecycleKind,
  getPendingAnimalLifecycleKindLabel,
  getPendingAnimalLifecycleTransitions,
} from "@/lib/animals/lifecycle";
import {
  buildAnimalClassificationPayload,
  getAnimalProductiveDestination,
  getAnimalTransitionMode,
  getLegacyMaleFields,
  getMaleReproductiveStatus,
  isMaleBreedingDestination,
} from "@/lib/animals/maleProfile";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import { listAnimalsBlockedBySanitaryAlert } from "@/lib/sanitario/alerts";
import {
  buildRegulatoryOperationalReadModel,
  loadRegulatorySurfaceSource,
} from "@/lib/sanitario/regulatoryReadModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { showError, showSuccess } from "@/utils/toast";
import type {
  DestinoProdutivoAnimalEnum,
  ModoTransicaoEstagioEnum,
  OperationInput,
  StatusReprodutivoMachoEnum,
} from "@/lib/offline/types";

type ModeFilter = "all" | "manual" | "auto";
type KindFilter = "all" | PendingAnimalLifecycleKind;
type BatchDestinoValue = DestinoProdutivoAnimalEnum | "__unchanged__";
type BatchStatusValue = StatusReprodutivoMachoEnum | "__unchanged__";
type BatchTransitionModeValue = ModoTransicaoEstagioEnum | "__unchanged__";

const UNCHANGED = "__unchanged__";

export default function AnimaisTransicoes() {
  const { activeFarmId, farmLifecycleConfig } = useAuth();
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchDestino, setBatchDestino] = useState<BatchDestinoValue>(UNCHANGED);
  const [batchStatusReprodutivo, setBatchStatusReprodutivo] =
    useState<BatchStatusValue>(UNCHANGED);
  const [batchTransitionMode, setBatchTransitionMode] =
    useState<BatchTransitionModeValue>(UNCHANGED);
  const [batchLoteId, setBatchLoteId] = useState<string>(UNCHANGED);

  const animais = useLiveQuery(async () => {
    if (!activeFarmId) return [];
    return db.state_animais.where("fazenda_id").equals(activeFarmId).toArray();
  }, [activeFarmId]);

  const lotes = useLiveQuery(async () => {
    if (!activeFarmId) return [];
    return db.state_lotes.where("fazenda_id").equals(activeFarmId).toArray();
  }, [activeFarmId]);
  const regulatorySurfaceSource = useLiveQuery(
    async () => {
      if (!activeFarmId) return null;
      return loadRegulatorySurfaceSource(activeFarmId);
    },
    [activeFarmId],
  );

  const rows = useMemo(() => {
    const lotesMap = new Map((lotes ?? []).map((lote) => [lote.id, lote.nome]));
    const pending = getPendingAnimalLifecycleTransitions(
      animais ?? [],
      farmLifecycleConfig,
    );
    const searchLower = search.trim().toLowerCase();

    return pending
      .map((item) => {
        const animal = (animais ?? []).find((entry) => entry.id === item.animalId);
        if (!animal) return null;

        return {
          animal,
          loteNome: animal.lote_id ? lotesMap.get(animal.lote_id) ?? "..." : "Sem lote",
          ...item,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .filter((item) => {
        if (modeFilter === "manual" && item.canAutoApply) return false;
        if (modeFilter === "auto" && !item.canAutoApply) return false;
        if (kindFilter !== "all" && item.queueKind !== kindFilter) return false;
        if (!searchLower) return true;

        return [
          item.identificacao,
          item.loteNome,
          item.reason,
          getPendingAnimalLifecycleKindLabel(item.queueKind),
          getAnimalLifeStageLabel(item.currentStage),
          getAnimalLifeStageLabel(item.targetStage),
        ]
          .join(" ")
          .toLowerCase()
          .includes(searchLower);
      });
  }, [animais, farmLifecycleConfig, kindFilter, lotes, modeFilter, search]);

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.includes(row.animalId)),
    [rows, selectedIds],
  );
  const selectedRowsBlockedBySanitaryAlert = useMemo(
    () => listAnimalsBlockedBySanitaryAlert(selectedRows.map((row) => row.animal)),
    [selectedRows],
  );
  const regulatoryReadModel = useMemo(
    () =>
      buildRegulatoryOperationalReadModel(
        regulatorySurfaceSource ?? undefined,
      ),
    [regulatorySurfaceSource],
  );
  const movementComplianceGuards = regulatoryReadModel.flows.movementInternal;
  const complianceBlockReason =
    batchLoteId !== UNCHANGED
      ? movementComplianceGuards.blockers[0]?.message ?? null
      : null;
  const selectedMaleRows = selectedRows.filter((row) => row.animal.sexo === "M");
  const selectedPostWeaningRows = selectedRows.filter(
    (row) =>
      row.targetStage !== "cria_neonatal" && row.targetStage !== "cria_aleitamento",
  );
  const visibleIds = rows.map((row) => row.animalId);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  const manualCount = rows.filter((row) => !row.canAutoApply).length;
  const autoCount = rows.filter((row) => row.canAutoApply).length;
  const strategicCount = rows.filter(
    (row) => row.queueKind === "decisao_estrategica",
  ).length;
  const biologicalCount = rows.length - strategicCount;

  const toggleAllVisible = (checked: boolean) => {
    if (!checked) {
      setSelectedIds((current) => current.filter((id) => !visibleIds.includes(id)));
      return;
    }

    setSelectedIds((current) => Array.from(new Set([...current, ...visibleIds])));
  };

  const toggleOne = (animalId: string, checked: boolean) => {
    setSelectedIds((current) =>
      checked ? Array.from(new Set([...current, animalId])) : current.filter((id) => id !== animalId),
    );
  };

  const applyMalePreset = (
    destino: DestinoProdutivoAnimalEnum,
    status: StatusReprodutivoMachoEnum,
  ) => {
    setBatchDestino(destino);
    setBatchStatusReprodutivo(status);
  };

  const handleBatchDestinoChange = (value: BatchDestinoValue) => {
    setBatchDestino(value);

    if (value === UNCHANGED) return;

    if (isMaleBreedingDestination(value)) {
      setBatchStatusReprodutivo((current) =>
        current === UNCHANGED || current === "inativo" ? "candidato" : current,
      );
      return;
    }

    setBatchStatusReprodutivo("inativo");
  };

  const handleApplySelected = async () => {
    if (!activeFarmId || selectedRows.length === 0) {
      showError("Selecione pelo menos um animal para aplicar a transicao.");
      return;
    }

    if (
      batchLoteId !== UNCHANGED &&
      selectedRowsBlockedBySanitaryAlert.length > 0
    ) {
      showError(
        `${selectedRowsBlockedBySanitaryAlert[0]?.animal.identificacao} esta com suspeita sanitaria aberta e nao pode ser movido de lote.`,
      );
      return;
    }

    if (complianceBlockReason) {
      showError(complianceBlockReason);
      return;
    }

    setIsSubmitting(true);
    const occurredAt = new Date().toISOString();

    try {
      const ops: OperationInput[] = [];

      for (const row of selectedRows) {
        const canAssignDestinationLote =
          row.targetStage !== "cria_neonatal" &&
          row.targetStage !== "cria_aleitamento";
        const currentDestino = getAnimalProductiveDestination(row.animal);
        const currentStatusReprodutivo = getMaleReproductiveStatus(row.animal);
        const currentTransitionMode = getAnimalTransitionMode(row.animal);
        const nextDestino =
          row.animal.sexo === "M" && batchDestino !== UNCHANGED
            ? batchDestino
            : currentDestino;
        const nextStatusReprodutivo =
          row.animal.sexo === "M"
            ? batchStatusReprodutivo !== UNCHANGED
              ? batchStatusReprodutivo
              : batchDestino !== UNCHANGED
                ? isMaleBreedingDestination(batchDestino)
                  ? currentStatusReprodutivo ?? "candidato"
                  : "inativo"
                : currentStatusReprodutivo
            : null;
        const nextTransitionMode =
          batchTransitionMode !== UNCHANGED
            ? batchTransitionMode
            : currentTransitionMode;

        let payload = buildAnimalClassificationPayload(row.animal.payload, {
          sexo: row.animal.sexo,
          destinoProdutivo: nextDestino,
          statusReprodutivoMacho: nextStatusReprodutivo,
          modoTransicao: nextTransitionMode,
        });

        payload = buildAnimalLifecyclePayload(
          payload,
          row.targetStage,
          "manual",
          occurredAt,
        );

        const destinationLoteId =
          batchLoteId !== UNCHANGED && canAssignDestinationLote
            ? batchLoteId
            : row.animal.lote_id ?? null;
        const loteChanged =
          batchLoteId !== UNCHANGED &&
          canAssignDestinationLote &&
          destinationLoteId !== row.animal.lote_id;

        if (loteChanged) {
          const built = buildEventGesture({
            dominio: "movimentacao",
            fazendaId: activeFarmId,
            occurredAt,
            animalId: row.animalId,
            loteId: row.animal.lote_id ?? null,
            fromLoteId: row.animal.lote_id ?? null,
            toLoteId: destinationLoteId,
            applyAnimalStateUpdate: false,
            observacoes: "Movimentacao de lote via mutacao em lote de estagios",
            payload: {
              kind: "batch_lifecycle_transition",
              target_stage: row.targetStage,
            },
          });
          ops.push(...built.ops);
        }

        const nextWeaning =
          destinationLoteId &&
          canAssignDestinationLote
            ? {
                ...(row.animal.payload &&
                typeof row.animal.payload === "object" &&
                !Array.isArray(row.animal.payload) &&
                row.animal.payload.weaning &&
                typeof row.animal.payload.weaning === "object" &&
                !Array.isArray(row.animal.payload.weaning)
                  ? (row.animal.payload.weaning as Record<string, unknown>)
                  : {}),
                destination_lote_id: destinationLoteId,
              }
            : null;

        if (nextWeaning) {
          payload = {
            ...payload,
            weaning: nextWeaning,
          };
        }

        const { papel_macho, habilitado_monta } = getLegacyMaleFields({
          sexo: row.animal.sexo,
          destinoProdutivo: nextDestino,
          statusReprodutivoMacho: nextStatusReprodutivo,
        });

        ops.push({
          table: "animais",
          action: "UPDATE",
          record: {
            id: row.animalId,
            payload,
            papel_macho,
            habilitado_monta,
            ...(loteChanged ? { lote_id: destinationLoteId } : {}),
            updated_at: occurredAt,
          },
        });
      }

      await createGesture(activeFarmId, ops);

      setSelectedIds([]);
      setBatchDestino(UNCHANGED);
      setBatchStatusReprodutivo(UNCHANGED);
      setBatchTransitionMode(UNCHANGED);
      setBatchLoteId(UNCHANGED);
      showSuccess(
        `${selectedRows.length} transicao(oes) enviada(s) para a fila offline.`,
      );
    } catch (error) {
      showError("Nao foi possivel aplicar as transicoes selecionadas.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!activeFarmId) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
            <Link to="/animais" className="hover:underline">
              Voltar para o rebanho
            </Link>
          </div>
          <h1 className="text-2xl font-bold">Transicoes de estagio</h1>
          <p className="text-sm text-muted-foreground">
            Confirme em lote os animais que atingiram um novo marco de vida.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{rows.length} pendencia(s)</Badge>
          <Badge variant="outline">{strategicCount} estrategica(s)</Badge>
          <Badge variant="outline">{biologicalCount} biologica(s)</Badge>
          <Badge variant="outline">{manualCount} manual</Badge>
          <Badge variant="secondary">{autoCount} auto/hibrido</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
              placeholder="Buscar por animal, lote ou motivo"
            />
          </div>

          <div className="w-full md:w-[220px]">
            <Label className="sr-only">Modo</Label>
            <Select value={modeFilter} onValueChange={(value: ModeFilter) => setModeFilter(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os modos</SelectItem>
                <SelectItem value="manual">Confirmacao manual</SelectItem>
                <SelectItem value="auto">Auto/hibrido</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-full md:w-[220px]">
            <Label className="sr-only">Tipo</Label>
            <Select value={kindFilter} onValueChange={(value: KindFilter) => setKindFilter(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="decisao_estrategica">Decisao estrategica</SelectItem>
                <SelectItem value="marco_biologico">Marco biologico</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {complianceBlockReason ? (
        <Card className="border-amber-200 bg-amber-50 shadow-none">
          <CardContent className="p-4 text-sm text-amber-900">
            {complianceBlockReason}
          </CardContent>
        </Card>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nenhuma transicao pendente"
          description="As regras atuais da fazenda ja estao refletidas nos animais ativos."
        />
      ) : (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base">Fila de transicoes</CardTitle>
              <p className="text-sm text-muted-foreground">
                Selecione varios animais, priorize estrategicos ou biologicos e confirme em um unico gesto.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setSelectedIds((current) =>
                    Array.from(
                      new Set([
                        ...current,
                        ...rows
                          .filter((row) => row.queueKind === "decisao_estrategica")
                          .map((row) => row.animalId),
                      ]),
                    ),
                  )
                }
                disabled={strategicCount === 0}
              >
                Selecionar estrategicos
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setSelectedIds((current) =>
                    Array.from(
                      new Set([
                        ...current,
                        ...rows
                          .filter((row) => row.queueKind === "marco_biologico")
                          .map((row) => row.animalId),
                      ]),
                    ),
                  )
                }
                disabled={biologicalCount === 0}
              >
                Selecionar biologicos
              </Button>
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={(checked) => toggleAllVisible(Boolean(checked))}
                  aria-label="Selecionar todos os animais visiveis"
                />
                <span className="text-sm text-muted-foreground">Selecionar visiveis</span>
              </div>

              <Button
                onClick={handleApplySelected}
                disabled={
                  selectedRows.length === 0 ||
                  isSubmitting ||
                  Boolean(complianceBlockReason)
                }
              >
                {isSubmitting
                  ? "Aplicando..."
                  : `Confirmar selecionados (${selectedRows.length})`}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedRows.length > 0 && (
              <div className="rounded-xl border bg-muted/20 p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      Decisoes para {selectedRows.length} animal(is)
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Perfil produtivo, modo de transicao e lote de destino entram
                      no mesmo gesto da confirmacao de estagio.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      {selectedMaleRows.length} macho(s)
                    </Badge>
                    <Badge variant="outline">
                      {selectedPostWeaningRows.length} pos-desmame
                    </Badge>
                    <Badge variant="outline">
                      {
                        selectedRows.filter(
                          (row) => row.queueKind === "decisao_estrategica",
                        ).length
                      }{" "}
                      estrategico(s)
                    </Badge>
                  </div>
                </div>

                {selectedMaleRows.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyMalePreset("reprodutor", "candidato")}
                    >
                      Machos para reproducao
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => applyMalePreset("engorda", "inativo")}
                    >
                      Machos para engorda
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setBatchDestino(UNCHANGED);
                        setBatchStatusReprodutivo(UNCHANGED);
                      }}
                    >
                      Limpar preset macho
                    </Button>
                  </div>
                )}

                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Destino produtivo</Label>
                    <Select
                      value={batchDestino}
                      onValueChange={(value: BatchDestinoValue) =>
                        handleBatchDestinoChange(value)
                      }
                      disabled={selectedMaleRows.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            selectedMaleRows.length === 0
                              ? "Nenhum macho selecionado"
                              : "Sem alteracao"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNCHANGED}>Sem alteracao</SelectItem>
                        <SelectItem value="reprodutor">Reprodutor</SelectItem>
                        <SelectItem value="rufiao">Rufiao</SelectItem>
                        <SelectItem value="engorda">Engorda</SelectItem>
                        <SelectItem value="abate">Abate</SelectItem>
                        <SelectItem value="venda">Venda</SelectItem>
                        <SelectItem value="descarte">Descarte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Status reprodutivo</Label>
                    <Select
                      value={batchStatusReprodutivo}
                      onValueChange={(value: BatchStatusValue) =>
                        setBatchStatusReprodutivo(value)
                      }
                      disabled={selectedMaleRows.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            selectedMaleRows.length === 0
                              ? "Nenhum macho selecionado"
                              : "Sem alteracao"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNCHANGED}>Sem alteracao</SelectItem>
                        <SelectItem value="candidato">Candidato</SelectItem>
                        <SelectItem value="apto">Apto</SelectItem>
                        <SelectItem value="suspenso">Suspenso</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Modo de transicao</Label>
                    <Select
                      value={batchTransitionMode}
                      onValueChange={(value: BatchTransitionModeValue) =>
                        setBatchTransitionMode(value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sem alteracao" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNCHANGED}>Sem alteracao</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="hibrido">Hibrido</SelectItem>
                        <SelectItem value="automatico">Automatico</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Lote de destino</Label>
                    <Select
                      value={batchLoteId}
                      onValueChange={setBatchLoteId}
                      disabled={selectedPostWeaningRows.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            selectedPostWeaningRows.length === 0
                              ? "Somente pos-desmame"
                              : "Sem alteracao"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNCHANGED}>Sem alteracao</SelectItem>
                        {(lotes ?? [])
                          .filter((lote) => !lote.deleted_at && lote.status === "ativo")
                          .map((lote) => (
                            <SelectItem key={lote.id} value={lote.id}>
                              {lote.nome}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[56px]">Sel.</TableHead>
                  <TableHead>Animal</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Transicao</TableHead>
                  <TableHead>Modo</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Ficha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.animalId}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(row.animalId)}
                        onCheckedChange={(checked) =>
                          toggleOne(row.animalId, Boolean(checked))
                        }
                        aria-label={`Selecionar ${row.identificacao}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{row.identificacao}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.suggestionKind === "initialize"
                            ? "Estagio inicial ainda nao registrado"
                            : "Promocao de estagio pendente"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{row.loteNome}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.queueKind === "decisao_estrategica"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {getPendingAnimalLifecycleKindLabel(row.queueKind)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getAnimalLifeStageLabel(row.currentStage)} para{" "}
                        {getAnimalLifeStageLabel(row.targetStage)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.canAutoApply ? "secondary" : "outline"}>
                        {row.canAutoApply ? "Auto/hibrido" : "Manual"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                        <span>{row.reason}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/animais/${row.animalId}`}>Abrir ficha</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
