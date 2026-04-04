import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import { ChevronRight, LogOut, MapPin, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface FazendaData {
  id: string;
  nome: string;
}

interface UserFazenda {
  fazendas: FazendaData[] | FazendaData;
  role: string;
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

    checkPermission();
  }, [user]);

  const handleSelect = async (fazendaId: string) => {
    setLoading(true);
    await setActiveFarm(fazendaId);
    navigate("/home", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Escolha a fazenda</h1>
          <p className="text-sm text-muted-foreground">
            Selecione a operacao ativa para abrir a rotina do dia.
          </p>
          <p className="text-muted-foreground">{user?.email}</p>
        </div>

        <div className="space-y-3">
          {!fazendas ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Carregando fazendas...</p>
              </CardContent>
            </Card>
          ) : fazendas.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center space-y-4">
                <p className="text-muted-foreground mb-2">
                  VocÃª nÃ£o estÃ¡ vinculado a nenhuma fazenda.
                </p>
                <p className="text-sm text-muted-foreground">
                  Aceite um convite ou crie a primeira fazenda para comeÃ§ar.
                </p>

                {canCreateFarm === true && (
                  <Button
                    onClick={() => navigate("/criar-fazenda")}
                    className="w-full gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Criar nova fazenda
                  </Button>
                )}

                {canCreateFarm === false && (
                  <p className="text-xs text-muted-foreground italic">
                    VocÃª nÃ£o tem permissÃ£o para criar fazendas.
                  </p>
                )}

                <Button variant="outline" onClick={signOut} className="w-full">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </Button>
              </CardContent>
            </Card>
          ) : (
            fazendas.map((membership: UserFazenda) => {
              const rawFarm = membership.fazendas;
              const fazenda = Array.isArray(rawFarm) ? rawFarm[0] : rawFarm;

              if (!fazenda?.id) return null;
              if (!["owner", "manager", "cowboy"].includes(membership.role)) {
                return null;
              }

              return (
                <Card
                  key={fazenda.id}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => handleSelect(fazenda.id)}
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <MapPin className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-bold">{fazenda.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          Entrar na rotina da fazenda
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              );
            })
          )}

          {fazendas && fazendas.length > 0 && canCreateFarm === true && (
            <Card className="border-dashed">
              <CardContent className="p-4">
                <Button
                  onClick={() => navigate("/criar-fazenda")}
                  variant="outline"
                  className="w-full gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Criar nova fazenda
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <Button
          variant="ghost"
          className="w-full gap-2"
          onClick={signOut}
          disabled={loading}
        >
          <LogOut className="h-4 w-4" /> Sair da conta
        </Button>
      </div>
    </div>
  );
};

export default SelectFazenda;
