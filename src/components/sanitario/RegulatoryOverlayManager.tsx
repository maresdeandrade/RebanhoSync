import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ClipboardCheck,
  ShieldCheck,
  WheatOff,
} from "lucide-react";

import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import {
  buildActiveRegulatoryOverlayEntries,
  removeFarmCustomRegulatoryOverlayDefinition,
  buildRegulatoryOverlayConfigPayload,
  buildRegulatoryOverlayEventPayload,
  getRegulatoryOverlayStatusLabel,
  getRegulatoryOverlayStatusTone,
  readFarmCustomRegulatoryOverlayDefinitions,
  upsertFarmCustomRegulatoryOverlayDefinition,
  type FarmCustomRegulatoryOverlayDefinition,
  type RegulatoryOverlayEntry,
} from "@/lib/sanitario/compliance";
import {
  getRegulatoryAnalyticsImpactLabel,
  getRegulatoryAnalyticsSubareaLabel,
  matchesRegulatoryAnalyticsImpact,
  matchesRegulatoryAnalyticsSubarea,
  parseRegulatoryAnalyticsImpactKey,
  parseRegulatoryAnalyticsSubareaKey,
} from "@/lib/sanitario/regulatoryReadModel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { showError, showSuccess } from "@/utils/toast";

interface RegulatoryOverlayManagerProps {
  activeFarmId: string;
  canManage: boolean;
}

type OverlayExecutionForm = {
  occurredOn: string;
  responsible: string;
  notes: string;
  productName: string;
  supplierName: string;
  reviewedLabel: boolean;
  prohibitedDetected: boolean;
  checklistAnswers: Record<string, boolean>;
};

type OverlayStructureDraft = {
  id: string | null;
  label: string;
  description: string;
  subarea: string;
  statusLegal: "obrigatorio" | "recomendado" | "boa_pratica";
  animalCentric: boolean;
  active: boolean;
};

const CHECKLIST_FIELDS_BY_SUBAREA: Record<
  string,
  Array<{ key: string; label: string; description: string }>
> = {
  quarentena: [
    {
      key: "segregacao_aplicada",
      label: "Segregacao aplicada",
      description: "Animal ou lote de entrada permanece separado do rebanho base.",
    },
    {
      key: "observacao_clinica",
      label: "Observacao clinica em andamento",
      description: "A entrada segue em observacao antes de integrar o lote definitivo.",
    },
    {
      key: "documentacao_revisada",
      label: "Documentacao revisada",
      description: "Origem e situacao sanitaria minima foram verificadas.",
    },
  ],
  agua_limpeza: [
    {
      key: "agua_adequada",
      label: "Agua adequada",
      description: "Agua de bebida e higiene esta em condicoes operacionais.",
    },
    {
      key: "bebedouros_limpos",
      label: "Bebedouros limpos",
      description: "Bebedouros foram higienizados e inspecionados.",
    },
    {
      key: "cochos_limpos",
      label: "Cochos limpos",
      description: "Cochos e areas de trato passaram por limpeza.",
    },
    {
      key: "equipamentos_higienizados",
      label: "Equipamentos higienizados",
      description: "Curral, utensilios e equipamentos foram revisados.",
    },
  ],
  atualizacao_rebanho: [
    {
      key: "dados_revisados",
      label: "Dados revisados",
      description: "Dados do rebanho e movimentacoes foram revisados.",
    },
    {
      key: "comprovacao_enviada",
      label: "Comprovacao enviada",
      description: "Etapa documental foi enviada ou concluida no canal oficial.",
    },
  ],
};

const CUSTOM_OVERLAY_SUBAREA_OPTIONS = [
  { value: "__none__", label: "Sem subarea analitica" },
  { value: "quarentena", label: "Quarentena" },
  { value: "agua_limpeza", label: "Agua e limpeza" },
  { value: "atualizacao_rebanho", label: "Documental" },
  { value: "comprovacao_brucelose", label: "Comprovacao de brucelose" },
] as const;

const CUSTOM_OVERLAY_STATUS_OPTIONS = [
  { value: "obrigatorio", label: "Obrigatorio" },
  { value: "recomendado", label: "Recomendado" },
  { value: "boa_pratica", label: "Boa pratica" },
] as const;

