import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/ui/status-badge";
import type { FarmLifecycleConfig } from "@/lib/farms/lifecycleConfig";
import type { FarmWeightUnit } from "@/lib/farms/measurementConfig";
import {
  formatWeightInput,
  getWeightInputStep,
  getWeightUnitLabel,
  parseWeightInput,
} from "@/lib/format/weight";

interface FarmLifecycleSettingsPanelProps {
  canManage: boolean;
  config: FarmLifecycleConfig;
  weightUnit: FarmWeightUnit;
  isSaving?: boolean;
  onSave: (config: FarmLifecycleConfig) => Promise<void> | void;
}

type LifecycleFormState = {
  neonatalDays: string;
  weaningDays: string;
  weaningWeightKg: string;
  maleBreedingCandidateDays: string;
  maleBreedingCandidateWeightKg: string;
  maleAdultDays: string;
  maleAdultWeightKg: string;
  femaleAdultDays: string;
  femaleAdultWeightKg: string;
  defaultTransitionMode: FarmLifecycleConfig["default_transition_mode"];
  stageClassificationBasis: FarmLifecycleConfig["stage_classification_basis"];
  hybridAutoApplyAgeStages: boolean;
};

function toFormState(
  config: FarmLifecycleConfig,
  weightUnit: FarmWeightUnit,
): LifecycleFormState {
  return {
    neonatalDays: String(config.neonatal_days),
    weaningDays: String(config.weaning_days),
    weaningWeightKg: formatWeightInput(config.weaning_weight_kg, weightUnit),
    maleBreedingCandidateDays: String(config.male_breeding_candidate_days),
    maleBreedingCandidateWeightKg: formatWeightInput(
      config.male_breeding_candidate_weight_kg,
      weightUnit,
    ),
    maleAdultDays: String(config.male_adult_days),
    maleAdultWeightKg: formatWeightInput(config.male_adult_weight_kg, weightUnit),
    femaleAdultDays: String(config.female_adult_days),
    femaleAdultWeightKg: formatWeightInput(
      config.female_adult_weight_kg,
      weightUnit,
    ),
    defaultTransitionMode: config.default_transition_mode,
    stageClassificationBasis: config.stage_classification_basis,
    hybridAutoApplyAgeStages: config.hybrid_auto_apply_age_stages,
  };
}

