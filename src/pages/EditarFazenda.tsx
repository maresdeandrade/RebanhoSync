import { useEffect, useState } from "react";
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
import {
  resolveFarmExperienceMode,
  withFarmExperienceMode,
} from "@/lib/farms/experienceMode";
import { supabase } from "@/lib/supabase";

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
  const { activeFarmId, role, loading: authLoading, refreshSettings } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<FarmFormState>(EMPTY_FORM);
  const [farmMetadata, setFarmMetadata] = useState<Record<string, unknown>>({});
  const [essentialModeEnabled, setEssentialModeEnabled] = useState(true);
  const [strictRulesEnabled, setStrictRulesEnabled] = useState(true);
  const [strictAntiTeleportEnabled, setStrictAntiTeleportEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManageRolloutFlags = role === "owner";
  const canEditFarm = role === "owner" || role === "manager";

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
            "nome, codigo, municipio, estado, cep, area_total_ha, tipo_producao, sistema_manejo, metadata",
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
        setEssentialModeEnabled(
          resolveFarmExperienceMode(metadata) === "essencial",
        );
        setStrictRulesEnabled(rollout.strict_rules_enabled);
        setStrictAntiTeleportEnabled(rollout.strict_anti_teleporte);
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
      setError("Nome da fazenda e obrigatorio.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const rolloutMetadata = withEventosRolloutFlags(farmMetadata, {
        strict_rules_enabled: strictRulesEnabled,
        strict_anti_teleporte: strictRulesEnabled && strictAntiTeleportEnabled,
      });
      const updatedMetadata = withFarmExperienceMode(
        rolloutMetadata,
        essentialModeEnabled ? "essencial" : "completo",
      );

      const { error: updateError } = await supabase
        .from("fazendas")
        .update({
          nome: form.nome.trim(),
          codigo: form.codigo.trim() || null,
          municipio: form.municipio.trim() || null,
          estado: form.estado || null,
          cep: form.cep.trim() || null,
          area_total_ha: form.areaTotalHa ? Number.parseFloat(form.areaTotalHa) : null,
          tipo_producao: form.tipoProducao || null,
          sistema_manejo: form.sistemaManejo || null,
          metadata: updatedMetadata,
        })
        .eq("id", activeFarmId);

      if (updateError) {
        throw updateError;
      }

      setFarmMetadata(updatedMetadata);
      await refreshSettings();
      navigate("/home");
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Nao foi possivel salvar a fazenda.";
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
    <div className="space-y-6">
      <PageIntro
        eyebrow="Cadastro da fazenda"
        title="Editar dados estruturais"
        description="Tela focada no cadastro-base da fazenda. Regras de classificacao e transicao do rebanho ficam em Configuracoes para nao misturar operacao com identidade cadastral."
        meta={
          <>
            <StatusBadge tone="neutral">
              {essentialModeEnabled ? "Modo essencial" : "Modo completo"}
            </StatusBadge>
            <StatusBadge tone={canManageRolloutFlags ? "info" : "neutral"}>
              {canManageRolloutFlags ? "Rollout editavel" : "Rollout somente owner"}
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

      <form id="farm-profile-form" className="space-y-6" onSubmit={handleSubmit}>
        <FormSection
          title="Identificacao e localizacao"
          description="Dados que identificam a fazenda e alimentam cabecalhos, onboarding e exportacoes."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="farm-name">Nome da fazenda</Label>
              <Input
                id="farm-name"
                value={form.nome}
                onChange={(event) => updateField("nome", event.target.value)}
                placeholder="Ex.: Fazenda Santa Clara"
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="farm-code">Codigo interno</Label>
              <Input
                id="farm-code"
                value={form.codigo}
                onChange={(event) => updateField("codigo", event.target.value)}
                placeholder="Ex.: FSC-001"
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="farm-cep">CEP</Label>
              <Input
                id="farm-cep"
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
              <Label htmlFor="farm-city">Municipio</Label>
              <Input
                id="farm-city"
                value={form.municipio}
                onChange={(event) => updateField("municipio", event.target.value)}
                placeholder="Cidade"
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={form.estado || "none"}
                onValueChange={(value) =>
                  updateField("estado", value === "none" ? "" : value)
                }
                disabled={isSaving}
              >
                <SelectTrigger>
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

        <FormSection
          title="Perfil produtivo"
          description="Parametros de producao usados para contexto, filtros e relatorios administrativos."
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="farm-area">Area total (ha)</Label>
              <Input
                id="farm-area"
                type="number"
                min="0"
                step="0.01"
                value={form.areaTotalHa}
                onChange={(event) => updateField("areaTotalHa", event.target.value)}
                placeholder="150.50"
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de producao</Label>
              <Select
                value={form.tipoProducao || "none"}
                onValueChange={(value) =>
                  updateField(
                    "tipoProducao",
                    value === "none"
                      ? ""
                      : (value as FarmFormState["tipoProducao"]),
                  )
                }
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nao informado</SelectItem>
                  <SelectItem value="corte">Corte</SelectItem>
                  <SelectItem value="leite">Leite</SelectItem>
                  <SelectItem value="mista">Mista</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Sistema de manejo</Label>
              <Select
                value={form.sistemaManejo || "none"}
                onValueChange={(value) =>
                  updateField(
                    "sistemaManejo",
                    value === "none"
                      ? ""
                      : (value as FarmFormState["sistemaManejo"]),
                  )
                }
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nao informado</SelectItem>
                  <SelectItem value="confinamento">Confinamento</SelectItem>
                  <SelectItem value="semi_confinamento">Semi-confinamento</SelectItem>
                  <SelectItem value="pastagem">Pastagem</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Experiencia do aplicativo"
          description="Ajusta a densidade da navegacao e o quanto de modulos estruturais ficam disponiveis no dia a dia."
          actions={
            <StatusBadge tone={essentialModeEnabled ? "info" : "neutral"}>
              {essentialModeEnabled ? "Fluxo enxuto" : "Fluxo completo"}
            </StatusBadge>
          }
        >
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Modo essencial</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  Foca em hoje, agenda, registrar, animais, financeiro basico e
                  resumo operacional.
                </p>
              </div>
              <Switch
                checked={essentialModeEnabled}
                onCheckedChange={setEssentialModeEnabled}
                disabled={isSaving}
              />
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Governanca de eventos"
          description="Flags de rollout da fazenda para regras estritas do pipeline offline-first."
          actions={
            <StatusBadge tone={canManageRolloutFlags ? "info" : "neutral"}>
              {canManageRolloutFlags ? "Owner pode ajustar" : "Somente leitura"}
            </StatusBadge>
          }
        >
          <div className="grid gap-4">
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Regras estritas</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Liga validacoes mais rigidas da unificacao de eventos.
                  </p>
                </div>
                <Switch
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

            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Anti-teleporte estrito</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Exige movimentacao registrada no mesmo gesto para atualizar
                    lote ou pasto.
                  </p>
                </div>
                <Switch
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

        <Card className="shadow-none">
          <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Regras de estagio migradas
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                A classificacao e as transicoes do rebanho agora ficam apenas em
                `Configuracoes`, separando cadastro da fazenda de politica
                operacional.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link to="/configuracoes">Abrir configuracoes</Link>
            </Button>
          </CardContent>
        </Card>

        {error ? (
          <Card className="border-destructive/30 shadow-none">
            <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : null}
      </form>
    </div>
  );
}
