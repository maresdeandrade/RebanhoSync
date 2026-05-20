import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import { ChevronRight, LogOut, MapPin, Plus } from "lucide-react";

import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/ui/page-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

interface FazendaData {
  id: string;
  nome: string;
  municipio: string | null;
  estado: string | null;
  area_total_ha: number | null;
  tipo_producao: "corte" | "leite" | "mista" | null;
  sistema_manejo: "confinamento" | "semi_confinamento" | "pastagem" | null;
}

interface UserFazenda {
  fazendas: FazendaData[] | FazendaData;
  role: string;
}

const roleLabelMap: Record<string, string> = {
  owner: "Proprietario",
  manager: "Gerente",
  cowboy: "Operacao",
};

const roleToneMap: Record<string, "success" | "info" | "neutral"> = {
  owner: "success",
  manager: "info",
  cowboy: "neutral",
};

const productionLabelMap: Record<
  NonNullable<FazendaData["tipo_producao"]>,
  string
> = {
  corte: "Corte",
  leite: "Leite",
  mista: "Mista",
};

const managementLabelMap: Record<
  NonNullable<FazendaData["sistema_manejo"]>,
  string
> = {
  confinamento: "Confinamento",
  semi_confinamento: "Semi-confinamento",
  pastagem: "Pastagem",
};

function formatArea(area: number | null) {
  if (typeof area !== "number" || Number.isNaN(area)) return null;

  return `${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: area % 1 === 0 ? 0 : 1,
  }).format(area)} ha`;
}

function formatLocation(fazenda: FazendaData) {
  if (fazenda.municipio && fazenda.estado) {
    return `${fazenda.municipio} - ${fazenda.estado}`;
  }

  return fazenda.municipio || fazenda.estado || "Localizacao nao informada";
}

const SelectFazenda = () => {
  const { user, signOut, setActiveFarm } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [canCreateFarm, setCanCreateFarm] = useState<boolean | null>(null);

  const fazendas = useLiveQuery(async () => {
    if (!user) return [];

    const { data } = await supabase
      .from("user_fazendas")
      .select(
        "role, fazendas(id, nome, municipio, estado, area_total_ha, tipo_producao, sistema_manejo)",
      )
      .eq("user_id", user.id)
      .is("deleted_at", null);

    return data || [];
  }, [user]);

  useEffect(() => {
    const checkPermission = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase.rpc("can_create_farm");

        if (error) {
          console.error(
            "[SelectFazenda] ERROR checking can_create_farm:",
            error,
          );
          setCanCreateFarm(false);
          return;
        }

        setCanCreateFarm(data === true);
      } catch (requestError) {
        console.error(
          "[SelectFazenda] EXCEPTION checking permission:",
          requestError,
        );
        setCanCreateFarm(false);
      }
    };

    void checkPermission();
  }, [user]);

  const memberships = useMemo(() => {
    return (fazendas ?? []).flatMap((membership: UserFazenda) => {
      const rawFarm = membership.fazendas;
      const fazenda = Array.isArray(rawFarm) ? rawFarm[0] : rawFarm;

      if (!fazenda?.id) return [];
      if (!["owner", "manager", "cowboy"].includes(membership.role)) {
        return [];
      }

      return [
        {
          id: fazenda.id,
          nome: fazenda.nome,
          municipio: fazenda.municipio ?? null,
          estado: fazenda.estado ?? null,
          area_total_ha: fazenda.area_total_ha ?? null,
          tipo_producao: fazenda.tipo_producao ?? null,
          sistema_manejo: fazenda.sistema_manejo ?? null,
          role: membership.role,
        },
      ];
    });
  }, [fazendas]);

  const handleSelect = async (fazendaId: string) => {
    setLoading(true);
    await setActiveFarm(fazendaId);
    navigate("/home", { replace: true });
  };

  return (
    <div className="min-h-screen bg-muted/20 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <PageIntro
          variant="plain"
          eyebrow="Acesso"
          title="Escolha a fazenda"
          meta={
            <>
              <StatusBadge tone="neutral">
                {user?.email ?? "Conta sem e-mail"}
              </StatusBadge>
              <StatusBadge tone={memberships.length > 0 ? "info" : "warning"}>
                {memberships.length} fazenda(s) disponivel(is)
              </StatusBadge>
            </>
          }
          actions={
            <>
              {canCreateFarm === true ? (
                <Button
                  variant="outline"
                  onClick={() => navigate("/criar-fazenda")}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Criar nova fazenda
                </Button>
              ) : null}
              <Button
                variant="outline"
                onClick={() => void signOut()}
                disabled={loading}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair da conta
              </Button>
            </>
          }
        />

        <div>
          <section className="space-y-3">
            {!fazendas ? (
              <div className="rounded-xl border border-border/70 bg-card p-6 text-sm text-muted-foreground shadow-none">
                Carregando fazendas...
              </div>
            ) : memberships.length === 0 ? (
              <EmptyState
                icon={MapPin}
                title="Nenhuma fazenda vinculada"
                description="Aceite um convite ou crie a primeira fazenda para iniciar a rotina."
                action={
                  canCreateFarm === true
                    ? {
                        label: "Criar nova fazenda",
                        onClick: () => navigate("/criar-fazenda"),
                      }
                    : undefined
                }
              />
            ) : (
              memberships.map((fazenda) => {
                const areaLabel = formatArea(fazenda.area_total_ha);
                const profileItems = [
                  areaLabel ? { label: "Area", value: areaLabel } : null,
                  fazenda.tipo_producao
                    ? {
                        label: "Producao",
                        value: productionLabelMap[fazenda.tipo_producao],
                      }
                    : null,
                  fazenda.sistema_manejo
                    ? {
                        label: "Manejo",
                        value: managementLabelMap[fazenda.sistema_manejo],
                      }
                    : null,
                ].filter(Boolean) as Array<{ label: string; value: string }>;

                return (
                  <div
                    key={fazenda.id}
                    className="rounded-xl border border-border/70 bg-card p-4 shadow-none transition-colors hover:border-primary/50"
                  >
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-4 text-left"
                      onClick={() => void handleSelect(fazenda.id)}
                      disabled={loading}
                    >
                      <div className="min-w-0 flex-1 space-y-4">
                        <div className="flex items-start gap-3">
                          <div className="rounded-xl border border-primary/10 bg-primary/5 p-2.5 text-primary">
                            <MapPin className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 space-y-2">
                            <div className="space-y-1">
                              <p className="truncate text-base font-semibold text-foreground">
                                {fazenda.nome}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {formatLocation(fazenda)}
                              </p>
                            </div>
                            <StatusBadge
                              tone={roleToneMap[fazenda.role] ?? "neutral"}
                            >
                              {roleLabelMap[fazenda.role] ?? fazenda.role}
                            </StatusBadge>
                          </div>
                        </div>

                        {profileItems.length > 0 ? (
                          <div className="grid gap-3 border-t border-border/70 pt-3 sm:grid-cols-3">
                            {profileItems.map((item) => (
                              <div key={item.label} className="min-w-0">
                                <p className="text-xs font-semibold uppercase text-muted-foreground">
                                  {item.label}
                                </p>
                                <p className="mt-1 truncate text-sm font-medium text-foreground">
                                  {item.value}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </div>
                );
              })
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default SelectFazenda;

