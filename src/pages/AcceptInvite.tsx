import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  CheckCircle,
  Clock3,
  Loader2,
  UserRound,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { PageIntro } from "@/components/ui/page-intro";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

interface InvitePreview {
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

const roleMetricToneMap: Record<string, "success" | "info" | "default"> = {
  owner: "success",
  manager: "info",
  cowboy: "default",
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
    return "Seu telefone nao corresponde ao telefone informado no convite. Atualize seu perfil ou fale com quem enviou o convite.";
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
      if (!data) {
        throw new Error("Convite nao encontrado.");
      }

      setInvite(data);
      setError(null);
    } catch (previewError: unknown) {
      const normalized =
        previewError instanceof Error
          ? previewError
          : new Error(String(previewError));
      setError(normalized.message);
      setInvite(null);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadInvite();
  }, [loadInvite]);

  const handleAccept = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast({
        title: "Autenticacao necessaria",
        description: "Faca login para aceitar este convite.",
        variant: "destructive",
      });
      navigate(`/login?redirect=/invites/${token}`);
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

      toast({
        title: "Convite aceito",
        description: "Voce entrou na fazenda com sucesso.",
      });
      navigate("/home");
    } catch (acceptError: unknown) {
      const normalized =
        acceptError instanceof Error
          ? acceptError
          : new Error(String(acceptError));
      toast({
        title: "Nao foi possivel aceitar o convite",
        description: normalized.message,
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
        description: "O convite foi recusado e nao aparecera mais como pendente.",
      });
      navigate("/");
    } catch (rejectError: unknown) {
      const normalized =
        rejectError instanceof Error
          ? rejectError
          : new Error(String(rejectError));
      toast({
        title: "Nao foi possivel recusar o convite",
        description: normalized.message,
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
        <div className="mx-auto max-w-3xl space-y-6">
          <PageIntro
            eyebrow="Convite"
            title="Convite indisponivel"
            description={error || "Este link de convite nao esta mais disponivel."}
            meta={<StatusBadge tone="danger">Convite invalido</StatusBadge>}
            actions={
              <Button onClick={() => navigate("/")}>
                Voltar para o inicio
              </Button>
            }
          />
          <Card>
            <CardContent className="p-5 text-sm text-muted-foreground">
              Confira se o link foi copiado corretamente ou solicite um novo convite ao responsavel pela fazenda.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!invite.is_valid) {
    return (
      <div className="min-h-screen bg-muted/20 px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <PageIntro
            eyebrow="Convite"
            title="Convite expirado ou ja utilizado"
            description="Este link nao pode mais ser usado. Se ainda precisar acessar a fazenda, solicite um novo convite."
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

          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard
              label="Fazenda"
              value={invite.fazenda_nome}
              hint="Operacao vinculada a este convite."
            />
            <MetricCard
              label="Perfil"
              value={roleLabelMap[invite.role] ?? invite.role}
              hint="Papel previsto para este acesso."
              tone={roleMetricToneMap[invite.role] ?? "default"}
            />
            <MetricCard
              label="Expiracao"
              value={formatDate(invite.expires_at)}
              hint="O convite precisa ser reemitido depois desse prazo."
              icon={<Clock3 className="h-5 w-5" />}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <PageIntro
          eyebrow="Convite"
          title="Voce foi convidado para entrar em uma fazenda"
          description="Revise a operacao, o papel e o responsavel pelo convite antes de aceitar. O acesso entra no mesmo fluxo seguro de membership."
          meta={
            <>
              <StatusBadge tone={roleToneMap[invite.role] ?? "neutral"}>
                {roleLabelMap[invite.role] ?? invite.role}
              </StatusBadge>
              <StatusBadge tone="info">{invite.fazenda_nome}</StatusBadge>
              <StatusBadge tone="neutral">Expira em {formatDate(invite.expires_at)}</StatusBadge>
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

        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard
            label="Fazenda"
            value={invite.fazenda_nome}
            hint="Operacao que sera adicionada a sua conta."
          />
          <MetricCard
            label="Papel"
            value={roleLabelMap[invite.role] ?? invite.role}
            hint="Permissoes previstas para sua rotina dentro da fazenda."
            tone={roleMetricToneMap[invite.role] ?? "default"}
          />
          <MetricCard
            label="Convidado por"
            value={invite.inviter_nome}
            hint="Responsavel que compartilhou este acesso."
            icon={<UserRound className="h-5 w-5" />}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Antes de confirmar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Se voce ainda nao estiver autenticado, o sistema pedira login antes de concluir o aceite.</p>
            <p>Ao aceitar, a fazenda passa a fazer parte da sua conta e podera ser selecionada no fluxo operacional.</p>
            <p>Se o convite tiver sido enviado para outro e-mail ou telefone, use a conta correta para evitar rejeicao de seguranca.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AcceptInvite;
