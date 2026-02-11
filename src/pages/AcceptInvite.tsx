import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

interface InvitePreview {
  fazenda_nome: string;
  role: string;
  inviter_nome: string;
  expires_at: string;
  status: string;
  is_valid: boolean;
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
      setError("Invalid invite link");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase.rpc("get_invite_preview", {
        _token: token,
      });

      if (error) throw error;

      // RPC returns null if invite not found
      if (!data) {
        throw new Error("Invite not found");
      }

      setInvite(data);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadInvite();
  }, [loadInvite]);

  const handleAccept = async () => {
    // Check if user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Autenticação necessária",
        description: "Por favor faça login para aceitar este convite",
        variant: "destructive",
      });
      // Redirect to login with return URL
      navigate(`/login?redirect=/invites/${token}`);
      return;
    }

    setIsProcessing(true);
    try {
      console.log("[AcceptInvite] Accepting invite:", token);
      const { data: fazendaId, error } = await supabase.rpc("accept_invite", {
        _token: token,
      });

      if (error) {
        console.error("[AcceptInvite] Error accepting invite:", error);

        // ✅ P0: User-friendly error messages for common cases
        if (error.message?.toLowerCase().includes("email does not match")) {
          throw new Error(
            "Este convite é para outro email. Por favor, saia e entre com o email correto do convite.",
          );
        }

        if (error.message?.toLowerCase().includes("phone does not match")) {
          throw new Error(
            "Seu telefone não corresponde ao telefone do convite. Atualize seu telefone no Perfil ou entre em contato com quem enviou o convite.",
          );
        }

        if (error.message?.toLowerCase().includes("already a member")) {
          throw new Error("Você já é membro desta fazenda.");
        }

        if (error.message?.toLowerCase().includes("expired")) {
          throw new Error("Este convite expirou. Solicite um novo convite.");
        }

        throw error;
      }

      console.log("[AcceptInvite] Invite accepted, fazenda:", fazendaId);

      toast({
        title: "Sucesso!",
        description: "Você entrou na fazenda",
      });

      // Redirect to home
      navigate("/home");
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast({
        title: "Error",
        description: err.message,
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
        title: "Convite rejeitado",
        description: "Você recusou este convite",
      });

      // Redirect to home or index
      navigate("/");
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-destructive">
              Convite Não Encontrado
            </CardTitle>
            <CardDescription>
              {error || "Este link de convite é inválido"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/")} className="w-full">
              Ir para Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invite.is_valid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-destructive">Convite Expirado</CardTitle>
            <CardDescription>
              Este convite expirou ou já foi utilizado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p>
                <strong>Fazenda:</strong> {invite.fazenda_nome}
              </p>
              <p>
                <strong>Status:</strong> <Badge>{invite.status}</Badge>
              </p>
            </div>
            <Button onClick={() => navigate("/")} className="w-full mt-4">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Você Foi Convidado!</CardTitle>
          <CardDescription>
            Você foi convidado para entrar em uma fazenda no RebanhoSync
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-muted-foreground">
                Fazenda
              </span>
              <span className="font-semibold">{invite.fazenda_nome}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-muted-foreground">
                Função
              </span>
              <Badge className="capitalize">{invite.role}</Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-muted-foreground">
                Convidado por
              </span>
              <span>{invite.inviter_nome}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium text-muted-foreground">
                Expira
              </span>
              <span className="text-sm">{formatDate(invite.expires_at)}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleAccept}
              disabled={isProcessing}
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Aceitar
                </>
              )}
            </Button>
            <Button
              onClick={handleReject}
              disabled={isProcessing}
              variant="outline"
              className="flex-1"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Recusar
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvite;
