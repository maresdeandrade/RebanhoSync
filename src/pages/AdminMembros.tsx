import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserMinus, Shield } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";

const AdminMembros = () => {
  const { activeFarmId, user: currentUser } = useAuth();
  const [membros, setMembros] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMembros = async () => {
    if (!activeFarmId) return;
    const { data, error } = await supabase
      .from('user_fazendas')
      .select('user_id, role, user_profiles(display_name, phone)')
      .eq('fazenda_id', activeFarmId)
      .is('deleted_at', null);

    if (error) showError("Erro ao carregar membros");
    else setMembros(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadMembros();
  }, [activeFarmId]);

  const handleUpdateRole = async (userId: string, newRole: string) => {
    const { error } = await supabase.rpc('admin_set_member_role', {
      _fazenda_id: activeFarmId,
      _user_id: userId,
      _role: newRole
    });

    if (error) showError(error.message);
    else {
      showSuccess("Papel atualizado!");
      loadMembros();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Membros da Fazenda</h1>
        <Badge variant="outline" className="gap-1"><Shield className="h-3 w-3" /> Área Administrativa</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Equipe Ativa</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {membros.map((m) => (
                <TableRow key={m.user_id}>
                  <TableCell>
                    <p className="font-medium">{m.user_profiles?.display_name || 'Sem nome'}</p>
                    <p className="text-xs text-muted-foreground">{m.user_profiles?.phone || 'Sem telefone'}</p>
                  </TableCell>
                  <TableCell>
                    <Select 
                      disabled={m.user_id === currentUser?.id}
                      value={m.role} 
                      onValueChange={(val) => handleUpdateRole(m.user_id, val)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cowboy">Cowboy</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="owner">Owner</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-destructive"
                      disabled={m.user_id === currentUser?.id}
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminMembros;