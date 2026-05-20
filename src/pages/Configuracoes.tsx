import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Ruler } from "lucide-react";

import { FarmLifecycleSettingsPanel } from "@/components/settings/FarmLifecycleSettingsPanel";
import { SyncHealthPanel } from "@/components/settings/SyncHealthPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageIntro } from "@/components/ui/page-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/hooks/useAuth";
import {
  resolveFarmLifecycleConfig,
  withFarmLifecycleConfig,
} from "@/lib/farms/lifecycleConfig";
import type { FarmWeightUnit } from "@/lib/farms/measurementConfig";
import {
  resolveFarmMeasurementConfig,
  withFarmMeasurementConfig,
} from "@/lib/farms/measurementConfig";
import { getWeightUnitLabel } from "@/lib/format/weight";
import { supabase } from "@/lib/supabase";
import { showError, showSuccess } from "@/utils/toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const BASIS_LABEL = {
  idade: "Idade",
  peso: "Peso",
} as const;

const TRANSITION_LABEL = {
  manual: "Manual",
  hibrido: "Hibrido",
  automatico: "Automatico",
} as const;

export default function Configuracoes() {
  const { activeFarmId, role, refreshSettings, farmMeasurementConfig } =
    useAuth();
  const [farmName, setFarmName] = useState<string>("");
  const [farmMetadata, setFarmMetadata] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingLifecycle, setIsSavingLifecycle] = useState(false);
  const [isSavingMeasurement, setIsSavingMeasurement] = useState(false);
  const [pendingWeightUnit, setPendingWeightUnit] = useState<FarmWeightUnit>(
    farmMeasurementConfig.weight_unit,
  );

  const canManageFarmSettings = role === "owner" || role === "manager";

  useEffect(() => {
    const loadFarmSettings = async () => {
      if (!activeFarmId) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("fazendas")
          .select("nome, metadata")
          .eq("id", activeFarmId)
          .single();

        if (error) {
          throw error;
        }

        setFarmName(data?.nome ?? "");
        setFarmMetadata(
          data?.metadata && typeof data.metadata === "object"
            ? (data.metadata as Record<string, unknown>)
            : {},
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar configuracoes.";
        showError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadFarmSettings();
  }, [activeFarmId]);

  const lifecycleConfig = useMemo(
    () => resolveFarmLifecycleConfig(farmMetadata),
    [farmMetadata],
  );
  const measurementConfig = useMemo(
    () => resolveFarmMeasurementConfig(farmMetadata),
    [farmMetadata],
  );

  useEffect(() => {
    setPendingWeightUnit(measurementConfig.weight_unit);
  }, [measurementConfig.weight_unit]);

  const handleSaveLifecycle = async (config: typeof lifecycleConfig) => {
    if (!activeFarmId) {
      showError("Selecione uma fazenda ativa.");
      return;
    }

    setIsSavingLifecycle(true);
    try {
      const metadata = withFarmLifecycleConfig(farmMetadata, config);
      const { error } = await supabase
        .from("fazendas")
        .update({ metadata })
        .eq("id", activeFarmId);

      if (error) {
        throw error;
      }

      setFarmMetadata(metadata);
      await refreshSettings();
      showSuccess("Regras de estagio atualizadas.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nao foi possivel salvar as configuracoes.";
      showError(message);
    } finally {
      setIsSavingLifecycle(false);
    }
  };

  const handleSaveMeasurement = async () => {
    if (!activeFarmId) {
      showError("Selecione uma fazenda ativa.");
      return;
    }

    setIsSavingMeasurement(true);
    try {
      const metadata = withFarmMeasurementConfig(farmMetadata, {
        weight_unit: pendingWeightUnit,
      });
      const { error } = await supabase
        .from("fazendas")
        .update({ metadata })
        .eq("id", activeFarmId);

      if (error) {
        throw error;
      }

      setFarmMetadata(metadata);
      await refreshSettings();
      showSuccess("Unidade de peso atualizada.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nao foi possivel salvar a unidade.";
      showError(message);
    } finally {
      setIsSavingMeasurement(false);
    }
  };

  if (!activeFarmId) {
    return (
      <div className="space-y-5">
        <PageIntro
          variant="plain"
          eyebrow="Configuracoes"
          title="Sem fazenda ativa"
          actions={
            <Button asChild>
              <Link to="/select-fazenda">Escolher fazenda</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageIntro
        variant="plain"
        eyebrow="Configuracoes"
        title="Regras e parametros operacionais"
        meta={
          <>
            <StatusBadge tone="neutral">
              {farmName || "Fazenda ativa"}
            </StatusBadge>
            <StatusBadge tone={canManageFarmSettings ? "info" : "warning"}>
              {canManageFarmSettings ? "Edicao liberada" : "Somente leitura"}
            </StatusBadge>
            <StatusBadge tone="neutral">
              Base: {BASIS_LABEL[lifecycleConfig.stage_classification_basis]}
            </StatusBadge>
            <StatusBadge tone="neutral">
              Modo: {TRANSITION_LABEL[lifecycleConfig.default_transition_mode]}
            </StatusBadge>
            <StatusBadge tone="neutral">
              Desmame: {lifecycleConfig.weaning_days}d
            </StatusBadge>
          </>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/editar-fazenda">Editar cadastro da fazenda</Link>
            </Button>
            <Button asChild>
              <Link to="/animais/transicoes">
                Abrir fila de estagios
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </>
        }
      />

      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Leitura e metragens operacionais
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4">
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="flex items-start gap-3">
                <Ruler className="mt-0.5 h-5 w-5 text-primary" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Unidade de peso da fazenda
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,220px)_auto] sm:items-end">
                <div className="space-y-2">
                  <StatusBadge tone="neutral">
                    Atual: {getWeightUnitLabel(measurementConfig.weight_unit)}
                  </StatusBadge>
                  <Select
                    value={pendingWeightUnit}
                    onValueChange={(value) =>
                      setPendingWeightUnit(value as FarmWeightUnit)
                    }
                    disabled={!canManageFarmSettings || isSavingMeasurement}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kg">Quilograma (kg)</SelectItem>
                      <SelectItem value="arroba">Arroba</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  onClick={handleSaveMeasurement}
                  disabled={
                    !canManageFarmSettings ||
                    isSavingMeasurement ||
                    pendingWeightUnit === measurementConfig.weight_unit
                  }
                >
                  {isSavingMeasurement ? "Salvando..." : "Salvar unidade"}
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-background/80 p-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Categorias zootecnicas
              </p>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                <p className="text-xs uppercase text-muted-foreground">
                  Femeas
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  Bezerra, novilha e vaca
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                <p className="text-xs uppercase text-muted-foreground">
                  Machos
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  Bezerro, garrote, boi e touro
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <FarmLifecycleSettingsPanel
        canManage={canManageFarmSettings}
        config={lifecycleConfig}
        weightUnit={measurementConfig.weight_unit}
        isSaving={isSavingLifecycle}
        onSave={handleSaveLifecycle}
      />

      <SyncHealthPanel />

      <section className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button variant="outline" asChild>
            <Link to="/dashboard">Dashboard</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/protocolos-sanitarios">Protocolos sanitarios</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/reconciliacao">Reconciliacao</Link>
          </Button>
      </section>

      {isLoading ? (
        <Card className="shadow-none">
          <CardContent className="py-10 text-sm text-muted-foreground">
            Carregando configuracoes da fazenda.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

