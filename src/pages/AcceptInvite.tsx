import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/ui/page-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { getInviteAuthPath } from "@/lib/auth/inviteRedirect";
import { useAuth } from "@/hooks/useAuth";
import { authOperationError } from "@/lib/auth/errorMessage";

interface InvitePreview {
  fazenda_id: string;
  fazenda_nome: string;
  role: string;
  inviter_nome: string;
  expires_at: string;
  status: string;
  is_valid: boolean;
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

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("pt-BR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function normalizeAcceptError(message?: string) {
  const normalized = message?.toLowerCase() ?? "";

  if (normalized.includes("email does not match")) {
    return "Este convite foi enviado para outro e-mail. Saia da conta atual e entre com o e-mail correto do convite.";
  }

  if (normalized.includes("phone does not match")) {
    return "Seu telefone nao corresponde ao convite. Entre com a conta que possui o telefone destinatario verificado ou solicite um convite para seu email.";
  }

  if (normalized.includes("already a member")) {
    return "Voce ja faz parte desta fazenda.";
  }

  if (normalized.includes("expired")) {
    return "Este convite expirou. Solicite um novo convite.";
  }

  return message || "Nao foi possivel concluir este convite.";
}

export const AcceptInvite = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { setActiveFarm } = useAuth();

  const loadInvite = useCallback(async () => {
    if (!token) {
      setError("Link de convite invalido.");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase.rpc("get_invite_preview", {
        _token: token,
      });

      if (error) throw error;
      if (!Array.isArray(data) || data.length !== 1) {
        throw new Error("Convite nao encontrado.");
      }
      const preview = data[0] as InvitePreview;
      if (!preview.fazenda_id || typeof preview.is_valid !== "boolean") throw new Error("Resposta de convite invalida.");
      setInvite(preview);
      setError(null);
    } catch (previewError: unknown) {
      setError(authOperationError(previewError, "Nao foi possivel carregar este convite."));
      setInvite(null);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadInvite();
  }, [loadInvite]);

  const handleAccept = async () => {
    if (isProcessing || !invite) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast({
        title: "Autenticacao necessaria",
        description: "Faca login para aceitar este convite.",
        variant: "destructive",
      });
      navigate(
        getInviteAuthPath(
          "login",
          new URLSearchParams({
            redirect: `/invites/${token}`,
          }).toString(),
        ),
      );
      return;
    }

    setIsProcessing(true);
    try {
      const { error } = await supabase.rpc("accept_invite", {
        _token: token,
      });

      if (error) {
        throw new Error(normalizeAcceptError(error.message));
      }

      await setActiveFarm(invite.fazenda_id);

      toast({
        title: "Convite aceito",
        description: "Voce entrou na fazenda com sucesso.",
      });
      navigate("/home");
    } catch (acceptError: unknown) {
      toast({
        title: "Nao foi possivel aceitar o convite",
        description: authOperationError(acceptError, "Nao foi possivel aceitar o convite."),
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase.rpc("reject_invite", {
        _token: token,
      });

      if (error) throw error;

      toast({
        title: "Convite recusado",
        description:
          "O convite foi recusado e nao aparecera mais como pendente.",
      });
      navigate("/");
    } catch (rejectError: unknown) {
      toast({
        title: "Nao foi possivel recusar o convite",
        description: authOperationError(rejectError, "Nao foi possivel recusar o convite."),
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen bg-muted/20 px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-5">
          <PageIntro
            variant="plain"
            eyebrow="Convite"
            title="Convite indisponivel"
            description={error || undefined}
            meta={<StatusBadge tone="danger">Convite invalido</StatusBadge>}
            actions={
              <>
                <Button onClick={() => void loadInvite()}>Tentar novamente</Button>
                <Button variant="outline" onClick={() => navigate(getInviteAuthPath("login", new URLSearchParams({ redirect: `/invites/${token}` }).toString()))}>Entrar para continuar</Button>
              </>
            }
          />
        </div>
      </div>
    );
  }

  if (!invite.is_valid) {
    return (
      <div className="min-h-screen bg-muted/20 px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-5">
          <PageIntro
            variant="plain"
            eyebrow="Convite"
            title={invite.status === "accepted" ? "Convite ja utilizado" : invite.status === "cancelled" ? "Convite cancelado" : invite.status === "rejected" ? "Convite recusado" : "Convite expirado"}
            meta={
              <>
                <StatusBadge tone="danger">{invite.status}</StatusBadge>
                <StatusBadge tone="neutral">{invite.fazenda_nome}</StatusBadge>
              </>
            }
            actions={
              <Button onClick={() => navigate("/")}>
                Voltar para o inicio
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <PageIntro
          variant="plain"
          eyebrow="Convite"
          title="Entrar na fazenda"
          meta={
            <>
              <StatusBadge tone={roleToneMap[invite.role] ?? "neutral"}>
                {roleLabelMap[invite.role] ?? invite.role}
              </StatusBadge>
              <StatusBadge tone="info">{invite.fazenda_nome}</StatusBadge>
              <StatusBadge tone="neutral">
                Expira em {formatDate(invite.expires_at)}
              </StatusBadge>
              <StatusBadge tone="neutral">Por {invite.inviter_nome}</StatusBadge>
            </>
          }
          actions={
            <>
              <Button onClick={handleAccept} disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Aceitar convite
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    Recusar por agora
                  </>
                )}
              </Button>
            </>
          }
        />
      </div>
    </div>
  );
};

export default AcceptInvite;
