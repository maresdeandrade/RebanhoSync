import { useState } from "react";
import { Check, Copy, Link2, Mail, Phone } from "lucide-react";

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
import { Input } from "@/components/ui/input";
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

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fazendaId: string;
  callerRole: Role;
  onSuccess: () => void;
}

export const InviteMemberDialog = ({
  open,
  onOpenChange,
  fazendaId,
  callerRole,
  onSuccess,
}: InviteMemberDialogProps) => {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("cowboy");
  const [isLoading, setIsLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const resetState = () => {
    setEmail("");
    setPhone("");
    setRole("cowboy");
    setInviteLink(null);
    setCopied(false);
  };

  const handleSubmit = async () => {
    if (!email.trim() && !phone.trim()) {
      toast({
        title: "Contato obrigatorio",
        description: "Informe email ou telefone para gerar o convite.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc("create_invite", {
        _fazenda_id: fazendaId,
        _email: email.trim() || null,
        _phone: phone.trim() || null,
        _role: role,
      });

      if (error) throw error;

      const token = data.token;
      const link = `${window.location.origin}/invites/${token}`;
      setInviteLink(link);

      toast({
        title: "Convite criado",
        description: "Compartilhe o link com a pessoa convidada.",
      });

      onSuccess();
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast({
        title: "Erro ao criar convite",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast({
        title: "Link copiado",
        description: "O convite foi copiado para a area de transferencia.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Falha ao copiar",
        description: "Nao foi possivel copiar o link do convite.",
        variant: "destructive",
      });
    }
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetState();
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Convidar membro</DialogTitle>
          <DialogDescription>
            Gere um convite com papel definido e envie o link por email, telefone
            ou outro canal da rotina.
          </DialogDescription>
        </DialogHeader>

        {!inviteLink ? (
          <div className="space-y-4">
            <FormSection
              title="Contato e permissao"
              description="Basta um contato valido. O papel define o nivel de acesso assim que o convite for aceito."
              contentClassName="space-y-4"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="membro@fazenda.com"
                      className="pl-9"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invite-phone">Telefone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="invite-phone"
                      type="tel"
                      placeholder="+55 11 99999-9999"
                      className="pl-9"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                <div className="space-y-2">
                  <Label>Papel inicial</Label>
                  <Select
                    value={role}
                    onValueChange={(value) => setRole(value as Role)}
                  >
                    <SelectTrigger>
                      <SelectValue />
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

                <div className="flex flex-wrap gap-2">
                  <StatusBadge tone="neutral">{role}</StatusBadge>
                  <StatusBadge tone="info">Expira em 7 dias</StatusBadge>
                </div>
              </div>
            </FormSection>
          </div>
        ) : (
          <FormSection
            title="Convite pronto"
            description="Use o link abaixo para compartilhar o acesso. O membro entra direto no fluxo de aceite."
            actions={<StatusBadge tone="success">Link gerado</StatusBadge>}
            contentClassName="space-y-4"
          >
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <Label htmlFor="invite-link">Link do convite</Label>
              <div className="mt-2 flex gap-2">
                <div className="relative flex-1">
                  <Link2 className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                  <Input id="invite-link" value={inviteLink} readOnly className="pl-9" />
                </div>
                <Button variant="outline" onClick={handleCopyLink}>
                  {copied ? (
                    <Check className="mr-2 h-4 w-4" />
                  ) : (
                    <Copy className="mr-2 h-4 w-4" />
                  )}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
            </div>
          </FormSection>
        )}

        <DialogFooter>
          {!inviteLink ? (
            <>
              <Button variant="outline" onClick={() => handleClose(false)} disabled={isLoading}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? "Gerando..." : "Gerar convite"}
              </Button>
            </>
          ) : (
            <Button onClick={() => handleClose(false)}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
