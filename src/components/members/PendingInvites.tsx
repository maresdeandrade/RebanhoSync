import { useCallback, useEffect, useState } from "react";
import { Check, Copy, MoreHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface PendingInvite {
  id: string;
  email: string | null;
  phone: string | null;
  role: string;
  token: string;
  expires_at: string;
  created_at: string;
}

interface PendingInvitesProps {
  fazendaId: string;
  onUpdate: () => void;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("pt-BR");
}

function isExpired(expiresAt: string) {
  return new Date(expiresAt) < new Date();
}

export const PendingInvites = ({ fazendaId, onUpdate }: PendingInvitesProps) => {
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchInvites = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("farm_invites")
        .select("id, email, phone, role, token, expires_at, created_at")
        .eq("fazenda_id", fazendaId)
        .eq("status", "pending")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInvites(data || []);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast({
        title: "Erro ao carregar convites",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [fazendaId, toast]);

  useEffect(() => {
    void fetchInvites();
  }, [fetchInvites]);

  const handleCancelInvite = async (inviteId: string) => {
    try {
      const { error } = await supabase.rpc("cancel_invite", {
        _invite_id: inviteId,
      });

      if (error) throw error;

      toast({
        title: "Convite cancelado",
        description: "O link deixou de ser valido para esta fazenda.",
      });

      await fetchInvites();
      onUpdate();
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast({
        title: "Erro ao cancelar convite",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleCopyLink = async (token: string, id: string) => {
    const link = `${window.location.origin}/invites/${token}`;

    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(id);
      toast({
        title: "Link copiado",
        description: "O convite foi copiado para a area de transferencia.",
      });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast({
        title: "Falha ao copiar",
        description: "Nao foi possivel copiar o link do convite.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card className="shadow-none">
        <CardContent className="py-6 text-sm text-muted-foreground">
          Carregando convites pendentes.
        </CardContent>
      </Card>
    );
  }

  if (invites.length === 0) {
    return null;
  }

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Convites pendentes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {invites.map((invite) => {
          const expired = isExpired(invite.expires_at);
          const contact = invite.email || invite.phone || "Contato nao informado";

          return (
            <div
              key={invite.id}
              className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium text-foreground">{contact}</p>
                  <StatusBadge tone={expired ? "danger" : "neutral"}>
                    {expired ? "Expirado" : "Pendente"}
                  </StatusBadge>
                  <StatusBadge tone="info">{invite.role}</StatusBadge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Criado em {formatDate(invite.created_at)} · expira em{" "}
                  {formatDate(invite.expires_at)}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyLink(invite.token, invite.id)}
                  disabled={expired}
                >
                  {copiedId === invite.id ? (
                    <Check className="mr-2 h-4 w-4" />
                  ) : (
                    <Copy className="mr-2 h-4 w-4" />
                  )}
                  {copiedId === invite.id ? "Copiado" : "Copiar link"}
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" aria-label="Acoes do convite">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleCopyLink(invite.token, invite.id)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar link
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => handleCancelInvite(invite.id)}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cancelar convite
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
