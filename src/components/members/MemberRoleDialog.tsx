import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormSection } from "@/components/ui/form-section";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

type Role = "owner" | "manager" | "cowboy";

interface Member {
  user_id: string;
  display_name: string;
  role: Role;
}

interface MemberRoleDialogProps {
  member: Member | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fazendaId: string;
  callerRole: Role;
  onSuccess: () => void;
}

export const MemberRoleDialog = ({
  member,
  open,
  onOpenChange,
  fazendaId,
  callerRole,
  onSuccess,
}: MemberRoleDialogProps) => {
  const [newRole, setNewRole] = useState<Role | "">("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleChangeRole = async () => {
    if (!member || !newRole) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.rpc("admin_set_member_role", {
        _fazenda_id: fazendaId,
        _target_user_id: member.user_id,
        _new_role: newRole,
      });

      if (error) throw error;

      toast({
        title: "Papel atualizado",
        description: `${member.display_name} agora esta como ${newRole}.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast({
        title: "Erro ao atualizar papel",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && member) {
      setNewRole(member.role);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Ajustar papel do membro</DialogTitle>
          <DialogDescription>
            Revise o papel atual e defina o nivel de acesso operacional deste
            membro na fazenda.
          </DialogDescription>
        </DialogHeader>

        <FormSection
          title={member?.display_name ?? "Membro"}
          description="Mudancas entram em vigor assim que o convite estiver aceito ou o membro ja estiver ativo."
          actions={
            member ? (
              <StatusBadge tone="neutral">Atual: {member.role}</StatusBadge>
            ) : null
          }
          contentClassName="space-y-4"
        >
          <div className="space-y-2">
            <Label>Novo papel</Label>
            <Select
              value={newRole}
              onValueChange={(value) => setNewRole(value as Role)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um papel" />
              </SelectTrigger>
              <SelectContent>
                {callerRole === "owner" ? (
                  <SelectItem value="owner">Owner</SelectItem>
                ) : null}
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="cowboy">Cowboy</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FormSection>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleChangeRole} disabled={isLoading || !newRole}>
            {isLoading ? "Salvando..." : "Salvar alteracao"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
