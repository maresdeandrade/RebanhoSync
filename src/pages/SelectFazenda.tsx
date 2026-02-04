import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, ChevronRight, LogOut } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";

const SelectFazenda = () => {
  const { user, refreshSettings, signOut } = useAuth();
  const [fazendas, setFazendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadFazendas = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('user_fazendas')
        .select('role, fazendas(id, nome, municipio)')
        .eq('user_id', user.id)
        .is('deleted_at', null);

      if (error) showError("Erro ao carregar fazendas");
      else setFazendas(data || []);
      setLoading(false);
    };
    loadFazendas();
  }, [user]);

  const handleSelect = async (fazendaId: string) => {
    const { error } = await supabase
      .from('user_settings')
      .upsert({ 
        user_id: user?.id, 
        active_fazenda_id: fazendaId,
        updated_at: new Date().toISOString()
      });

    if (error) showError("Erro ao definir fazenda ativa");
    else {
      await refreshSettings();
      showSuccess("Fazenda selecionada!");
      navigate("/home");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Suas Fazendas</h1>
          <p className="text-muted-foreground">Selecione a fazenda para trabalhar hoje</p>
        </div>

        <div className="grid gap-3">
          {loading ? (
            <p className="text-center py-8">Carregando...</p>
          ) : fazendas.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground mb-4">Você não está vinculado a nenhuma fazenda.</p>
                <Button variant="outline" onClick={signOut} className="w-full">Sair</Button>
              </CardContent>
            </Card>
          ) : (
            fazendas.map((f: any) => (
              <Card 
                key={f.fazendas.id} 
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => handleSelect(f.fazendas.id)}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-bold">{f.fazendas.nome}</p>
                      <p className="text-xs text-muted-foreground">{f.fazendas.municipio} • {f.role}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            ))
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