function parsePositiveInteger(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePositiveWeight(
  value: string,
  weightUnit: FarmWeightUnit,
  fallback: number,
) {
  const parsed = parseWeightInput(value, weightUnit);
  return parsed !== null ? Math.round(parsed) : fallback;
}

const TRANSITION_MODE_LABEL: Record<
  FarmLifecycleConfig["default_transition_mode"],
  string
> = {
  manual: "Manual",
  hibrido: "Hibrido",
  automatico: "Automatico",
};

const CLASSIFICATION_LABEL: Record<
  FarmLifecycleConfig["stage_classification_basis"],
  string
> = {
  idade: "Idade",
  peso: "Peso",
};

export function FarmLifecycleSettingsPanel({
  canManage,
  config,
  weightUnit,
  isSaving = false,
  onSave,
}: FarmLifecycleSettingsPanelProps) {
  const [form, setForm] = useState<LifecycleFormState>(() =>
    toFormState(config, weightUnit),
  );

  useEffect(() => {
    setForm(toFormState(config, weightUnit));
  }, [config, weightUnit]);

  const handleSave = async () => {
    await onSave({
      neonatal_days: parsePositiveInteger(form.neonatalDays, config.neonatal_days),
      weaning_days: parsePositiveInteger(form.weaningDays, config.weaning_days),
      weaning_weight_kg: parsePositiveWeight(
        form.weaningWeightKg,
        weightUnit,
        config.weaning_weight_kg,
      ),
      male_breeding_candidate_days: parsePositiveInteger(
        form.maleBreedingCandidateDays,
        config.male_breeding_candidate_days,
      ),
      male_breeding_candidate_weight_kg: parsePositiveWeight(
        form.maleBreedingCandidateWeightKg,
        weightUnit,
        config.male_breeding_candidate_weight_kg,
      ),
      male_adult_days: parsePositiveInteger(
        form.maleAdultDays,
        config.male_adult_days,
      ),
      male_adult_weight_kg: parsePositiveWeight(
        form.maleAdultWeightKg,
        weightUnit,
        config.male_adult_weight_kg,
      ),
      female_adult_days: parsePositiveInteger(
        form.femaleAdultDays,
        config.female_adult_days,
      ),
      female_adult_weight_kg: parsePositiveWeight(
        form.femaleAdultWeightKg,
        weightUnit,
        config.female_adult_weight_kg,
      ),
      default_transition_mode: form.defaultTransitionMode,
      stage_classification_basis: form.stageClassificationBasis,
      hybrid_auto_apply_age_stages: form.hybridAutoApplyAgeStages,
    });
  };

  const setNumericField =
    (field: keyof Pick<
      LifecycleFormState,
      | "neonatalDays"
      | "weaningDays"
      | "weaningWeightKg"
      | "maleBreedingCandidateDays"
      | "maleBreedingCandidateWeightKg"
      | "maleAdultDays"
      | "maleAdultWeightKg"
      | "femaleAdultDays"
      | "femaleAdultWeightKg"
    >) =>
    (value: string) => {
      setForm((current) => ({ ...current, [field]: value }));
    };

  return (
    <FormSection
      title="Regras de estagio de vida"
      description="Concentre aqui os marcos que alimentam classificacao, sugestao e aplicacao de transicoes no rebanho."
      actions={
        <>
          <StatusBadge tone="neutral">
            Base {CLASSIFICATION_LABEL[form.stageClassificationBasis]}
          </StatusBadge>
          <StatusBadge tone="info">
            Modo {TRANSITION_MODE_LABEL[form.defaultTransitionMode]}
          </StatusBadge>
          <StatusBadge tone="neutral">Peso em {getWeightUnitLabel(weightUnit)}</StatusBadge>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 xl:grid-cols-[1.05fr_1.35fr]">
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Politica de transicao
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                Define qual criterio domina a classificacao e quando marcos por
                idade podem ser aplicados automaticamente.
              </p>
            </div>

            <div className="mt-4 grid gap-4">
              <div className="space-y-2">
                <Label>Base principal</Label>
                <Select
                  value={form.stageClassificationBasis}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      stageClassificationBasis:
                        value as FarmLifecycleConfig["stage_classification_basis"],
                    }))
                  }
                  disabled={!canManage || isSaving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="idade">Idade</SelectItem>
                    <SelectItem value="peso">Peso</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Modo padrao</Label>
                <Select
                  value={form.defaultTransitionMode}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      defaultTransitionMode:
                        value as FarmLifecycleConfig["default_transition_mode"],
                    }))
                  }
                  disabled={!canManage || isSaving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="hibrido">Hibrido</SelectItem>
                    <SelectItem value="automatico">Automatico</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Autoaplicar marcos por idade no modo hibrido
                    </p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Mantem decisoes estrategicas sob confirmacao manual e
                      libera apenas transicoes biologicas previsiveis.
                    </p>
                  </div>
                  <Switch
                    checked={form.hybridAutoApplyAgeStages}
                    onCheckedChange={(checked) =>
                      setForm((current) => ({
                        ...current,
                        hybridAutoApplyAgeStages: checked,
                      }))
                    }
                    disabled={!canManage || isSaving}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <div className="mb-4 space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Marcos iniciais
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Ajusta janela neonatal e alvo de desmame.
                </p>
              </div>
              <div className="grid gap-3">
                <div className="space-y-2">
                  <Label htmlFor="neonatal-days">Faixa neonatal (dias)</Label>
                  <Input
                    id="neonatal-days"
                    type="number"
                    min="1"
                    value={form.neonatalDays}
                    onChange={(event) => setNumericField("neonatalDays")(event.target.value)}
                    disabled={!canManage || isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weaning-days">Meta de desmame (dias)</Label>
                  <Input
                    id="weaning-days"
                    type="number"
                    min="1"
                    value={form.weaningDays}
                    onChange={(event) => setNumericField("weaningDays")(event.target.value)}
                    disabled={!canManage || isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weaning-weight">
                    Meta de desmame ({getWeightUnitLabel(weightUnit)})
                  </Label>
                  <Input
                    id="weaning-weight"
                    type="number"
                    min="1"
                    step={getWeightInputStep(weightUnit)}
                    value={form.weaningWeightKg}
                    onChange={(event) =>
                      setNumericField("weaningWeightKg")(event.target.value)
                    }
                    disabled={!canManage || isSaving}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <div className="mb-4 space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Machos reprodutivos
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Separa candidato e adulto para entrada em cobertura.
                </p>
              </div>
              <div className="grid gap-3">
                <div className="space-y-2">
                  <Label htmlFor="male-candidate-days">Macho candidato (dias)</Label>
                  <Input
                    id="male-candidate-days"
                    type="number"
                    min="1"
                    value={form.maleBreedingCandidateDays}
                    onChange={(event) =>
                      setNumericField("maleBreedingCandidateDays")(event.target.value)
                    }
                    disabled={!canManage || isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="male-candidate-weight">
                    Macho candidato ({getWeightUnitLabel(weightUnit)})
                  </Label>
                  <Input
                    id="male-candidate-weight"
                    type="number"
                    min="1"
                    step={getWeightInputStep(weightUnit)}
                    value={form.maleBreedingCandidateWeightKg}
                    onChange={(event) =>
                      setNumericField("maleBreedingCandidateWeightKg")(event.target.value)
                    }
                    disabled={!canManage || isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="male-adult-days">Macho adulto (dias)</Label>
                  <Input
                    id="male-adult-days"
                    type="number"
                    min="1"
                    value={form.maleAdultDays}
                    onChange={(event) => setNumericField("maleAdultDays")(event.target.value)}
                    disabled={!canManage || isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="male-adult-weight">
                    Macho adulto ({getWeightUnitLabel(weightUnit)})
                  </Label>
                  <Input
                    id="male-adult-weight"
                    type="number"
                    min="1"
                    step={getWeightInputStep(weightUnit)}
                    value={form.maleAdultWeightKg}
                    onChange={(event) =>
                      setNumericField("maleAdultWeightKg")(event.target.value)
                    }
                    disabled={!canManage || isSaving}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/80 p-4 md:col-span-2">
              <div className="mb-4 space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Adulto feminino
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Marco usado para diferenciar femeas jovens de matrizes aptas.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="female-adult-days">Femea adulta (dias)</Label>
                  <Input
                    id="female-adult-days"
                    type="number"
                    min="1"
                    value={form.femaleAdultDays}
                    onChange={(event) =>
                      setNumericField("femaleAdultDays")(event.target.value)
                    }
                    disabled={!canManage || isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="female-adult-weight">
                    Femea adulta ({getWeightUnitLabel(weightUnit)})
                  </Label>
                  <Input
                    id="female-adult-weight"
                    type="number"
                    min="1"
                    step={getWeightInputStep(weightUnit)}
                    value={form.femaleAdultWeightKg}
                    onChange={(event) =>
                      setNumericField("femaleAdultWeightKg")(event.target.value)
                    }
                    disabled={!canManage || isSaving}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Essas regras afetam classificacao, fila de transicoes e leituras em
            `Animais`, `Agenda`, `Reproducao` e detalhes individuais.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              type="button"
              onClick={() => setForm(toFormState(config, weightUnit))}
              disabled={isSaving}
            >
              Reverter
            </Button>
            <Button type="button" onClick={handleSave} disabled={!canManage || isSaving}>
              {isSaving ? "Salvando..." : "Salvar regras"}
            </Button>
          </div>
        </div>
      </div>
    </FormSection>
  );
}
