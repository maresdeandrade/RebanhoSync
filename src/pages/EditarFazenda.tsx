import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormSection } from "@/components/ui/form-section";
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
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import {
  resolveEventosRolloutFlags,
  withEventosRolloutFlags,
} from "@/lib/events/featureFlags";
import { cn } from "@/lib/utils";
import {
  resolveFarmExperienceMode,
  withFarmExperienceMode,
} from "@/lib/farms/experienceMode";
import { supabase } from "@/lib/supabase";
import { updateFarmFromSnapshot, type FarmWriteSnapshot } from "@/lib/farms/updateFarm";
import { authOperationError } from "@/lib/auth/errorMessage";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { UnsavedChangesDialog } from "@/components/forms/UnsavedChangesDialog";

type FarmFormState = {
  nome: string;
  codigo: string;
  municipio: string;
  estado: string;
  cep: string;
  areaTotalHa: string;
  tipoProducao: "" | "corte" | "leite" | "mista";
  sistemaManejo: "" | "confinamento" | "semi_confinamento" | "pastagem";
};

const EMPTY_FORM: FarmFormState = {
  nome: "",
  codigo: "",
  municipio: "",
  estado: "",
  cep: "",
  areaTotalHa: "",
  tipoProducao: "",
  sistemaManejo: "",
};

const ESTADOS = [
  ["AC", "Acre (AC)"],
  ["AL", "Alagoas (AL)"],
  ["AP", "Amapa (AP)"],
  ["AM", "Amazonas (AM)"],
  ["BA", "Bahia (BA)"],
  ["CE", "Ceara (CE)"],
  ["DF", "Distrito Federal (DF)"],
  ["ES", "Espirito Santo (ES)"],
  ["GO", "Goias (GO)"],
  ["MA", "Maranhao (MA)"],
  ["MT", "Mato Grosso (MT)"],
  ["MS", "Mato Grosso do Sul (MS)"],
  ["MG", "Minas Gerais (MG)"],
  ["PA", "Para (PA)"],
  ["PB", "Paraiba (PB)"],
  ["PR", "Parana (PR)"],
  ["PE", "Pernambuco (PE)"],
  ["PI", "Piaui (PI)"],
  ["RJ", "Rio de Janeiro (RJ)"],
  ["RN", "Rio Grande do Norte (RN)"],
  ["RS", "Rio Grande do Sul (RS)"],
  ["RO", "Rondonia (RO)"],
  ["RR", "Roraima (RR)"],
  ["SC", "Santa Catarina (SC)"],
  ["SP", "Sao Paulo (SP)"],
  ["SE", "Sergipe (SE)"],
  ["TO", "Tocantins (TO)"],
] as const;

