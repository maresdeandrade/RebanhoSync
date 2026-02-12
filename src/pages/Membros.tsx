import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Copy,
  Loader2,
  Mail,
  MessageSquare,
  Phone as PhoneIcon,
  Shield,
  UserPlus,
  Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { InviteMemberDialog } from "@/components/members/InviteMemberDialog";
import { MemberRoleDialog } from "@/components/members/MemberRoleDialog";
import { RemoveMemberDialog } from "@/components/members/RemoveMemberDialog";
import { RoleBadge } from "@/components/members/RoleBadge";

type Role = "owner" | "manager" | "cowboy";

interface Member {
  user_id: string;
  fazenda_id: string;
  role: Role;
  accepted_at: string | null;
  deleted_at: string | null;
  display_name: string | null;
  phone: string | null;
  email?: string;
  created_at: string;
}

export default function Membros() {
  const { user, activeFarmId, role: userRole } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [removingMember, setRemovingMember] = useState<Member | null>(null);
  const { toast } = useToast();

  const role: Role =
    userRole === "cowboy" || userRole === "manager" || userRole === "owner"
      ? userRole
      : "cowboy";

  // Derivar status de accepted_at e deleted_at
  const getStatus = (member: Member): "active" | "pending" | "inactive" => {
    if (member.deleted_at) return "inactive";
    if (!member.accepted_at) return "pending";
    return "active";
  };

  const loadMembers = React.useCallback(async () => {
    if (!activeFarmId) return;

    // Carregar membros usando colunas existentes: accepted_at e deleted_at
    const { data: membersData, error: membersError } = await supabase
      .from("user_fazendas")
      .select(
        `
        user_id,
        fazenda_id,
        role,
        accepted_at,
        deleted_at,
        created_at,
        user_profiles!user_id(display_name, phone)
      `,
      )
      .eq("fazenda_id", activeFarmId);

    if (membersError) {
      console.error("Error loading members:", membersError);
      toast({
        title: "Erro ao carregar membros",
        description: membersError.message,
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    // Transformar dados básicos
    const transformedMembers: Member[] = (membersData || []).map(
      (item: Record<string, unknown>) => ({
        user_id: item.user_id as string,
        fazenda_id: item.fazenda_id as string,
        role: item.role as string as Role,
        accepted_at: item.accepted_at as string | null,
        deleted_at: item.deleted_at as string | null,
        created_at: item.created_at as string,
        display_name: (item.user_profiles as Record<string, unknown>)
          ?.display_name as string | null,
        phone: (item.user_profiles as Record<string, unknown>)?.phone as
          | string
          | null,
      }),
    );

    // Buscar emails usando RPC se houver membros
    if (transformedMembers.length > 0) {
      const userIds = transformedMembers.map((m) => m.user_id);
      const { data: emailsData } = await supabase.rpc("get_user_emails", {
        user_ids: userIds,
      });

      if (emailsData) {
        const emailMap = new Map<string, string>();
        emailsData.forEach((row: { user_id: string; email: string | null }) => {
          if (row.email) {
            emailMap.set(row.user_id, row.email);
          }
        });

        transformedMembers.forEach((member) => {
          member.email = emailMap.get(member.user_id) || undefined;
        });
      }
    }

    setMembers(transformedMembers);
    setIsLoading(false);
  }, [activeFarmId, toast]);

  useEffect(() => {
    if (activeFarmId) {
      loadMembers();
    }
  }, [activeFarmId, loadMembers]);

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleCopyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      toast({
        title: "Copiado",
        description: "Email copiado para a área de transferência",
      });
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível copiar o email",
        variant: "destructive",
      });
    }
  };

  const handleCopyPhone = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      toast({
        title: "Copiado",
        description: "Telefone copiado para a área de transferência",
      });
    } catch {
      toast({
        title: "Erro",
        description: "Não foi possível copiar o telefone",
        variant: "destructive",
      });
    }
  };

  const handleOpenWhatsApp = (phone: string | null) => {
    if (!phone) {
      toast({
        title: "Indisponível",
        description: "Este membro não possui telefone",
        variant: "destructive",
      });
      return;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    const formattedPhone = cleanPhone.startsWith("55")
      ? cleanPhone
      : "55" + cleanPhone;
    window.open(`https://wa.me/${formattedPhone}`, "_blank");
  };

  const canManageMembers = role === "owner" || role === "manager";

  const filteredMembers = members.filter(
    (m) =>
      m.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.email?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Equipe</h1>
          <p className="text-muted-foreground">
            Gerencie os membros da sua fazenda
          </p>
        </div>
        {canManageMembers && (
          <Button onClick={() => setShowInviteDialog(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Convidar Membro
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Membros da Equipe
          </CardTitle>
          <CardDescription>Total de membros: {members.length}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Buscar membros..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "Nenhum membro encontrado" : "Nenhum membro ainda"}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredMembers.map((member) => {
                const status = getStatus(member);
                return (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarImage src="" />
                        <AvatarFallback className="bg-primary/10">
                          {getInitials(member.display_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {member.display_name || "Nome não informado"}
                          </span>
                          <RoleBadge role={member.role} />
                          {status === "pending" && (
                            <Badge variant="secondary">Pendente</Badge>
                          )}
                          {status === "inactive" && (
                            <Badge variant="destructive">Inativo</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {member.email || member.user_id}
                          </span>
                          {member.phone && (
                            <span className="flex items-center gap-1">
                              <PhoneIcon className="h-3 w-3" />
                              {member.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          handleCopyEmail(member.email || member.user_id)
                        }
                        title="Copiar email"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      {member.phone && (
                        <>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleCopyPhone(member.phone)}
                            title="Copiar telefone"
                          >
                            <PhoneIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleOpenWhatsApp(member.phone)}
                            title="Abrir WhatsApp"
                            className="text-green-600 hover:text-green-700"
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>
                        </>
                      )}

                      {canManageMembers &&
                        status === "active" &&
                        member.role !== "owner" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingMember(member)}
                          >
                            <Shield className="mr-2 h-4 w-4" />
                            Editar Cargo
                          </Button>
                        )}
                      {canManageMembers && status === "pending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600"
                          onClick={() => setRemovingMember(member)}
                        >
                          Remover
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {activeFarmId && (
        <InviteMemberDialog
          open={showInviteDialog}
          onOpenChange={setShowInviteDialog}
          fazendaId={activeFarmId}
          callerRole={role}
          onSuccess={loadMembers}
        />
      )}

      {activeFarmId && editingMember && (
        <MemberRoleDialog
          member={{
            user_id: editingMember.user_id,
            display_name: editingMember.display_name || "Membro",
            role: editingMember.role,
          }}
          open={!!editingMember}
          onOpenChange={(open) => !open && setEditingMember(null)}
          fazendaId={activeFarmId}
          callerRole={role}
          onSuccess={loadMembers}
        />
      )}

      {activeFarmId && removingMember && (
        <RemoveMemberDialog
          member={{
            user_id: removingMember.user_id,
            display_name: removingMember.display_name || "Membro",
          }}
          open={!!removingMember}
          onOpenChange={(open) => !open && setRemovingMember(null)}
          fazendaId={activeFarmId}
          onSuccess={loadMembers}
        />
      )}
    </div>
  );
}
