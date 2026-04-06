import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface Member {
  user_id: string;
  display_name: string;
}

interface RemoveMemberDialogProps {
  member: Member | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fazendaId: string;
  onSuccess: () => void;
}

export const RemoveMemberDialog = ({
  member,
  open,
  onOpenChange,
  fazendaId,
  onSuccess,
}: RemoveMemberDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleRemove = async () => {
    if (!member) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.rpc("admin_remove_member", {
        _fazenda_id: fazendaId,
        _target_user_id: member.user_id,
      });

      if (error) throw error;

      toast({
        title: "Membro removido",
        description: `${member.display_name} perdeu acesso a esta fazenda.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast({
        title: "Erro ao remover membro",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover acesso de {member?.display_name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Essa acao encerra o acesso deste membro a fazenda atual. Use apenas
            quando o convite ou o vinculo nao devem continuar ativos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleRemove}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? "Removendo..." : "Confirmar remocao"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