export default function EditarFazenda() {
  const {
    activeFarmId,
    role,
    loading: authLoading,
    refreshSettings,
  } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<FarmFormState>(EMPTY_FORM);
  const [farmMetadata, setFarmMetadata] = useState<Record<string, unknown>>({});
  const [farmSnapshot, setFarmSnapshot] = useState<FarmWriteSnapshot | null>(null);
  const [essentialModeEnabled, setEssentialModeEnabled] = useState(true);
  const [strictRulesEnabled, setStrictRulesEnabled] = useState(true);
  const [strictAntiTeleportEnabled, setStrictAntiTeleportEnabled] =
    useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const baseline = useRef<{
    farmId: string;
    form: FarmFormState;
    essentialModeEnabled: boolean;
    strictRulesEnabled: boolean;
    strictAntiTeleportEnabled: boolean;
  } | null>(null);

  const canManageRolloutFlags = role === "owner";
  const canEditFarm = role === "owner" || role === "manager";
  const isDirty = Boolean(
    baseline.current &&
      JSON.stringify(baseline.current) !==
        JSON.stringify({
          farmId: activeFarmId,
          form,
          essentialModeEnabled,
          strictRulesEnabled,
          strictAntiTeleportEnabled,
        }),
  );
  const blocker = useUnsavedChangesGuard({ isDirty, isSaving });

  useEffect(() => {
    const loadFarm = async () => {
      if (authLoading) return;

      if (!activeFarmId) {
        navigate("/select-fazenda");
        return;
      }

      if (!canEditFarm) {
        setError("Voce nao tem permissao para editar esta fazenda.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const { data, error: fetchError } = await supabase
          .from("fazendas")
          .select(
            "nome, codigo, municipio, estado, cep, area_total_ha, tipo_producao, sistema_manejo, metadata, updated_at",
          )
          .eq("id", activeFarmId)
          .single();

        if (fetchError) {
          throw fetchError;
        }

        const metadata =
          data?.metadata && typeof data.metadata === "object"
            ? (data.metadata as Record<string, unknown>)
            : {};
        const rollout = resolveEventosRolloutFlags(metadata);

        setForm({
          nome: data?.nome ?? "",
          codigo: data?.codigo ?? "",
          municipio: data?.municipio ?? "",
          estado: data?.estado ?? "",
          cep: data?.cep ?? "",
          areaTotalHa: data?.area_total_ha ? String(data.area_total_ha) : "",
          tipoProducao:
            data?.tipo_producao === "corte" ||
            data?.tipo_producao === "leite" ||
            data?.tipo_producao === "mista"
              ? data.tipo_producao
              : "",
          sistemaManejo:
            data?.sistema_manejo === "confinamento" ||
            data?.sistema_manejo === "semi_confinamento" ||
            data?.sistema_manejo === "pastagem"
              ? data.sistema_manejo
              : "",
        });
        setFarmMetadata(metadata);
        setFarmSnapshot({farmId: activeFarmId, updatedAt: data?.updated_at});
        setEssentialModeEnabled(
          resolveFarmExperienceMode(metadata) === "essencial",
        );
        setStrictRulesEnabled(rollout.strict_rules_enabled);
        setStrictAntiTeleportEnabled(rollout.strict_anti_teleporte);
        baseline.current = {
          farmId: activeFarmId,
          form: {
            nome: data?.nome ?? "",
            codigo: data?.codigo ?? "",
            municipio: data?.municipio ?? "",
            estado: data?.estado ?? "",
            cep: data?.cep ?? "",
            areaTotalHa: data?.area_total_ha ? String(data.area_total_ha) : "",
            tipoProducao:
              data?.tipo_producao === "corte" ||
              data?.tipo_producao === "leite" ||
              data?.tipo_producao === "mista"
                ? data.tipo_producao
                : "",
            sistemaManejo:
              data?.sistema_manejo === "confinamento" ||
              data?.sistema_manejo === "semi_confinamento" ||
              data?.sistema_manejo === "pastagem"
                ? data.sistema_manejo
                : "",
          },
          essentialModeEnabled: resolveFarmExperienceMode(metadata) === "essencial",
          strictRulesEnabled: rollout.strict_rules_enabled,
          strictAntiTeleportEnabled: rollout.strict_anti_teleporte,
        };
      } catch (loadError) {
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Nao foi possivel carregar a fazenda.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadFarm();
  }, [activeFarmId, authLoading, canEditFarm, navigate]);

  function updateField<K extends keyof FarmFormState>(
    field: K,
    value: FarmFormState[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeFarmId) return;
    if (!form.nome.trim()) {
      const message = "Nome da fazenda é obrigatório.";
      setNameError(message);
      nameInputRef.current?.focus();
      return;
    }

    setNameError(null);
    setIsSaving(true);
    setError(null);

    try {
      const rolloutMetadata = canManageRolloutFlags ? withEventosRolloutFlags(farmMetadata, {
        strict_rules_enabled: strictRulesEnabled,
        strict_anti_teleporte: strictRulesEnabled && strictAntiTeleportEnabled,
      }) : farmMetadata;
      const updatedMetadata = withFarmExperienceMode(
        rolloutMetadata,
        essentialModeEnabled ? "essencial" : "completo",
      );

      const saved = await updateFarmFromSnapshot(activeFarmId, farmSnapshot, {
          nome: form.nome.trim(),
          codigo: form.codigo.trim() || null,
          municipio: form.municipio.trim() || null,
          estado: form.estado || null,
          cep: form.cep.trim() || null,
          area_total_ha: form.areaTotalHa
            ? Number.parseFloat(form.areaTotalHa)
            : null,
          tipo_producao: form.tipoProducao || null,
          sistema_manejo: form.sistemaManejo || null,
          metadata: updatedMetadata,
        });

      setFarmMetadata(updatedMetadata);
      setFarmSnapshot({farmId: activeFarmId, updatedAt: saved.updated_at});
      await refreshSettings();
      baseline.current = {
        farmId: activeFarmId,
        form,
        essentialModeEnabled,
        strictRulesEnabled,
        strictAntiTeleportEnabled,
      };
      blocker.allowNextNavigationTo("/home");
      navigate("/home");
    } catch (submitError) {
      const message = authOperationError(submitError, "Nao foi possivel salvar a fazenda.");
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="shadow-none">
        <CardContent className="py-10 text-sm text-muted-foreground">
          Carregando dados cadastrais da fazenda.
        </CardContent>
      </Card>
    );
  }

  if (error && !canEditFarm) {
    return (
      <Card className="shadow-none">
        <CardContent className="space-y-4 py-8">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" asChild>
            <Link to="/home">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <PageIntro
        variant="plain"
        eyebrow="Cadastro da fazenda"
        title="Editar dados estruturais"
        description="Estas alterações pertencem à fazenda ativa. Confira o nome e o papel vigente antes de salvar; não são preferências pessoais."
        meta={
          <>
            <StatusBadge tone="neutral">Fazenda ativa</StatusBadge>
            <StatusBadge tone="neutral">
              Papel: {role === "owner" ? "Proprietário" : role === "manager" ? "Gerente" : "não carregado"}
            </StatusBadge>
            <StatusBadge tone="neutral">
              {essentialModeEnabled ? "Modo essencial" : "Modo completo"}
            </StatusBadge>
            <StatusBadge tone={canManageRolloutFlags ? "info" : "neutral"}>
              {canManageRolloutFlags
                ? "Proprietário pode ajustar rollout"
                : "Rollout: somente leitura"}
            </StatusBadge>
          </>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/configuracoes">Abrir configuracoes</Link>
            </Button>
            <Button type="submit" form="farm-profile-form" disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Salvando..." : "Salvar fazenda"}
            </Button>
          </>
        }
      />

      <form
        id="farm-profile-form"
        className="space-y-5"
        onSubmit={handleSubmit}
      >
        <FormSection title="Dados da fazenda">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="farm-name">Nome da fazenda (obrigatório)</Label>
              <Input
                id="farm-name"
                ref={nameInputRef}
                className="h-12 rounded-xl bg-background"
                value={form.nome}
                onChange={(event) => {
                  updateField("nome", event.target.value);
                  if (nameError) setNameError(null);
                }}
                placeholder="Ex.: Fazenda Santa Clara"
                disabled={isSaving}
                aria-required="true"
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? "farm-name-error" : undefined}
              />
              {nameError ? <p id="farm-name-error" role="alert" className="text-sm text-destructive">{nameError}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="farm-code">Codigo interno (opcional)</Label>
              <Input
                id="farm-code"
                className="h-12 rounded-xl bg-background"
                value={form.codigo}
                onChange={(event) => updateField("codigo", event.target.value)}
                placeholder="Ex.: FSC-001"
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="farm-cep">CEP (opcional)</Label>
              <Input
                id="farm-cep"
                className="h-12 rounded-xl bg-background"
                value={form.cep}
                onChange={(event) => {
                  let value = event.target.value.replace(/\D/g, "");
                  if (value.length > 5) {
                    value = `${value.slice(0, 5)}-${value.slice(5, 8)}`;
                  }
                  updateField("cep", value);
                }}
                placeholder="12345-678"
                maxLength={9}
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="farm-city">Municipio (opcional)</Label>
              <Input
                id="farm-city"
                className="h-12 rounded-xl bg-background"
                value={form.municipio}
                onChange={(event) =>
                  updateField("municipio", event.target.value)
                }
                placeholder="Cidade"
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label>Estado (opcional)</Label>
              <Select
                value={form.estado || "none"}
                onValueChange={(value) =>
                  updateField("estado", value === "none" ? "" : value)
                }
                disabled={isSaving}
              >
                <SelectTrigger className="h-12 rounded-xl bg-background">
                  <SelectValue placeholder="Selecione o estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nao informado</SelectItem>
                  {ESTADOS.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </FormSection>

        <FormSection title="Perfil produtivo">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="farm-area">Area total (ha, opcional)</Label>
              <Input
                id="farm-area"
                type="number"
                min="0"
                step="0.01"
                className="h-12 rounded-xl bg-background"
                value={form.areaTotalHa}
                onChange={(event) =>
                  updateField("areaTotalHa", event.target.value)
                }
                placeholder="150.50"
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de producao (opcional)</Label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: "", label: "N/I" },
                  { value: "corte", label: "Corte" },
                  { value: "leite", label: "Leite" },
                  { value: "mista", label: "Mista" },
                ].map((opt) => {
                  const isSelected = (form.tipoProducao || "") === opt.value;
                  return (
                    <Button
                      key={opt.value}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      disabled={isSaving}
                      onClick={() => updateField("tipoProducao", opt.value as FarmFormState["tipoProducao"])}
                      className={cn(
                        "h-12 rounded-xl transition-all border-2 bg-background text-xs px-1",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground font-semibold shadow-sm"
                          : "border-primary/20 hover:border-primary/50 text-foreground"
                      )}
                    >
                      {opt.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Sistema de manejo (opcional)</Label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { value: "", label: "N/I" },
                  { value: "pastagem", label: "Pastagem" },
                  { value: "semi_confinamento", label: "Semi-conf." },
                  { value: "confinamento", label: "Confinam." },
                ].map((opt) => {
                  const isSelected = (form.sistemaManejo || "") === opt.value;
                  return (
                    <Button
                      key={opt.value}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      disabled={isSaving}
                      onClick={() => updateField("sistemaManejo", opt.value as FarmFormState["sistemaManejo"])}
                      className={cn(
                        "h-12 rounded-xl transition-all border-2 bg-background text-xs px-1",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground font-semibold shadow-sm"
                          : "border-primary/20 hover:border-primary/50 text-foreground"
                      )}
                    >
                      {opt.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Modo de uso"
          actions={
            <StatusBadge tone={essentialModeEnabled ? "info" : "neutral"}>
              {essentialModeEnabled ? "Fluxo enxuto" : "Fluxo completo"}
            </StatusBadge>
          }
        >
          <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <Label htmlFor="farm-essential-mode" className="text-sm font-medium">
                  Modo essencial
                </Label>
                <p className="text-sm text-muted-foreground">Organiza o nível de detalhe e as áreas exibidas na navegação; não altera o papel nem substitui as permissões do sistema.</p>
              </div>
              <Switch
                id="farm-essential-mode"
                checked={essentialModeEnabled}
                onCheckedChange={setEssentialModeEnabled}
                disabled={isSaving}
              />
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Seguranca dos registros"
          actions={
            <StatusBadge tone={canManageRolloutFlags ? "info" : "neutral"}>
              {canManageRolloutFlags ? "Proprietário pode ajustar" : "Somente leitura"}
            </StatusBadge>
          }
        >
          <div className="grid gap-4">
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <Label htmlFor="farm-strict-rules" className="text-sm font-medium">
                    Validacao forte
                  </Label>
                </div>
                <Switch
                  id="farm-strict-rules"
                  checked={strictRulesEnabled}
                  onCheckedChange={(checked) => {
                    setStrictRulesEnabled(checked);
                    if (!checked) {
                      setStrictAntiTeleportEnabled(false);
                    }
                  }}
                  disabled={isSaving || !canManageRolloutFlags}
                />
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-background/80 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <Label htmlFor="farm-strict-anti-teleport" className="text-sm font-medium">
                    Movimentacao consistente
                  </Label>
                </div>
                <Switch
                  id="farm-strict-anti-teleport"
                  checked={strictRulesEnabled && strictAntiTeleportEnabled}
                  onCheckedChange={setStrictAntiTeleportEnabled}
                  disabled={
                    isSaving || !canManageRolloutFlags || !strictRulesEnabled
                  }
                />
              </div>
            </div>
          </div>
        </FormSection>

        {error ? (
          <Card className="border-destructive/30 shadow-none">
            <CardContent className="py-4 text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        ) : null}
      </form>
      <UnsavedChangesDialog
        blocker={blocker}
        description="Os dados da fazenda ainda têm alterações não salvas. Se sair agora, esse preenchimento será perdido."
      />
    </div>
  );
}
