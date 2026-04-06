import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import { ChevronRight, LogOut, MapPin, Plus, Tractor } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { PageIntro } from "@/components/ui/page-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";

interface FazendaData {
  id: string;
  nome: string;
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

const SelectFazenda = () => {
  const { user, signOut, setActiveFarm } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [canCreateFarm, setCanCreateFarm] = useState<boolean | null>(null);

  const fazendas = useLiveQuery(async () => {
    if (!user) return [];

    const { data } = await supabase
      .from("user_fazendas")
      .select("role, fazendas(id, nome)")
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
          console.error("[SelectFazenda] ERROR checking can_create_farm:", error);
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
      <div className="mx-auto max-w-5xl space-y-6">
        <PageIntro
          eyebrow="Acesso"
          title="Escolha a fazenda"
          description="Selecione a operacao ativa para abrir a rotina do dia com o contexto certo. A troca continua leve e previsivel."
          meta={
            <>
              <StatusBadge tone="neutral">{user?.email ?? "Conta sem e-mail"}</StatusBadge>
              <StatusBadge tone={memberships.length > 0 ? "info" : "warning"}>
                {memberships.length} fazenda(s) disponivel(is)
              </StatusBadge>
            </>
          }
          actions={
            <>
              {canCreateFarm === true ? (
                <Button variant="outline" onClick={() => navigate("/criar-fazenda")}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar nova fazenda
                </Button>
              ) : null}
              <Button variant="outline" onClick={() => void signOut()} disabled={loading}>
                <LogOut className="mr-2 h-4 w-4" />
                Sair da conta
              </Button>
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-3">
            {!fazendas ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  Carregando fazendas...
                </CardContent>
              </Card>
            ) : memberships.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Nenhuma fazenda vinculada</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Voce ainda nao esta vinculado a nenhuma fazenda. Aceite um
                    convite ou crie a primeira operacao para comecar.
                  </p>

                  {canCreateFarm === true ? (
                    <Button onClick={() => navigate("/criar-fazenda")} className="w-full">
                      <Plus className="mr-2 h-4 w-4" />
                      Criar nova fazenda
                    </Button>
                  ) : null}

                  {canCreateFarm === false ? (
                    <p className="text-xs text-muted-foreground">
                      Sua conta nao tem permissao para criar fazendas neste momento.
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ) : (
              memberships.map((fazenda) => (
                <Card key={fazenda.id} className="transition-colors hover:border-primary/60">
                  <CardContent className="p-4">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-4 text-left"
                      onClick={() => void handleSelect(fazenda.id)}
                      disabled={loading}
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-2xl border border-primary/10 bg-primary/5 p-2.5 text-primary">
                          <MapPin className="h-5 w-5" />
                        </div>
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <p className="font-semibold">{fazenda.nome}</p>
                            <p className="text-sm text-muted-foreground">
                              Entrar na rotina da fazenda
                            </p>
                          </div>
                          <StatusBadge tone={roleToneMap[fazenda.role] ?? "neutral"}>
                            {roleLabelMap[fazenda.role] ?? fazenda.role}
                          </StatusBadge>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </CardContent>
                </Card>
              ))
            )}
          </section>

          <aside className="space-y-4">
            <MetricCard
              label="Fazendas disponiveis"
              value={memberships.length}
              hint="Selecione uma operacao para abrir a rotina diaria com o contexto correto."
              icon={<Tractor className="h-5 w-5" />}
              tone={memberships.length > 0 ? "info" : "warning"}
            />
            <MetricCard
              label="Criacao permitida"
              value={canCreateFarm === false ? "Nao" : "Sim"}
              hint="A criacao de novas fazendas segue a permissao da sua conta."
              tone={canCreateFarm === false ? "warning" : "success"}
            />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Como esta tela funciona</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>A fazenda escolhida vira o contexto ativo da navegacao e da rotina operacional.</p>
                <p>Se voce recebeu um convite, aceite-o primeiro para que a fazenda apareca aqui.</p>
                <p>A troca de fazenda nao altera dados locais ja sincronizados; ela apenas muda o escopo da sessao.</p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default SelectFazenda;
