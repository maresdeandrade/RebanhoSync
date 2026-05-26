import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ClipboardList,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { db } from "@/lib/offline/db";
import type {
  EstadoUFEnum,
  FazendaSanitaryCalendarModeEnum,
  FazendaSanitaryRiskLevelEnum,
  SanitaryOfficialAptidaoEnum,
  SanitaryOfficialLegalStatusEnum,
  SanitaryOfficialSistemaEnum,
  SistemaManejoEnum,
  TipoProducaoEnum,
} from "@/lib/offline/types";
import { supabase } from "@/lib/supabase";
import {
  activateOfficialSanitaryPack,
  refreshOfficialSanitaryCatalog,
  resolveOfficialAptidao,
  resolveOfficialSistema,
  selectOfficialSanitaryPack,
  type OfficialSanitaryPackConfigInput,
} from "@/lib/sanitario/catalog/officialCatalog";
import {
  summarizeOfficialPackSelectionPresentation,
  summarizeOfficialPackTemplatePresentation,
} from "@/lib/sanitario/catalog/officialPackPresentation";
import { showError, showSuccess } from "@/utils/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface OfficialSanitaryPackManagerProps {
  activeFarmId: string;
  canManage: boolean;
}

interface FarmSanitaryProfile {
  estado: EstadoUFEnum | null;
  tipo_producao: TipoProducaoEnum | null;
  sistema_manejo: SistemaManejoEnum | null;
}

const UF_OPTIONS: EstadoUFEnum[] = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

const CALENDAR_MODE_OPTIONS: Array<{
  value: FazendaSanitaryCalendarModeEnum;
  label: string;
}> = [
  { value: "minimo_legal", label: "Minimo legal" },
  { value: "tecnico_recomendado", label: "Tecnico recomendado" },
  { value: "completo", label: "Completo" },
];

const RISK_OPTIONS: Array<{
  value: FazendaSanitaryRiskLevelEnum;
  label: string;
}> = [
  { value: "baixo", label: "Baixo" },
  { value: "medio", label: "Medio" },
  { value: "alto", label: "Alto" },
];

const APTIDAO_OPTIONS: Array<{
  value: SanitaryOfficialAptidaoEnum;
  label: string;
}> = [
  { value: "all", label: "Nao informado" },
  { value: "corte", label: "Corte" },
  { value: "leite", label: "Leite" },
  { value: "misto", label: "Misto" },
];

const SISTEMA_OPTIONS: Array<{
  value: SanitaryOfficialSistemaEnum;
  label: string;
}> = [
  { value: "all", label: "Nao informado" },
  { value: "extensivo", label: "Extensivo" },
  { value: "semi_intensivo", label: "Semi-intensivo" },
  { value: "intensivo", label: "Intensivo" },
];

function getLegalStatusBadgeVariant(status: SanitaryOfficialLegalStatusEnum) {
  if (status === "obrigatorio") return "destructive";
  if (status === "recomendado") return "secondary";
  return "outline";
}

function getLegalStatusLabel(status: SanitaryOfficialLegalStatusEnum) {
  if (status === "obrigatorio") return "Obrigatorio";
  if (status === "recomendado") return "Recomendado";
  return "Boa pratica";
}

function readArrayLength(
  payload: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = payload?.[key];
  return Array.isArray(value) ? value.length : 0;
}

