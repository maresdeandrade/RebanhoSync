import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, ChevronRight, LogOut, Plus } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// TYPE FIX: Define proper interface for user_fazendas query result
// Supabase nested select returns array: fazendas: [{id, nome}]
interface FazendaData {
  id: string;
  nome: string;
}

interface UserFazenda {
  fazendas: FazendaData[];
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

  // ✅ Check can_create_farm permission
  useEffect(() => {
    const checkPermission = async () => {
      if (!user) {
        if (import.meta.env.DEV) {
          console.debug("[SelectFazenda] No user, skipping permission check");
        }
        return;
      }

      try {
        if (import.meta.env.DEV) {
          console.debug(
            "[SelectFazenda] Checking can_create_farm for user:",
            user.id,
          );
        }

        const { data, error } = await supabase.rpc("can_create_farm");

        if (error) {
          console.error(
            "[SelectFazenda] ERROR checking can_create_farm:",
            error,
          );
          if (import.meta.env.DEV) {
            console.debug("[SelectFazenda] Error details:", {
              message: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint,
            });
          }
          setCanCreateFarm(false);
          return;
        }

        if (import.meta.env.DEV) {
          console.debug(
            "[SelectFazenda] ✅ can_create_farm RPC returned:",
            data,
          );
          console.debug("[SelectFazenda] Type of data:", typeof data);
          console.debug(
            "[SelectFazenda] Setting canCreateFarm to:",
            data === true,
          );
        }

        setCanCreateFarm(data === true);
      } catch (error) {
        console.error("[SelectFazenda] EXCEPTION checking permission:", error);
        setCanCreateFarm(false);
      }
    };

    checkPermission();
  }, [user]);

  const handleSelect = async (fazenda_id: string) => {
    setLoading(true);

    // ✅ POLÍTICA DE ESCRITA: usa setActiveFarm do useAuth
    // Isso persiste em localStorage + user_settings + carrega role
    await setActiveFarm(fazenda_id);

    // Redireciona para home (fazenda já está ativa)
    window.location.href = "/home";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Selecionar Fazenda</h1>
          <p className="text-muted-foreground">{user?.email}</p>
        </div>

        <div className="space-y-3">
          {!fazendas ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Carregando...</p>
              </CardContent>
            </Card>
          ) : fazendas.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center space-y-4">
                <p className="text-muted-foreground mb-2">
                  Você não está vinculado a nenhuma fazenda.
                </p>
                <p className="text-sm text-muted-foreground">
                  Aceite um convite para entrar em uma fazenda existente.
                </p>

                {/* ✅ Show Create Farm button only if user has permission */}
                {canCreateFarm === true && (
                  <Button
                    onClick={() => navigate("/criar-fazenda")}
                    className="w-full gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Criar Nova Fazenda
                  </Button>
                )}

                {canCreateFarm === false && (
                  <p className="text-xs text-muted-foreground italic">
                    Você não tem permissão para criar fazendas.
                  </p>
                )}

                <Button variant="outline" onClick={signOut} className="w-full">
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </Button>
              </CardContent>
            </Card>
          ) : (
            // ✅ DEFENSIVO: Supabase nested select retorna OBJETO para many-to-one
            fazendas.map((uf: UserFazenda) => {
              // Normaliza: pode ser array ou objeto direto
              const fazendaRaw = uf.fazendas;
              const fazenda: FazendaData | null = Array.isArray(fazendaRaw)
                ? fazendaRaw[0]
                : fazendaRaw;

              if (!fazenda || !fazenda.id) return null;

              // Validate role
              const isValidRole = ["owner", "manager", "cowboy"].includes(
                uf.role,
              );
              if (!isValidRole) {
                if (import.meta.env.DEV) {
                  console.warn(
                    `[SelectFazenda] Invalid role for farm ${fazenda.id}: ${uf.role}`,
                  );
                }
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
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              );
            })
          )}

          {/* ✅ Add "Create Farm" button after list if user has permission */}
          {fazendas && fazendas.length > 0 && canCreateFarm === true && (
            <Card className="border-dashed">
              <CardContent className="p-4">
                <Button
                  onClick={() => navigate("/criar-fazenda")}
                  variant="outline"
                  className="w-full gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Criar Nova Fazenda
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <Button variant="ghost" className="w-full gap-2" onClick={signOut}>
          <LogOut className="h-4 w-4" /> Sair da conta
        </Button>
      </div>
    </div>
  );
};

export default SelectFazenda;
