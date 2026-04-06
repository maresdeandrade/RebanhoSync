import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, MapPinned, Tractor } from "lucide-react";

import { FormSection } from "@/components/ui/form-section";
import { PageIntro } from "@/components/ui/page-intro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

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

const selectClassName =
  "flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground shadow-none ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

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
        console.error("[CriarFazenda] EXCEPTION checking permission:", requestError);
        setCanCreate(false);
      } finally {
        setCheckingPermission(false);
      }
    };

    void checkPermission();
  }, [navigate, user]);

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
          createError.message?.includes("permiss")
        ) {
          throw new Error(
            "Voce nao tem permissao para criar fazendas. Entre em contato com o administrador.",
          );
        }

        throw new Error(createError.message || "Erro ao criar fazenda");
      }

      if (!fazendaId) {
        throw new Error("Fazenda criada mas ID nao retornado");
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
      return;
    }

    setIsLoading(false);
  };

  if (checkingPermission) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (canCreate === false) {
    return (
      <div className="min-h-screen bg-muted/20 px-4 py-10">
        <div className="mx-auto max-w-3xl space-y-6">
          <PageIntro
            eyebrow="Provisionamento"
            title="Sem permissao para criar fazenda"
            description="Este fluxo continua protegido por permissao. Se precisar abrir uma nova operacao, solicite liberacao ou aceite um convite existente."
            actions={
              <Button variant="outline" onClick={() => navigate("/select-fazenda")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <PageIntro
          eyebrow="Provisionamento"
          title="Criar nova fazenda"
          description="Cadastre a operacao com o minimo necessario para iniciar. O restante pode ser refinado depois dentro das configuracoes e estruturas."
          actions={
            <Button variant="outline" onClick={() => navigate("/select-fazenda")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          }
        />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <FormSection
            title="Identidade da operacao"
            description="Nome, codigo e localizacao basica para identificar a fazenda no seletor e na rotina diaria."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="nome">Nome da fazenda</Label>
                <Input
                  id="nome"
                  placeholder="Ex: Fazenda Santa Clara"
                  disabled={isLoading}
                  {...register("nome", { required: "Nome e obrigatorio" })}
                />
                {errors.nome ? (
                  <p className="text-sm text-destructive">{errors.nome.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="codigo">Codigo</Label>
                <Input
                  id="codigo"
                  placeholder="Ex: FSC-001"
                  disabled={isLoading}
                  {...register("codigo")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="area_total_ha">Area total (ha)</Label>
                <Input
                  id="area_total_ha"
                  type="number"
                  step="0.01"
                  placeholder="Ex: 450"
                  disabled={isLoading}
                  {...register("area_total_ha", { valueAsNumber: true })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="municipio">Municipio</Label>
                <Input
                  id="municipio"
                  placeholder="Ex: Goiania"
                  disabled={isLoading}
                  {...register("municipio")}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="estado">Estado</Label>
                <select
                  id="estado"
                  className={selectClassName}
                  disabled={isLoading}
                  {...register("estado")}
                >
                  <option value="">Selecione...</option>
                  <option value="AC">Acre (AC)</option>
                  <option value="AL">Alagoas (AL)</option>
                  <option value="AP">Amapa (AP)</option>
                  <option value="AM">Amazonas (AM)</option>
                  <option value="BA">Bahia (BA)</option>
                  <option value="CE">Ceara (CE)</option>
                  <option value="DF">Distrito Federal (DF)</option>
                  <option value="ES">Espirito Santo (ES)</option>
                  <option value="GO">Goias (GO)</option>
                  <option value="MA">Maranhao (MA)</option>
                  <option value="MT">Mato Grosso (MT)</option>
                  <option value="MS">Mato Grosso do Sul (MS)</option>
                  <option value="MG">Minas Gerais (MG)</option>
                  <option value="PA">Para (PA)</option>
                  <option value="PB">Paraiba (PB)</option>
                  <option value="PR">Parana (PR)</option>
                  <option value="PE">Pernambuco (PE)</option>
                  <option value="PI">Piaui (PI)</option>
                  <option value="RJ">Rio de Janeiro (RJ)</option>
                  <option value="RN">Rio Grande do Norte (RN)</option>
                  <option value="RS">Rio Grande do Sul (RS)</option>
                  <option value="RO">Rondonia (RO)</option>
                  <option value="RR">Roraima (RR)</option>
                  <option value="SC">Santa Catarina (SC)</option>
                  <option value="SP">Sao Paulo (SP)</option>
                  <option value="SE">Sergipe (SE)</option>
                  <option value="TO">Tocantins (TO)</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cep">CEP</Label>
                <Input
                  id="cep"
                  placeholder="12345-678"
                  maxLength={9}
                  disabled={isLoading}
                  {...register("cep", {
                    pattern: {
                      value: /^\d{5}-\d{3}$/,
                      message: "CEP invalido. Use o formato 12345-678",
                    },
                  })}
                  onChange={(event) => {
                    let value = event.target.value.replace(/\D/g, "");
                    if (value.length > 5) {
                      value = value.slice(0, 5) + "-" + value.slice(5, 8);
                    }
                    event.target.value = value;
                  }}
                />
                {errors.cep ? (
                  <p className="text-sm text-destructive">{errors.cep.message}</p>
                ) : null}
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Perfil produtivo"
            description="Informacoes iniciais para encaixar a fazenda no modo de operacao certo desde o onboarding."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tipo_producao">Tipo de producao</Label>
                <select
                  id="tipo_producao"
                  className={selectClassName}
                  disabled={isLoading}
                  {...register("tipo_producao")}
                >
                  <option value="">Selecione...</option>
                  <option value="corte">Corte</option>
                  <option value="leite">Leite</option>
                  <option value="mista">Mista</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sistema_manejo">Sistema de manejo</Label>
                <select
                  id="sistema_manejo"
                  className={selectClassName}
                  disabled={isLoading}
                  {...register("sistema_manejo")}
                >
                  <option value="">Selecione...</option>
                  <option value="pastagem">Pastagem</option>
                  <option value="semi_confinamento">Semi-confinamento</option>
                  <option value="confinamento">Confinamento</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                <div className="mb-2 flex items-center gap-2 text-foreground">
                  <MapPinned className="h-4 w-4" />
                  <p className="font-medium">Operacao localizada</p>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Municipio e estado ajudam a distinguir rapidamente fazendas da mesma conta.
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                <div className="mb-2 flex items-center gap-2 text-foreground">
                  <Tractor className="h-4 w-4" />
                  <p className="font-medium">Cadastro enxuto</p>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Estruturas, membros e regras de classificacao continuam em fluxos dedicados depois da criacao.
                </p>
              </div>
            </div>
          </FormSection>

          {error ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando fazenda...
              </>
            ) : (
              "Criar fazenda"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default CriarFazenda;
