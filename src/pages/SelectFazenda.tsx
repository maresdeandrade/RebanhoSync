import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, ChevronRight, LogOut } from "lucide-react";
import { useState } from "react";

// TYPE FIX: Define proper interface for user_fazendas query result
// Supabase nested select returns array: fazendas: [{id, nome}]
interface FazendaData {
  id: string;
  nome: string;
}

interface UserFazenda {
  fazendas: FazendaData[];
}

const SelectFazenda = () => {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(false);

  const fazendas = useLiveQuery(async () => {
    if (!user) return [];
    const { data } = await supabase
      .from('user_fazendas')
      .select('fazendas(id, nome)')
      .eq('user_id', user.id);
    return data || [];
  }, [user]);

  const handleSelect = async (fazenda_id: string) => {
    setLoading(true);
    localStorage.setItem('gestao_agro_active_fazenda_id', fazenda_id);
    window.location.href = '/home';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Selecionar Fazenda</h1>
          <p className="text-muted-foreground">
            {user?.email}
          </p>
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
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground mb-4">Você não está vinculado a nenhuma fazenda.</p>
                <Button variant="outline" onClick={signOut} className="w-full">Sair</Button>
              </CardContent>
            </Card>
          ) : (
            // TYPE FIX: Use proper UserFazenda type instead of any
            fazendas.map((f: UserFazenda) => {
              const fazenda = f.fazendas?.[0]; // Supabase returns array
              if (!fazenda) return null;
              
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
        </div>

        <Button variant="ghost" className="w-full gap-2" onClick={signOut}>
          <LogOut className="h-4 w-4" /> Sair da conta
        </Button>
      </div>
    </div>
  );
};

export default SelectFazenda;