function toDateInputValue(value?: string | null) {
  if (!value) return new Date().toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function getChecklistFields(entry: RegulatoryOverlayEntry) {
  if (entry.complianceKind === "feed_ban") return [];
  if (entry.subarea && CHECKLIST_FIELDS_BY_SUBAREA[entry.subarea]) {
    return CHECKLIST_FIELDS_BY_SUBAREA[entry.subarea];
  }

  return [
    {
      key: "rotina_executada",
      label: "Rotina executada",
      description: "O procedimento operacional desta frente foi realizado.",
    },
    {
      key: "pendencias_tratadas",
      label: "Pendencias tratadas",
      description: "Desvios identificados ja receberam encaminhamento local.",
    },
  ];
}

function createDefaultForm(entry: RegulatoryOverlayEntry): OverlayExecutionForm {
  const checklistAnswers = Object.fromEntries(
    getChecklistFields(entry).map((field) => {
      const runtimeValue = entry.runtime?.answers?.[field.key];
      return [field.key, runtimeValue === true];
    }),
  );

  return {
    occurredOn: toDateInputValue(entry.runtime?.checkedAt),
    responsible:
      typeof entry.runtime?.responsible === "string" ? entry.runtime.responsible : "",
    notes: typeof entry.runtime?.notes === "string" ? entry.runtime.notes : "",
    productName:
      typeof entry.runtime?.answers?.product_name === "string"
        ? (entry.runtime.answers.product_name as string)
        : "",
    supplierName:
      typeof entry.runtime?.answers?.supplier_name === "string"
        ? (entry.runtime.answers.supplier_name as string)
        : "",
    reviewedLabel: entry.runtime?.answers?.reviewed_label === true,
    prohibitedDetected: entry.runtime?.answers?.prohibited_detected === true,
    checklistAnswers,
  };
}

function deriveOverlayStatus(
  entry: RegulatoryOverlayEntry,
  form: OverlayExecutionForm,
) {
  if (entry.complianceKind === "feed_ban") {
    return form.reviewedLabel && !form.prohibitedDetected
      ? "conforme"
      : "ajuste_necessario";
  }

  return Object.values(form.checklistAnswers).every(Boolean)
    ? "conforme"
    : "ajuste_necessario";
}

function buildOverlayAnswers(
  entry: RegulatoryOverlayEntry,
  form: OverlayExecutionForm,
): Record<string, unknown> {
  if (entry.complianceKind === "feed_ban") {
    return {
      product_name: form.productName.trim() || null,
      supplier_name: form.supplierName.trim() || null,
      reviewed_label: form.reviewedLabel,
      prohibited_detected: form.prohibitedDetected,
    };
  }

  return {
    ...form.checklistAnswers,
  };
}

function createEmptyStructureDraft(): OverlayStructureDraft {
  return {
    id: null,
    label: "",
    description: "",
    subarea: "__none__",
    statusLegal: "boa_pratica",
    animalCentric: false,
    active: true,
  };
}

function createStructureDraftFromEntry(
  entry: RegulatoryOverlayEntry,
): OverlayStructureDraft {
  return {
    id: entry.customOverlayId,
    label: entry.label,
    description:
      typeof entry.item.payload.indicacao === "string"
        ? entry.item.payload.indicacao
        : "",
    subarea: entry.subarea ?? "__none__",
    statusLegal: entry.template.status_legal,
    animalCentric: entry.animalCentric,
    active: true,
  };
}

function buildCustomOverlayDefinition(
  draft: OverlayStructureDraft,
): FarmCustomRegulatoryOverlayDefinition {
  const now = new Date().toISOString();
  return {
    id: draft.id ?? crypto.randomUUID(),
    label: draft.label.trim(),
    description: draft.description.trim(),
    subarea: draft.subarea === "__none__" ? null : draft.subarea,
    statusLegal: draft.statusLegal,
    animalCentric: draft.animalCentric,
    active: draft.active,
    createdAt: draft.id ? null : now,
    updatedAt: now,
  };
}

function buildFarmSanitaryConfigRecord(
  activeFarmId: string,
  currentPayload: Record<string, unknown>,
  currentConfig:
    | {
        uf: string | null;
        aptidao: string;
        sistema: string;
        zona_raiva_risco: string;
        pressao_carrapato: string;
        pressao_helmintos: string;
        modo_calendario: string;
      }
    | null
    | undefined,
) {
  return {
    fazenda_id: activeFarmId,
    uf: currentConfig?.uf ?? null,
    aptidao: currentConfig?.aptidao ?? "all",
    sistema: currentConfig?.sistema ?? "all",
    zona_raiva_risco: currentConfig?.zona_raiva_risco ?? "baixo",
    pressao_carrapato: currentConfig?.pressao_carrapato ?? "baixo",
    pressao_helmintos: currentConfig?.pressao_helmintos ?? "baixo",
    modo_calendario: currentConfig?.modo_calendario ?? "minimo_legal",
    payload: currentPayload,
  };
}

function getOverlaySourceLabel(entry: RegulatoryOverlayEntry) {
  return entry.sourceScope === "oficial" ? "Oficial" : "Fazenda";
}

export function RegulatoryOverlayManager({
  activeFarmId,
  canManage,
}: RegulatoryOverlayManagerProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedEntry, setSelectedEntry] = useState<RegulatoryOverlayEntry | null>(
    null,
  );
  const [form, setForm] = useState<OverlayExecutionForm | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [structureDraft, setStructureDraft] = useState<OverlayStructureDraft | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<RegulatoryOverlayEntry | null>(
    null,
  );
  const [isSavingStructure, setIsSavingStructure] = useState(false);
  const [isDeletingStructure, setIsDeletingStructure] = useState(false);
  const activeSubareaFilter = parseRegulatoryAnalyticsSubareaKey(
    searchParams.get("overlaySubarea"),
  );
  const activeImpactFilter = parseRegulatoryAnalyticsImpactKey(
    searchParams.get("overlayImpact"),
  );

  const config = useLiveQuery(
    () => db.state_fazenda_sanidade_config.get(activeFarmId),
    [activeFarmId],
  );
  const templates = useLiveQuery(() => db.catalog_protocolos_oficiais.toArray(), []);
  const items = useLiveQuery(() => db.catalog_protocolos_oficiais_itens.toArray(), []);

  const entries = useMemo(
    () =>
      buildActiveRegulatoryOverlayEntries({
        config,
        templates: templates ?? [],
        items: items ?? [],
      }),
    [config, items, templates],
  );
  const customOverlayDefinitions = useMemo(
    () => readFarmCustomRegulatoryOverlayDefinitions(config?.payload),
    [config?.payload],
  );

  const visibleEntries = useMemo(
    () =>
      entries.filter((entry) => {
        if (
          activeSubareaFilter &&
          !matchesRegulatoryAnalyticsSubarea(entry, activeSubareaFilter)
        ) {
          return false;
        }
        if (
          activeImpactFilter &&
          !matchesRegulatoryAnalyticsImpact(entry, activeImpactFilter)
        ) {
          return false;
        }
        return true;
      }),
    [activeImpactFilter, activeSubareaFilter, entries],
  );
  const visibleSummary = useMemo(
    () => ({
      pendente: visibleEntries.filter((entry) => entry.status === "pendente").length,
      conforme: visibleEntries.filter((entry) => entry.status === "conforme").length,
      ajuste: visibleEntries.filter((entry) => entry.status === "ajuste_necessario").length,
    }),
    [visibleEntries],
  );
  const hasActiveAnalyticalCut = Boolean(activeSubareaFilter || activeImpactFilter);
  const customEntryCount = entries.filter((entry) => entry.sourceScope === "fazenda").length;
  const officialEntryCount = entries.filter((entry) => entry.sourceScope === "oficial").length;

  const openEntry = (entry: RegulatoryOverlayEntry) => {
    setSelectedEntry(entry);
    setForm(createDefaultForm(entry));
  };

  const closeDialog = () => {
    setSelectedEntry(null);
    setForm(null);
  };

  const openCreateStructure = () => {
    setStructureDraft(createEmptyStructureDraft());
  };

  const openEditStructure = (entry: RegulatoryOverlayEntry) => {
    if (!entry.editable) return;
    setStructureDraft(createStructureDraftFromEntry(entry));
  };

  const closeStructureDialog = () => {
    setStructureDraft(null);
  };

  const handleSave = async () => {
    if (!canManage) {
      showError("Apenas manager e owner podem registrar o overlay.");
      return;
    }

    if (!selectedEntry || !form || !config) {
      showError("Contexto do overlay regulatorio ainda nao esta disponivel.");
      return;
    }

    if (
      selectedEntry.complianceKind === "feed_ban" &&
      form.productName.trim().length === 0
    ) {
      showError("Informe a formulacao ou produto verificado no feed-ban.");
      return;
    }

    const occurredAt = new Date(`${form.occurredOn}T12:00:00`).toISOString();
    const status = deriveOverlayStatus(selectedEntry, form);
    const answers = buildOverlayAnswers(selectedEntry, form);

    setIsSaving(true);
    try {
      const built = buildEventGesture({
        dominio: "conformidade",
        fazendaId: activeFarmId,
        occurredAt,
        observacoes:
          form.notes.trim() ||
          `${selectedEntry.label} registrado no overlay regulatorio`,
        complianceKind: selectedEntry.complianceKind,
        payload: buildRegulatoryOverlayEventPayload(selectedEntry, {
          status,
          occurredAt,
          responsible: form.responsible,
          notes: form.notes,
          answers,
        }),
      });

      const nextPayload = buildRegulatoryOverlayConfigPayload(
        config.payload,
        selectedEntry,
        {
          status,
          occurredAt,
          responsible: form.responsible,
          notes: form.notes,
          answers,
        },
        built.eventId,
      );

      await createGesture(activeFarmId, [
        ...built.ops,
        {
          table: "fazenda_sanidade_config",
          action: "UPDATE",
          record: {
            fazenda_id: activeFarmId,
            payload: nextPayload,
          },
        },
      ]);

      closeDialog();
      showSuccess(
        status === "conforme"
          ? "Verificacao regulatoria registrada como conforme."
          : "Verificacao regulatoria registrada com ajuste necessario.",
      );
    } catch (error) {
      console.error(error);
      showError("Nao foi possivel registrar a verificacao do overlay.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveStructure = async () => {
    if (!canManage) {
      showError("Apenas manager e owner podem estruturar overlays da fazenda.");
      return;
    }

    if (!structureDraft) return;
    if (structureDraft.label.trim().length === 0) {
      showError("Informe o nome do complemento operacional.");
      return;
    }

    const now = new Date().toISOString();
    const builtDefinition = buildCustomOverlayDefinition(structureDraft);
    const existingDefinition = structureDraft.id
      ? customOverlayDefinitions.find((entry) => entry.id === structureDraft.id) ?? null
      : null;

    const normalizedDefinition: FarmCustomRegulatoryOverlayDefinition = {
      ...builtDefinition,
      createdAt:
        existingDefinition?.createdAt ?? builtDefinition.createdAt ?? now,
      updatedAt: now,
    };

    const nextPayload = upsertFarmCustomRegulatoryOverlayDefinition(
      config?.payload,
      normalizedDefinition,
    );

    setIsSavingStructure(true);
    try {
      await createGesture(activeFarmId, [
        {
          table: "fazenda_sanidade_config",
          action: config ? "UPDATE" : "INSERT",
          record: buildFarmSanitaryConfigRecord(activeFarmId, nextPayload, config),
        },
      ]);

      closeStructureDialog();
      showSuccess(
        structureDraft.id
          ? "Complemento operacional atualizado."
          : "Complemento operacional criado.",
      );
    } catch (error) {
      console.error(error);
      showError("Nao foi possivel salvar o complemento operacional.");
    } finally {
      setIsSavingStructure(false);
    }
  };

  const handleDeleteStructure = async () => {
    if (!canManage) {
      showError("Apenas manager e owner podem remover overlays da fazenda.");
      return;
    }

    if (!deleteTarget?.customOverlayId) return;

    const nextPayload = removeFarmCustomRegulatoryOverlayDefinition(
      config?.payload,
      deleteTarget.customOverlayId,
    );

    setIsDeletingStructure(true);
    try {
      await createGesture(activeFarmId, [
        {
          table: "fazenda_sanidade_config",
          action: config ? "UPDATE" : "INSERT",
          record: buildFarmSanitaryConfigRecord(activeFarmId, nextPayload, config),
        },
      ]);
      setDeleteTarget(null);
      showSuccess("Complemento operacional removido.");
    } catch (error) {
      console.error(error);
      showError("Nao foi possivel remover o complemento operacional.");
    } finally {
      setIsDeletingStructure(false);
    }
  };

  const currentStatus = selectedEntry && form
    ? deriveOverlayStatus(selectedEntry, form)
    : "pendente";

  return (
    <>
      <Card className="border-amber-200/70 bg-amber-50/30">
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-amber-700" />
                <CardTitle className="text-xl">
                  Complementos operacionais e overlays
                </CardTitle>
                <Badge variant="outline">Procedural</Badge>
              </div>
              <CardDescription className="max-w-3xl text-sm leading-6">
                Concentra, em uma unica superficie, as frentes procedurais do
                pack oficial e os complementos operacionais da fazenda que nao
                viram protocolo ou agenda automatica no modelo atual. Aqui
                entram feed-ban para ruminantes, checklists de agua/limpeza,
                quarentena, obrigacoes documentais e boas praticas internas.
              </CardDescription>
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusBadge tone="warning">
                {visibleSummary.pendente} pendente(s)
              </StatusBadge>
              {visibleSummary.ajuste > 0 ? (
                <StatusBadge tone="danger">{visibleSummary.ajuste} ajuste(s)</StatusBadge>
              ) : null}
              {visibleSummary.conforme > 0 ? (
                <StatusBadge tone="success">
                  {visibleSummary.conforme} conforme(s)
                </StatusBadge>
              ) : null}
              {hasActiveAnalyticalCut ? (
                <StatusBadge tone="info">
                  {visibleEntries.length} de {entries.length} no recorte
                </StatusBadge>
              ) : null}
              <StatusBadge tone="info">
                {officialEntryCount} oficial(is) | {customEntryCount} fazenda
              </StatusBadge>
              {canManage ? (
                <Button variant="outline" size="sm" onClick={openCreateStructure}>
                  Novo complemento da fazenda
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {hasActiveAnalyticalCut ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/80 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {activeSubareaFilter ? (
                    <Badge variant="outline">
                      Subarea: {getRegulatoryAnalyticsSubareaLabel(activeSubareaFilter)}
                    </Badge>
                  ) : null}
                  {activeImpactFilter ? (
                    <Badge variant="outline">
                      Impacto: {getRegulatoryAnalyticsImpactLabel(activeImpactFilter)}
                    </Badge>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  O overlay operacional esta aberto em modo recortado para apoiar a
                  triagem analitica do dashboard.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/protocolos-sanitarios")}
              >
                Limpar recorte
              </Button>
            </div>
          ) : null}

          {entries.length === 0 ? (
            <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-6 text-sm text-muted-foreground">
              Nenhum overlay ou complemento operacional ativo nesta fazenda.
              Ative o pack oficial ou crie um complemento local para expor
              checklists e conformidade nesta camada.
            </div>
          ) : visibleEntries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 bg-background/80 px-4 py-6 text-sm text-muted-foreground">
              Nenhum item do recorte analitico atual permanece aberto. Limpe o
              recorte para voltar ao overlay completo.
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {visibleEntries.map((entry) => (
                <Card key={`${entry.template.id}:${entry.item.id}`} className="border-border/70">
                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{entry.label}</CardTitle>
                        <CardDescription>{entry.template.nome}</CardDescription>
                      </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={entry.sourceScope === "oficial" ? "outline" : "secondary"}>
                        {getOverlaySourceLabel(entry)}
                      </Badge>
                      <StatusBadge tone={getRegulatoryOverlayStatusTone(entry.status)}>
                        {getRegulatoryOverlayStatusLabel(entry.status)}
                      </StatusBadge>
                        <Badge variant="outline">
                          {entry.complianceKind === "feed_ban"
                            ? "Feed-ban"
                            : "Checklist"}
                        </Badge>
                      </div>
                    </div>

                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{entry.item.area}</Badge>
                        {entry.subarea ? <Badge variant="outline">{entry.subarea}</Badge> : null}
                        <Badge variant="outline">
                          {entry.template.status_legal.replaceAll("_", " ")}
                        </Badge>
                      {entry.animalCentric ? (
                        <Badge variant="secondary">Animal-centric</Badge>
                      ) : (
                          <Badge variant="outline">Nivel fazenda</Badge>
                        )}
                        {entry.editable ? (
                          <Badge variant="secondary">Editavel</Badge>
                        ) : null}
                      </div>
                    </CardHeader>

                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {typeof entry.item.payload.indicacao === "string"
                        ? entry.item.payload.indicacao
                        : "Procedimento operacional ativo no overlay regulatorio."}
                    </p>

                    {entry.runtime ? (
                      <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-sm">
                        <p className="font-medium text-foreground">
                          Ultima verificacao: {entry.runtime.checkedAt.slice(0, 10)}
                        </p>
                        {entry.runtime.responsible ? (
                          <p className="text-muted-foreground">
                            Responsavel: {entry.runtime.responsible}
                          </p>
                        ) : null}
                        {entry.runtime.notes ? (
                          <p className="text-muted-foreground">{entry.runtime.notes}</p>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-3 text-sm text-muted-foreground">
                        Sem execucao registrada ainda.
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => openEntry(entry)} disabled={!canManage}>
                        {entry.complianceKind === "feed_ban" ? (
                          <WheatOff className="mr-2 h-4 w-4" />
                        ) : (
                          <ShieldCheck className="mr-2 h-4 w-4" />
                        )}
                        Registrar verificacao
                      </Button>
                      {entry.editable ? (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => openEditStructure(entry)}
                            disabled={!canManage}
                          >
                            Editar complemento
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setDeleteTarget(entry)}
                            disabled={!canManage}
                          >
                            Remover
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedEntry && form)} onOpenChange={(open) => (!open ? closeDialog() : null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedEntry?.complianceKind === "feed_ban"
                ? "Registrar feed-ban de ruminantes"
                : "Registrar checklist operacional"}
            </DialogTitle>
            <DialogDescription>
              {selectedEntry?.template.nome}
            </DialogDescription>
          </DialogHeader>

          {selectedEntry && form ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <StatusBadge tone={getRegulatoryOverlayStatusTone(currentStatus)}>
                  {getRegulatoryOverlayStatusLabel(currentStatus)}
                </StatusBadge>
                {selectedEntry.subarea ? (
                  <Badge variant="outline">{selectedEntry.subarea}</Badge>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="overlay-date">Data da verificacao</Label>
                  <Input
                    id="overlay-date"
                    type="date"
                    value={form.occurredOn}
                    onChange={(event) =>
                      setForm((current) =>
                        current ? { ...current, occurredOn: event.target.value } : current,
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="overlay-responsible">Responsavel</Label>
                  <Input
                    id="overlay-responsible"
                    value={form.responsible}
                    onChange={(event) =>
                      setForm((current) =>
                        current ? { ...current, responsible: event.target.value } : current,
                      )
                    }
                    placeholder="Ex.: equipe de curral / veterinario"
                  />
                </div>
              </div>

              {selectedEntry.complianceKind === "feed_ban" ? (
                <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/10 p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="feed-ban-product">Produto / formulacao</Label>
                      <Input
                        id="feed-ban-product"
                        value={form.productName}
                        onChange={(event) =>
                          setForm((current) =>
                            current ? { ...current, productName: event.target.value } : current,
                          )
                        }
                        placeholder="Ex.: nucleo, suplemento ou racao"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="feed-ban-supplier">Fornecedor</Label>
                      <Input
                        id="feed-ban-supplier"
                        value={form.supplierName}
                        onChange={(event) =>
                          setForm((current) =>
                            current ? { ...current, supplierName: event.target.value } : current,
                          )
                        }
                        placeholder="Fornecedor ou fabrica"
                      />
                    </div>
                  </div>

                  <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/80 p-3">
                    <Checkbox
                      checked={form.reviewedLabel}
                      onCheckedChange={(checked) =>
                        setForm((current) =>
                          current ? { ...current, reviewedLabel: checked === true } : current,
                        )
                      }
                    />
                    <div className="space-y-1">
                      <span className="text-sm font-medium text-foreground">
                        Rotulo e formulacao revisados
                      </span>
                      <p className="text-sm text-muted-foreground">
                        Confirma leitura da composicao para uso em ruminantes.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/80 p-3">
                    <Checkbox
                      checked={form.prohibitedDetected}
                      onCheckedChange={(checked) =>
                        setForm((current) =>
                          current
                            ? { ...current, prohibitedDetected: checked === true }
                            : current,
                        )
                      }
                    />
                    <div className="space-y-1">
                      <span className="text-sm font-medium text-foreground">
                        Ingrediente proibido detectado
                      </span>
                      <p className="text-sm text-muted-foreground">
                        Marque quando a formula contiver proteina ou gordura animal proibida.
                      </p>
                    </div>
                  </label>
                </div>
              ) : (
                <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/10 p-4">
                  {getChecklistFields(selectedEntry).map((field) => (
                    <label
                      key={field.key}
                      className="flex items-start gap-3 rounded-xl border border-border/70 bg-background/80 p-3"
                    >
                      <Checkbox
                        checked={form.checklistAnswers[field.key] === true}
                        onCheckedChange={(checked) =>
                          setForm((current) =>
                            current
                              ? {
                                  ...current,
                                  checklistAnswers: {
                                    ...current.checklistAnswers,
                                    [field.key]: checked === true,
                                  },
                                }
                              : current,
                          )
                        }
                      />
                      <div className="space-y-1">
                        <span className="text-sm font-medium text-foreground">
                          {field.label}
                        </span>
                        <p className="text-sm text-muted-foreground">
                          {field.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="overlay-notes">Observacoes</Label>
                <Textarea
                  id="overlay-notes"
                  value={form.notes}
                  onChange={(event) =>
                    setForm((current) =>
                      current ? { ...current, notes: event.target.value } : current,
                    )
                  }
                  placeholder="Registre desvio, acao corretiva ou contexto da verificacao."
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSave()} disabled={isSaving || !selectedEntry || !form}>
              {isSaving ? "Salvando..." : "Registrar verificacao"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(structureDraft)} onOpenChange={(open) => (!open ? closeStructureDialog() : null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {structureDraft?.id
                ? "Editar complemento operacional"
                : "Novo complemento operacional da fazenda"}
            </DialogTitle>
            <DialogDescription>
              Crie um checklist adicional de boa pratica, recomendacao tecnica ou
              obrigacao interna sem abrir outra tela e sem misturar isso ao pack
              oficial.
            </DialogDescription>
          </DialogHeader>

          {structureDraft ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="custom-overlay-label">Nome</Label>
                <Input
                  id="custom-overlay-label"
                  value={structureDraft.label}
                  onChange={(event) =>
                    setStructureDraft((current) =>
                      current ? { ...current, label: event.target.value } : current,
                    )
                  }
                  placeholder="Ex.: Checklist pre-lote maternidade"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="custom-overlay-description">Descricao operacional</Label>
                <Textarea
                  id="custom-overlay-description"
                  value={structureDraft.description}
                  onChange={(event) =>
                    setStructureDraft((current) =>
                      current
                        ? { ...current, description: event.target.value }
                        : current,
                    )
                  }
                  rows={3}
                  placeholder="Explique o procedimento ou a boa pratica que a equipe deve registrar."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Subarea</Label>
                  <Select
                    value={structureDraft.subarea}
                    onValueChange={(value) =>
                      setStructureDraft((current) =>
                        current ? { ...current, subarea: value } : current,
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CUSTOM_OVERLAY_SUBAREA_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status legal</Label>
                  <Select
                    value={structureDraft.statusLegal}
                    onValueChange={(value) =>
                      setStructureDraft((current) =>
                        current
                          ? {
                              ...current,
                              statusLegal: value as OverlayStructureDraft["statusLegal"],
                            }
                          : current,
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CUSTOM_OVERLAY_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-border/70 p-4">
                <Checkbox
                  checked={structureDraft.animalCentric}
                  onCheckedChange={(checked) =>
                    setStructureDraft((current) =>
                      current
                        ? { ...current, animalCentric: checked === true }
                        : current,
                    )
                  }
                />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Marcar como animal-centric
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Use quando a leitura e os impactos desse checklist devem ser
                    interpretados como ligados ao manejo animal, e nao apenas ao
                    nivel fazenda.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeStructureDialog}
              disabled={isSavingStructure}
            >
              Cancelar
            </Button>
            <Button onClick={handleSaveStructure} disabled={isSavingStructure}>
              {isSavingStructure ? "Salvando..." : "Salvar complemento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => (!open ? setDeleteTarget(null) : null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Remover complemento operacional?</DialogTitle>
            <DialogDescription>
              A definicao estrutural sera removida da fazenda. Eventos append-only
              ja registrados permanecem no historico.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl border border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{deleteTarget?.label}</p>
            <p className="mt-1">
              O complemento deixara de aparecer no overlay operacional da fazenda.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeletingStructure}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteStructure}
              disabled={isDeletingStructure}
            >
              {isDeletingStructure ? "Removendo..." : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
