import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import {
  resolveEventosRolloutFlags,
  withEventosRolloutFlags,
} from "@/lib/events/featureFlags";
import {
  resolveFarmExperienceMode,
  withFarmExperienceMode,
} from "@/lib/farms/experienceMode";

type EditarFazendaForm = {
  nome: string;
  codigo?: string;
  municipio?: string;
  estado?: string;
  cep?: string;
  area_total_ha?: number;
  tipo_producao?: "corte" | "leite" | "mista";
  sistema_manejo?: "confinamento" | "semi_confinamento" | "pastagem";
};

const EditarFazenda = () => {
  const { activeFarmId, role, loading: authLoading, refreshSettings } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [farmMetadata, setFarmMetadata] = useState<Record<string, unknown>>({});
  const [essentialModeEnabled, setEssentialModeEnabled] = useState(true);
  const [strictRulesEnabled, setStrictRulesEnabled] = useState(true);
  const [strictAntiTeleportEnabled, setStrictAntiTeleportEnabled] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<EditarFazendaForm>();
  const canManageRolloutFlags = role === "owner";

  // ✅ Verificar permissão e carregar dados
  useEffect(() => {
    const loadFazenda = async () => {
      if (authLoading) {
        return;
      }

      if (!activeFarmId) {
        console.log("[EditarFazenda] No active farm, redirecting");
        navigate("/select-fazenda");
        return;
      }

      // Apenas owner e manager podem editar
      if (role !== "owner" && role !== "manager") {
        console.log("[EditarFazenda] User role:", role, "- no permission");
        setError("Você não tem permissão para editar esta fazenda");
        setLoadingData(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from("fazendas")
          .select(
            "nome, codigo, municipio, estado, cep, area_total_ha, tipo_producao, sistema_manejo, metadata",
          )
          .eq("id", activeFarmId)
          .single();

        if (fetchError) {
          console.error("[EditarFazenda] Error fetching farm:", fetchError);
          setError("Erro ao carregar dados da fazenda");
          setLoadingData(false);
          return;
        }

        if (data) {
          const metadata =
            data.metadata && typeof data.metadata === "object"
              ? (data.metadata as Record<string, unknown>)
              : {};
          const rollout = resolveEventosRolloutFlags(metadata);

          reset({
            nome: data.nome,
            codigo: data.codigo || "",
            municipio: data.municipio || "",
            estado: data.estado || "",
            cep: data.cep || "",
            area_total_ha: data.area_total_ha || undefined,
            tipo_producao: data.tipo_producao || undefined,
            sistema_manejo: data.sistema_manejo || undefined,
          });
          setFarmMetadata(metadata);
          setEssentialModeEnabled(
            resolveFarmExperienceMode(metadata) === "essencial",
          );
          setStrictRulesEnabled(rollout.strict_rules_enabled);
          setStrictAntiTeleportEnabled(rollout.strict_anti_teleporte);
        }

        setLoadingData(false);
      } catch (e) {
        console.error("[EditarFazenda] Exception:", e);
        setError("Erro ao carregar fazenda");
        setLoadingData(false);
      }
    };

    loadFazenda();
  }, [activeFarmId, role, authLoading, navigate, reset]);

  const onSubmit = async (data: EditarFazendaForm) => {
    if (!activeFarmId) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log("[EditarFazenda] Updating farm:", data);
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
          nome: data.nome,
          codigo: data.codigo || null,
          municipio: data.municipio || null,
          estado: data.estado || null,
          cep: data.cep || null,
          area_total_ha: data.area_total_ha || null,
          tipo_producao: data.tipo_producao || null,
          sistema_manejo: data.sistema_manejo || null,
          metadata: updatedMetadata,
          // benfeitorias: reserved for future use (will be managed via pastos)
        })
        .eq("id", activeFarmId);

      if (updateError) {
        console.error("[EditarFazenda] Error updating farm:", updateError);
        throw new Error(updateError.message || "Erro ao atualizar fazenda");
      }

      console.log("[EditarFazenda] Farm updated successfully");
      setFarmMetadata(updatedMetadata);
      await refreshSettings();
      navigate("/home");
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err.message);
      setIsLoading(false);
    }
  };

  // Loading state
  if (loadingData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // No permission or error loading
  if (error && !activeFarmId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Erro</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{error}</p>
            <Button
              onClick={() => navigate("/select-fazenda")}
              className="w-full"
              variant="outline"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Editar Fazenda</CardTitle>
          <p className="text-sm text-muted-foreground">
            Atualize os dados da fazenda
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome da Fazenda *</Label>
              <Input
                id="nome"
                placeholder="Ex: Fazenda Santa Clara"
                {...register("nome", { required: "Nome é obrigatório" })}
                disabled={isLoading}
              />
              {errors.nome && (
                <p className="text-sm text-destructive">
                  {errors.nome.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="codigo">Código (opcional)</Label>
              <Input
                id="codigo"
                placeholder="Ex: FSC-001"
                {...register("codigo")}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="municipio">Município (opcional)</Label>
              <Input
                id="municipio"
                placeholder="Ex: Goiânia"
                {...register("municipio")}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estado">Estado (opcional)</Label>
              <select
                id="estado"
                {...register("estado")}
                disabled={isLoading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Selecione...</option>
                <option value="AC">Acre (AC)</option>
                <option value="AL">Alagoas (AL)</option>
                <option value="AP">Amapá (AP)</option>
                <option value="AM">Amazonas (AM)</option>
                <option value="BA">Bahia (BA)</option>
                <option value="CE">Ceará (CE)</option>
                <option value="DF">Distrito Federal (DF)</option>
                <option value="ES">Espírito Santo (ES)</option>
                <option value="GO">Goiás (GO)</option>
                <option value="MA">Maranhão (MA)</option>
                <option value="MT">Mato Grosso (MT)</option>
                <option value="MS">Mato Grosso do Sul (MS)</option>
                <option value="MG">Minas Gerais (MG)</option>
                <option value="PA">Pará (PA)</option>
                <option value="PB">Paraíba (PB)</option>
                <option value="PR">Paraná (PR)</option>
                <option value="PE">Pernambuco (PE)</option>
                <option value="PI">Piauí (PI)</option>
                <option value="RJ">Rio de Janeiro (RJ)</option>
                <option value="RN">Rio Grande do Norte (RN)</option>
                <option value="RS">Rio Grande do Sul (RS)</option>
                <option value="RO">Rondônia (RO)</option>
                <option value="RR">Roraima (RR)</option>
                <option value="SC">Santa Catarina (SC)</option>
                <option value="SP">São Paulo (SP)</option>
                <option value="SE">Sergipe (SE)</option>
                <option value="TO">Tocantins (TO)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cep">CEP (opcional)</Label>
              <Input
                id="cep"
                placeholder="Ex: 12345-678"
                maxLength={9}
                {...register("cep", {
                  pattern: {
                    value: /^\d{5}-\d{3}$/,
                    message: "CEP inválido. Use o formato: 12345-678",
                  },
                })}
                disabled={isLoading}
                onChange={(e) => {
                  let value = e.target.value.replace(/\D/g, "");
                  if (value.length > 5) {
                    value = value.slice(0, 5) + "-" + value.slice(5, 8);
                  }
                  e.target.value = value;
                }}
              />
              {errors.cep && (
                <p className="text-sm text-destructive">{errors.cep.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="area_total_ha">
                Área Total (hectares) (opcional)
              </Label>
              <Input
                id="area_total_ha"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Ex: 150.50"
                {...register("area_total_ha", {
                  valueAsNumber: true,
                  min: {
                    value: 0.01,
                    message: "Área deve ser maior que zero",
                  },
                })}
                disabled={isLoading}
              />
              {errors.area_total_ha && (
                <p className="text-sm text-destructive">
                  {errors.area_total_ha.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo_producao">Tipo de Produção (opcional)</Label>
              <select
                id="tipo_producao"
                {...register("tipo_producao")}
                disabled={isLoading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Selecione...</option>
                <option value="corte">Corte</option>
                <option value="leite">Leite</option>
                <option value="mista">Mista</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sistema_manejo">
                Sistema de Manejo (opcional)
              </Label>
              <select
                id="sistema_manejo"
                {...register("sistema_manejo")}
                disabled={isLoading}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Selecione...</option>
                <option value="confinamento">Confinamento</option>
                <option value="semi_confinamento">Semi-Confinamento</option>
                <option value="pastagem">Pastagem</option>
              </select>
            </div>

            <div className="space-y-3 rounded-md border p-4">
              <div>
                <Label className="text-sm font-semibold">Experiencia do aplicativo</Label>
                <p className="text-xs text-muted-foreground">
                  Ajusta a navegacao para uma rotina mais enxuta ou libera todos os modulos.
                </p>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Modo essencial</p>
                  <p className="text-xs text-muted-foreground">
                    Foca em hoje, agenda, rebanho, financeiro basico e resumo operacional.
                  </p>
                </div>
                <Switch
                  checked={essentialModeEnabled}
                  onCheckedChange={setEssentialModeEnabled}
                  disabled={isLoading}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                Com o modo essencial desligado, o app volta a mostrar reproducao,
                eventos completos, dashboard, categorias e reconciliacao.
              </p>
            </div>

            <div className="space-y-3 rounded-md border p-4">
              <div>
                <Label className="text-sm font-semibold">Rollout de Eventos (Fase 4)</Label>
                <p className="text-xs text-muted-foreground">
                  Controle por fazenda para regras estritas do pipeline de eventos.
                </p>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Regras estritas</p>
                  <p className="text-xs text-muted-foreground">
                    Liga/desliga validacoes estritas da unificacao de eventos.
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
                  disabled={isLoading || !canManageRolloutFlags}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Anti-teleporte estrito</p>
                  <p className="text-xs text-muted-foreground">
                    Exige evento de movimentacao no mesmo gesto para atualizar lote/pasto.
                  </p>
                </div>
                <Switch
                  checked={strictRulesEnabled && strictAntiTeleportEnabled}
                  onCheckedChange={setStrictAntiTeleportEnabled}
                  disabled={
                    isLoading ||
                    !canManageRolloutFlags ||
                    !strictRulesEnabled
                  }
                />
              </div>

              {!canManageRolloutFlags && (
                <p className="text-xs text-muted-foreground">
                  Apenas owner pode alterar flags de rollout da fazenda.
                </p>
              )}
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/home")}
                disabled={isLoading}
                className="flex-1"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default EditarFazenda;
