import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";

type CriarFazendaForm = {
  nome: string;
  codigo?: string;
  municipio?: string;
  estado?: string;
  cep?: string;
  area_total_ha?: number;
  tipo_producao?: "corte" | "leite" | "mista";
  sistema_manejo?: "confinamento" | "semi_confinamento" | "pastagem";
};

const CriarFazenda = () => {
  const { user, setActiveFarm } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [canCreate, setCanCreate] = useState<boolean | null>(null);
  const [checkingPermission, setCheckingPermission] = useState(true);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CriarFazendaForm>();

  // ✅ Check permission on mount
  useEffect(() => {
    const checkPermission = async () => {
      if (!user) {
        console.log("[CriarFazenda] No user, redirecting to login");
        navigate("/login");
        return;
      }

      try {
        console.log("[CriarFazenda] Checking permission for user:", user.id);
        console.log("[CriarFazenda] User email:", user.email);

        const { data, error } = await supabase.rpc("can_create_farm");

        if (error) {
          console.error("[CriarFazenda] ERROR checking permission:", error);
          console.error("[CriarFazenda] Error details:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
          });
          setCanCreate(false);
          setCheckingPermission(false);
          return;
        }

        console.log("[CriarFazenda] ✅ can_create_farm RPC returned:", data);
        console.log("[CriarFazenda] Type of data:", typeof data);
        console.log(
          "[CriarFazenda] Permission result:",
          data === true ? "ALLOWED" : "DENIED",
        );

        setCanCreate(data === true);
      } catch (error) {
        console.error("[CriarFazenda] EXCEPTION checking permission:", error);
        setCanCreate(false);
      } finally {
        setCheckingPermission(false);
      }
    };

    checkPermission();
  }, [user, navigate]);

  const onSubmit = async (data: CriarFazendaForm) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log("[CriarFazenda] Creating farm:", data);

      const { data: fazendaId, error: createError } = await supabase.rpc(
        "create_fazenda",
        {
          _nome: data.nome,
          _codigo: data.codigo || null,
          _municipio: data.municipio || null,
          _estado: data.estado || null,
          _cep: data.cep || null,
          _area_total_ha: data.area_total_ha || null,
          _tipo_producao: data.tipo_producao || null,
          _sistema_manejo: data.sistema_manejo || null,
          // benfeitorias: reserved for future use (will default to {})
        },
      );

      if (createError) {
        console.error("[CriarFazenda] Error creating farm:", createError);

        // ✅ User-friendly error messages
        if (
          createError.message?.includes("Forbidden") ||
          createError.message?.includes("permissão")
        ) {
          throw new Error(
            "Você não tem permissão para criar fazendas. Entre em contato com o administrador.",
          );
        }

        throw new Error(createError.message || "Erro ao criar fazenda");
      }

      if (!fazendaId) {
        throw new Error("Fazenda criada mas ID não retornado");
      }

      console.log("[CriarFazenda] Farm created successfully:", fazendaId);

      // Set as active farm
      await setActiveFarm(fazendaId);

      // Redirect to home
      navigate("/home");
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err.message);
      setIsLoading(false);
    }
  };

  // Loading permission check
  if (checkingPermission) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // No permission
  if (canCreate === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Sem Permissão</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Você não tem permissão para criar fazendas. Entre em contato com o
              administrador ou aceite um convite para uma fazenda existente.
            </p>
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
          <CardTitle className="text-2xl font-bold">
            Criar Nova Fazenda
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Preencha os dados da nova fazenda
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

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/select-fazenda")}
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
                    Criando...
                  </>
                ) : (
                  "Criar Fazenda"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CriarFazenda;
