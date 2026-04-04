import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  useEffect(() => {
    const checkPermission = async () => {
      if (!user) {
        navigate("/login");
        return;
      }

      try {
        const { data, error } = await supabase.rpc("can_create_farm");

        if (error) {
          console.error("[CriarFazenda] ERROR checking permission:", error);
          setCanCreate(false);
          setCheckingPermission(false);
          return;
        }

        setCanCreate(data === true);
      } catch (requestError) {
        console.error(
          "[CriarFazenda] EXCEPTION checking permission:",
          requestError,
        );
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
        },
      );

      if (createError) {
        console.error("[CriarFazenda] Error creating farm:", createError);

        if (
          createError.message?.includes("Forbidden") ||
          createError.message?.includes("permissÃ£o")
        ) {
          throw new Error(
            "VocÃª nÃ£o tem permissÃ£o para criar fazendas. Entre em contato com o administrador.",
          );
        }

        throw new Error(createError.message || "Erro ao criar fazenda");
      }

      if (!fazendaId) {
        throw new Error("Fazenda criada mas ID nÃ£o retornado");
      }

      await setActiveFarm(fazendaId);
      navigate("/onboarding-inicial");
    } catch (submitError: unknown) {
      const normalizedError =
        submitError instanceof Error
          ? submitError
          : new Error(String(submitError));
      setError(normalizedError.message);
      setIsLoading(false);
    }
  };

  if (checkingPermission) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (canCreate === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Sem PermissÃ£o</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              VocÃª nÃ£o tem permissÃ£o para criar fazendas. Entre em contato com o
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
                {...register("nome", { required: "Nome Ã© obrigatÃ³rio" })}
                disabled={isLoading}
              />
              {errors.nome && (
                <p className="text-sm text-destructive">
                  {errors.nome.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="codigo">CÃ³digo (opcional)</Label>
              <Input
                id="codigo"
                placeholder="Ex: FSC-001"
                {...register("codigo")}
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="municipio">MunicÃ­pio (opcional)</Label>
              <Input
                id="municipio"
                placeholder="Ex: GoiÃ¢nia"
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
                <option value="AP">AmapÃ¡ (AP)</option>
                <option value="AM">Amazonas (AM)</option>
                <option value="BA">Bahia (BA)</option>
                <option value="CE">CearÃ¡ (CE)</option>
                <option value="DF">Distrito Federal (DF)</option>
                <option value="ES">EspÃ­rito Santo (ES)</option>
                <option value="GO">GoiÃ¡s (GO)</option>
                <option value="MA">MaranhÃ£o (MA)</option>
                <option value="MT">Mato Grosso (MT)</option>
                <option value="MS">Mato Grosso do Sul (MS)</option>
                <option value="MG">Minas Gerais (MG)</option>
                <option value="PA">ParÃ¡ (PA)</option>
                <option value="PB">ParaÃ­ba (PB)</option>
                <option value="PR">ParanÃ¡ (PR)</option>
                <option value="PE">Pernambuco (PE)</option>
                <option value="PI">PiauÃ­ (PI)</option>
                <option value="RJ">Rio de Janeiro (RJ)</option>
                <option value="RN">Rio Grande do Norte (RN)</option>
                <option value="RS">Rio Grande do Sul (RS)</option>
                <option value="RO">RondÃ´nia (RO)</option>
                <option value="RR">Roraima (RR)</option>
                <option value="SC">Santa Catarina (SC)</option>
                <option value="SP">SÃ£o Paulo (SP)</option>
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
                    message: "CEP invÃ¡lido. Use o formato: 12345-678",
                  },
                })}
                disabled={isLoading}
                onChange={(event) => {
                  let value = event.target.value.replace(/\D/g, "");
                  if (value.length > 5) {
                    value = value.slice(0, 5) + "-" + value.slice(5, 8);
                  }
                  event.target.value = value;
                }}
              />
              {errors.cep && (
                <p className="text-sm text-destructive">{errors.cep.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="area_total_ha">
                Ãrea Total (hectares) (opcional)
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
                    message: "Ãrea deve ser maior que zero",
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
              <Label htmlFor="tipo_producao">Tipo de ProduÃ§Ã£o (opcional)</Label>
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
