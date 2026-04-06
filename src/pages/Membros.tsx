import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/ui/metric-card";
import { PageIntro } from "@/components/ui/page-intro";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Toolbar, ToolbarGroup } from "@/components/ui/toolbar";
import { useToast } from "@/hooks/use-toast";
import {
  Copy,
  Loader2,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Phone as PhoneIcon,
  Shield,
  UserPlus,
  Users,
} from "lucide-react";
import { InviteMemberDialog } from "@/components/members/InviteMemberDialog";
import { MemberRoleDialog } from "@/components/members/MemberRoleDialog";
import { PendingInvites } from "@/components/members/PendingInvites";
import { RemoveMemberDialog } from "@/components/members/RemoveMemberDialog";
import { RoleBadge } from "@/components/members/RoleBadge";

type Role = "owner" | "manager" | "cowboy";
type MemberStatus = "active" | "pending" | "inactive";

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

function getStatus(member: Member): MemberStatus {
  if (member.deleted_at) return "inactive";
  if (!member.accepted_at) return "pending";
  return "active";
}

function getStatusTone(status: MemberStatus) {
  if (status === "active") return "success";
  if (status === "pending") return "warning";
  return "danger";
}

export default function Membros() {
  const { activeFarmId, role: userRole } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | MemberStatus>("all");
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [removingMember, setRemovingMember] = useState<Member | null>(null);
  const { toast } = useToast();

  const role: Role =
    userRole === "owner" || userRole === "manager" || userRole === "cowboy"
      ? userRole
      : "cowboy";

  const loadMembers = useCallback(async () => {
    if (!activeFarmId) return;

    setIsLoading(true);
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
      toast({
        title: "Erro ao carregar membros",
        description: membersError.message,
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    const transformedMembers: Member[] = (membersData || []).map(
      (item: Record<string, unknown>) => ({
        user_id: item.user_id as string,
        fazenda_id: item.fazenda_id as string,
        role: item.role as Role,
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

    if (transformedMembers.length > 0) {
      const userIds = transformedMembers.map((member) => member.user_id);
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
      void loadMembers();
    }
  }, [activeFarmId, loadMembers]);

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleCopyText = async (
    value: string,
    title: string,
    description: string,
  ) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title, description });
    } catch {
      toast({
        title: "Erro",
        description: "Nao foi possivel copiar o conteudo.",
        variant: "destructive",
      });
    }
  };

  const handleOpenWhatsApp = (phone: string | null) => {
    if (!phone) {
      toast({
        title: "Telefone indisponivel",
        description: "Este membro nao possui telefone informado.",
        variant: "destructive",
      });
      return;
    }

    const cleanPhone = phone.replace(/\D/g, "");
    const formattedPhone = cleanPhone.startsWith("55")
      ? cleanPhone
      : `55${cleanPhone}`;
    window.open(`https://wa.me/${formattedPhone}`, "_blank");
  };

  const canManageMembers = role === "owner" || role === "manager";

  const counts = useMemo(() => {
    return members.reduce(
      (summary, member) => {
        summary.total += 1;
        summary[getStatus(member)] += 1;
        return summary;
      },
      { total: 0, active: 0, pending: 0, inactive: 0 },
    );
  }, [members]);

  const filteredMembers = useMemo(() => {
    const searchLower = searchTerm.trim().toLowerCase();
    return members.filter((member) => {
      const memberStatus = getStatus(member);
      if (statusFilter !== "all" && memberStatus !== statusFilter) return false;

      if (!searchLower) return true;
      return [
        member.display_name ?? "",
        member.role,
        member.email ?? "",
        member.phone ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(searchLower);
    });
  }, [members, searchTerm, statusFilter]);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Equipe"
        title="Pessoas e convites da fazenda"
        description="Gestao de acesso com leitura mais limpa: o membro aparece primeiro, e os comandos secundarios ficam concentrados no menu contextual."
        meta={
          <>
            <StatusBadge tone="neutral">{counts.total} pessoa(s)</StatusBadge>
            <StatusBadge tone="success">{counts.active} ativa(s)</StatusBadge>
            <StatusBadge tone="warning">{counts.pending} convite(s)</StatusBadge>
          </>
        }
        actions={
          canManageMembers ? (
            <Button onClick={() => setShowInviteDialog(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Convidar membro
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Ativos"
          value={counts.active}
          hint="Membros que ja aceitaram e podem operar na fazenda."
          tone="success"
          icon={<Users className="h-5 w-5" />}
        />
        <MetricCard
          label="Pendentes"
          value={counts.pending}
          hint="Convites aguardando aceite."
          tone="warning"
          icon={<Mail className="h-5 w-5" />}
        />
        <MetricCard
          label="Inativos"
          value={counts.inactive}
          hint="Vinculos encerrados ou removidos."
          tone={counts.inactive > 0 ? "danger" : "default"}
          icon={<Shield className="h-5 w-5" />}
        />
      </div>

      <Toolbar>
        <ToolbarGroup className="flex-1 gap-2">
          <div className="min-w-0 flex-1">
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por nome, email, telefone ou papel"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as "all" | MemberStatus)}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </ToolbarGroup>

        <ToolbarGroup className="gap-2">
          <StatusBadge tone="info">
            {filteredMembers.length} no recorte atual
          </StatusBadge>
        </ToolbarGroup>
      </Toolbar>

      {isLoading ? (
        <Card className="shadow-none">
          <CardContent className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando equipe.
          </CardContent>
        </Card>
      ) : filteredMembers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum membro neste recorte"
          description={
            searchTerm || statusFilter !== "all"
              ? "Ajuste a busca ou o filtro para ver a equipe."
              : "Convide a primeira pessoa para compartilhar a rotina operacional."
          }
          action={
            canManageMembers
              ? {
                  label: "Convidar membro",
                  onClick: () => setShowInviteDialog(true),
                }
              : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredMembers.map((member) => {
            const status = getStatus(member);
            const memberName = member.display_name || "Nome nao informado";
            const canEditRole =
              canManageMembers && status === "active" && member.role !== "owner";
            const canRemoveMember = canManageMembers && status === "pending";

            return (
              <Card key={member.user_id} className="shadow-none">
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    <Avatar className="h-11 w-11 border border-border/70">
                      <AvatarImage src="" />
                      <AvatarFallback className="bg-secondary text-secondary-foreground">
                        {getInitials(member.display_name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium text-foreground">{memberName}</p>
                        <RoleBadge role={member.role} />
                        <StatusBadge tone={getStatusTone(status)}>
                          {status === "active"
                            ? "Ativo"
                            : status === "pending"
                              ? "Pendente"
                              : "Inativo"}
                        </StatusBadge>
                      </div>

                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5" />
                          {member.email || member.user_id}
                        </span>
                        {member.phone ? (
                          <span className="flex items-center gap-1.5">
                            <PhoneIcon className="h-3.5 w-3.5" />
                            {member.phone}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" aria-label="Acoes do membro">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          handleCopyText(
                            member.email || member.user_id,
                            "Email copiado",
                            "O contato foi copiado para a area de transferencia.",
                          )
                        }
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copiar email
                      </DropdownMenuItem>
                      {member.phone ? (
                        <DropdownMenuItem
                          onClick={() =>
                            handleCopyText(
                              member.phone!,
                              "Telefone copiado",
                              "O telefone foi copiado para a area de transferencia.",
                            )
                          }
                        >
                          <PhoneIcon className="mr-2 h-4 w-4" />
                          Copiar telefone
                        </DropdownMenuItem>
                      ) : null}
                      {member.phone ? (
                        <DropdownMenuItem onClick={() => handleOpenWhatsApp(member.phone)}>
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Abrir WhatsApp
                        </DropdownMenuItem>
                      ) : null}
                      {canEditRole || canRemoveMember ? <DropdownMenuSeparator /> : null}
                      {canEditRole ? (
                        <DropdownMenuItem onClick={() => setEditingMember(member)}>
                          <Shield className="mr-2 h-4 w-4" />
                          Ajustar papel
                        </DropdownMenuItem>
                      ) : null}
                      {canRemoveMember ? (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setRemovingMember(member)}
                        >
                          <UserPlus className="mr-2 h-4 w-4 rotate-45" />
                          Remover convite
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {activeFarmId ? (
        <PendingInvites fazendaId={activeFarmId} onUpdate={loadMembers} />
      ) : null}

      {activeFarmId ? (
        <InviteMemberDialog
          open={showInviteDialog}
          onOpenChange={setShowInviteDialog}
          fazendaId={activeFarmId}
          callerRole={role}
          onSuccess={loadMembers}
        />
      ) : null}

      {activeFarmId && editingMember ? (
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
      ) : null}

      {activeFarmId && removingMember ? (
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
      ) : null}
    </div>
  );
}
