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
  buildRegulatoryOverlayConfigPayload,
  buildRegulatoryOverlayEventPayload,
  getRegulatoryOverlayStatusLabel,
  getRegulatoryOverlayStatusTone,
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { showError, showSuccess } from "@/utils/toast";

interface RegulatoryOverlayManagerProps {
  activeFarmId: string;
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

export function RegulatoryOverlayManager({
  activeFarmId,
}: RegulatoryOverlayManagerProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedEntry, setSelectedEntry] = useState<RegulatoryOverlayEntry | null>(
    null,
  );
  const [form, setForm] = useState<OverlayExecutionForm | null>(null);
  const [isSaving, setIsSaving] = useState(false);
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

  const openEntry = (entry: RegulatoryOverlayEntry) => {
    setSelectedEntry(entry);
    setForm(createDefaultForm(entry));
  };

  const closeDialog = () => {
    setSelectedEntry(null);
    setForm(null);
  };

  const handleSave = async () => {
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
                  Overlay operacional do pack oficial
                </CardTitle>
                <Badge variant="outline">Procedural</Badge>
              </div>
              <CardDescription className="max-w-3xl text-sm leading-6">
                Executa as frentes do pack oficial que nao viram protocolo ou
                agenda automatica no modelo atual e ainda nao possuem fluxo
                dedicado. Aqui entram feed-ban para ruminantes, checklists de
                agua/limpeza, quarentena e obrigacoes administrativas
                documentais.
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
              Nenhum overlay procedural ativo no pack atual. Ative o pack
              oficial ou ajuste a configuracao para expor checklists e
              conformidade desta fazenda.
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

                    <Button onClick={() => openEntry(entry)}>
                      {entry.complianceKind === "feed_ban" ? (
                        <WheatOff className="mr-2 h-4 w-4" />
                      ) : (
                        <ShieldCheck className="mr-2 h-4 w-4" />
                      )}
                      Registrar verificacao
                    </Button>
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
    </>
  );
}