export function OfficialSanitaryPackManager({
  activeFarmId,
  canManage,
}: OfficialSanitaryPackManagerProps) {
  const navigate = useNavigate();
  const [farmProfile, setFarmProfile] = useState<FarmSanitaryProfile | null>(
    null,
  );
  const [form, setForm] = useState<OfficialSanitaryPackConfigInput | null>(
    null,
  );
  const [isLoadingFarmProfile, setIsLoadingFarmProfile] = useState(false);
  const [isRefreshingCatalog, setIsRefreshingCatalog] = useState(false);
  const [isApplyingPack, setIsApplyingPack] = useState(false);

  const savedConfig = useLiveQuery(() => {
    return db.state_fazenda_sanidade_config.get(activeFarmId);
  }, [activeFarmId]);

  const officialTemplates = useLiveQuery(() => {
    return db.catalog_protocolos_oficiais.toArray();
  }, []);

  const officialItems = useLiveQuery(() => {
    return db.catalog_protocolos_oficiais_itens.toArray();
  }, []);

  const officialDiseases = useLiveQuery(() => {
    return db.catalog_doencas_notificaveis.toArray();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsRefreshingCatalog(true);

    refreshOfficialSanitaryCatalog()
      .catch((error) => {
        if (!cancelled) {
          console.warn(
            "[official-sanitary-pack] failed to refresh official catalog",
            error,
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsRefreshingCatalog(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingFarmProfile(true);

    supabase
      .from("fazendas")
      .select("estado, tipo_producao, sistema_manejo")
      .eq("id", activeFarmId)
      .is("deleted_at", null)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.warn(
            "[official-sanitary-pack] failed to load farm profile",
            error,
          );
          setFarmProfile(null);
          return;
        }

        setFarmProfile({
          estado: data?.estado ?? null,
          tipo_producao: data?.tipo_producao ?? null,
          sistema_manejo: data?.sistema_manejo ?? null,
        });
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingFarmProfile(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeFarmId]);

  useEffect(() => {
    setForm({
      uf: savedConfig?.uf ?? farmProfile?.estado ?? null,
      aptidao:
        savedConfig?.aptidao ??
        resolveOfficialAptidao(farmProfile?.tipo_producao ?? null),
      sistema:
        savedConfig?.sistema ??
        resolveOfficialSistema(farmProfile?.sistema_manejo ?? null),
      zonaRaivaRisco: savedConfig?.zona_raiva_risco ?? "baixo",
      pressaoCarrapato: savedConfig?.pressao_carrapato ?? "baixo",
      pressaoHelmintos: savedConfig?.pressao_helmintos ?? "baixo",
      modoCalendario: savedConfig?.modo_calendario ?? "minimo_legal",
    });
  }, [
    farmProfile?.estado,
    farmProfile?.sistema_manejo,
    farmProfile?.tipo_producao,
    savedConfig?.aptidao,
    savedConfig?.modo_calendario,
    savedConfig?.pressao_carrapato,
    savedConfig?.pressao_helmintos,
    savedConfig?.sistema,
    savedConfig?.uf,
    savedConfig?.zona_raiva_risco,
  ]);

  const catalog = {
    templates: officialTemplates ?? [],
    items: officialItems ?? [],
    diseases: officialDiseases ?? [],
  };

  const selection =
    form && catalog.templates.length > 0
      ? selectOfficialSanitaryPack(catalog, form)
      : null;

  const legalStatusCounts = {
    obrigatorio:
      selection?.templates.filter(
        (entry) => entry.template.status_legal === "obrigatorio",
      ).length ?? 0,
    recomendado:
      selection?.templates.filter(
        (entry) => entry.template.status_legal === "recomendado",
      ).length ?? 0,
    boa_pratica:
      selection?.templates.filter(
        (entry) => entry.template.status_legal === "boa_pratica",
      ).length ?? 0,
  };

  const materializableCount =
    selection?.templates.reduce(
      (total, entry) => total + entry.materializableItems.length,
      0,
    ) ?? 0;
  const skippedCount =
    selection?.templates.reduce(
      (total, entry) => total + entry.skippedItems.length,
      0,
    ) ?? 0;
  const stateOverlayCount =
    selection?.templates.filter((entry) => entry.template.escopo === "estadual")
      .length ?? 0;
  const selectedPreview = selection?.templates.slice(0, 6) ?? [];
  const hiddenPreviewCount = Math.max(
    0,
    (selection?.templates.length ?? 0) - selectedPreview.length,
  );
  const selectionPresentation = summarizeOfficialPackSelectionPresentation(
    selection?.templates ?? [],
  );
  const appliedTemplateCount = readArrayLength(
    savedConfig?.payload ?? null,
    "activated_template_ids",
  );

  const handleRefreshCatalog = async () => {
    setIsRefreshingCatalog(true);
    try {
      const refreshed = await refreshOfficialSanitaryCatalog();
      showSuccess(
        `Catalogo oficial atualizado com ${refreshed.templates.length} packs regulatorios.`,
      );
    } catch (error) {
      console.error("[official-sanitary-pack] refresh failed", error);
      showError("Nao foi possivel atualizar o catalogo oficial.");
    } finally {
      setIsRefreshingCatalog(false);
    }
  };

  const handleApplyPack = async () => {
    if (!canManage) {
      showError("Apenas manager e owner podem ativar o pack oficial.");
      return;
    }

    if (!form) {
      showError("Contexto sanitario da fazenda ainda nao foi carregado.");
      return;
    }

    setIsApplyingPack(true);
    try {
      const result = await activateOfficialSanitaryPack({
        fazendaId: activeFarmId,
        config: form,
      });

      // Log result for debugging (selection + operationCount)
      if (import.meta.env.DEV) {
        console.debug("[official-sanitary-pack] activation result:", result);
      }

      if (!result.operationCount || result.operationCount === 0) {
        showSuccess(
          `Pack oficial ativado com ${result.selection.templates.length} frente(s). Nenhuma etapa operacional nova foi materializada; confira Protocolos da fazenda para ver o que gera agenda.`,
        );
      } else {
        showSuccess(
          `Pack oficial ativado com ${result.selection.templates.length} frente(s). ${result.operationCount} operacoes enfileiradas; confira status operacional e agenda gerada.`,
        );
      }
    } catch (error) {
      console.error("[official-sanitary-pack] activation failed", error);
      showError("Nao foi possivel ativar o pack oficial desta fazenda.");
    } finally {
      setIsApplyingPack(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="gap-3 px-4 py-3 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">
                Protocolo oficial
              </CardTitle>
              {appliedTemplateCount > 0 ? (
                <Badge variant="secondary">
                  {appliedTemplateCount} ativo(s)
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleRefreshCatalog}
              disabled={isRefreshingCatalog}
            >
              {isRefreshingCatalog ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Atualizar
            </Button>
            <Button
              type="button"
              onClick={handleApplyPack}
              disabled={
                !canManage ||
                !form ||
                isApplyingPack ||
                isLoadingFarmProfile ||
                catalog.templates.length === 0
              }
            >
              {isApplyingPack ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Aplicar oficial
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-4 pt-0 sm:px-5">
        <div className="rounded-xl border border-border/70 bg-background/80 px-4 py-3 text-sm leading-6 text-muted-foreground">
          O pack oficial define a camada regulatória. Agenda automática depende
          de protocolos operacionais materializados, ativos, com etapa
          configurada como gera agenda e configuração sanitária compatível.
        </div>

        {!canManage ? (
          <div className="rounded-xl border border-border/70 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
            Seu perfil esta em modo leitura.
          </div>
        ) : null}

        {!form ? (
          <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <Label>UF regulatoria</Label>
                <Select
                  value={form.uf ?? "__none__"}
                  onValueChange={(value) =>
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            uf:
                              value === "__none__"
                                ? null
                                : (value as EstadoUFEnum),
                          }
                        : current,
                    )
                  }
                  disabled={!canManage}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a UF" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Somente federal</SelectItem>
                    {UF_OPTIONS.map((uf) => (
                      <SelectItem key={uf} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Modo do calendario</Label>
                <Select
                  value={form.modoCalendario}
                  onValueChange={(value) =>
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            modoCalendario:
                              value as FazendaSanitaryCalendarModeEnum,
                          }
                        : current,
                    )
                  }
                  disabled={!canManage}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o modo" />
                  </SelectTrigger>
                  <SelectContent>
                    {CALENDAR_MODE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Aptidao</Label>
                <Select
                  value={form.aptidao}
                  onValueChange={(value) =>
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            aptidao: value as SanitaryOfficialAptidaoEnum,
                          }
                        : current,
                    )
                  }
                  disabled={!canManage}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a aptidao" />
                  </SelectTrigger>
                  <SelectContent>
                    {APTIDAO_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Sistema</Label>
                <Select
                  value={form.sistema}
                  onValueChange={(value) =>
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            sistema: value as SanitaryOfficialSistemaEnum,
                          }
                        : current,
                    )
                  }
                  disabled={!canManage}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o sistema" />
                  </SelectTrigger>
                  <SelectContent>
                    {SISTEMA_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Risco de raiva</Label>
                <Select
                  value={form.zonaRaivaRisco}
                  onValueChange={(value) =>
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            zonaRaivaRisco:
                              value as FazendaSanitaryRiskLevelEnum,
                          }
                        : current,
                    )
                  }
                  disabled={!canManage}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o risco" />
                  </SelectTrigger>
                  <SelectContent>
                    {RISK_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Pressao de carrapato</Label>
                <Select
                  value={form.pressaoCarrapato}
                  onValueChange={(value) =>
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            pressaoCarrapato:
                              value as FazendaSanitaryRiskLevelEnum,
                          }
                        : current,
                    )
                  }
                  disabled={!canManage}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a pressao" />
                  </SelectTrigger>
                  <SelectContent>
                    {RISK_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Pressao de helmintos</Label>
                <Select
                  value={form.pressaoHelmintos}
                  onValueChange={(value) =>
                    setForm((current) =>
                      current
                        ? {
                            ...current,
                            pressaoHelmintos:
                              value as FazendaSanitaryRiskLevelEnum,
                          }
                        : current,
                    )
                  }
                  disabled={!canManage}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a pressao" />
                  </SelectTrigger>
                  <SelectContent>
                    {RISK_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!form.uf ? (
              <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div>Sem UF definida, entram apenas regras federais.</div>
              </div>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
              <div className="space-y-3 rounded-2xl border border-border/70 bg-background/80 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {selection?.templates.length ?? 0} frentes selecionadas
                  </Badge>
                  <Badge variant="outline">
                    {stateOverlayCount > 0
                      ? `${stateOverlayCount} regra(s) estaduais`
                      : "Somente federal"}
                  </Badge>
                  <Badge variant="outline">
                    {selection?.diseases.length ?? 0} doencas notificaveis
                  </Badge>
                </div>

                <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Itens</p>
                </div>

                <div className="space-y-3">
                  {selectedPreview.length === 0 ? (
                    <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                      <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      Nenhuma regra compativel.
                    </div>
                  ) : (
                    selectedPreview.map((entry) => {
                      const presentation =
                        summarizeOfficialPackTemplatePresentation(entry);

                      return (
                        <div
                          key={entry.template.id}
                          className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-foreground">
                                {entry.template.nome}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge
                                variant={getLegalStatusBadgeVariant(
                                  entry.template.status_legal,
                                )}
                              >
                                {getLegalStatusLabel(entry.template.status_legal)}
                              </Badge>
                              <Badge variant="outline">
                                {presentation.agendaOperationalCount} agenda
                                operacional
                              </Badge>
                              {presentation.notifiableActionCount > 0 ? (
                                <Badge variant="outline">
                                  {presentation.notifiableActionCount} acao de
                                  suspeita
                                </Badge>
                              ) : null}
                              {presentation.nonAgendaCounts.map((item) => (
                                <Badge key={item.key} variant="outline">
                                  {item.count} {item.label.toLowerCase()}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {hiddenPreviewCount > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    +{hiddenPreviewCount} item(ns).
                  </p>
                ) : null}
              </div>

              <div className="space-y-3 rounded-2xl border border-border/70 bg-background/80 p-4">
                <p className="text-sm font-medium text-foreground">
                  Resumo
                </p>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      Exigências
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="destructive">
                        {legalStatusCounts.obrigatorio} obrigatorio(s)
                      </Badge>
                      {legalStatusCounts.recomendado > 0 ? (
                        <Badge variant="secondary">
                          {legalStatusCounts.recomendado} recomendado(s)
                        </Badge>
                      ) : null}
                      {legalStatusCounts.boa_pratica > 0 ? (
                        <Badge variant="outline">
                          {legalStatusCounts.boa_pratica} boa pratica
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <ClipboardList className="h-4 w-4 text-primary" />
                      Separacao operacional
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="outline">
                        {selectionPresentation.agendaOperationalCount} agenda
                        operacional
                      </Badge>
                      {selectionPresentation.notifiableActionCount > 0 ? (
                        <Badge variant="outline">
                          {selectionPresentation.notifiableActionCount} acao de
                          suspeita
                        </Badge>
                      ) : null}
                      {selectionPresentation.nonAgendaCounts.map((item) => (
                        <Badge key={item.key} variant="outline">
                          {item.count} {item.label.toLowerCase()}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {selectionPresentation.notifiableActionCount > 0 ? (
                    <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <ShieldAlert className="h-4 w-4 text-warning" />
                            Suspeita notificavel
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">
                              {selectionPresentation.notifiableActionCount} acao
                              por animal
                            </Badge>
                            <Badge variant="secondary">
                              Nao gera rotina recorrente
                            </Badge>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => navigate("/animais")}
                        >
                          Escolher animal
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
