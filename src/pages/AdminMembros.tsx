import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { RoleBadge } from '@/components/members/RoleBadge';
import { MemberRoleDialog } from '@/components/members/MemberRoleDialog';
import { RemoveMemberDialog } from '@/components/members/RemoveMemberDialog';
import { InviteMemberDialog } from '@/components/members/InviteMemberDialog';
import { PendingInvites } from '@/components/members/PendingInvites';
import { Settings, UserMinus, UserPlus } from 'lucide-react';

type Role = 'owner' | 'manager' | 'cowboy';

interface Member {
  user_id: string;
  role: Role;
  accepted_at: string | null;
  user_profiles: {
    display_name: string;
    phone: string | null;
  } | null;
}

export const AdminMembros = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFarmId, setActiveFarmId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<Role | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const { toast } = useToast();

  const fetchMembers = async () => {
    try {
      setIsLoading(true);

      // Get active farm from user_settings
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: settings } = await supabase
        .from('user_settings')
        .select('active_fazenda_id')
        .eq('user_id', user.id)
        .single();

      if (!settings?.active_fazenda_id) {
        throw new Error('No active farm selected');
      }

      setActiveFarmId(settings.active_fazenda_id);

      // Get current user's role
      const { data: myMembership } = await supabase
        .from('user_fazendas')
        .select('role')
        .eq('user_id', user.id)
        .eq('fazenda_id', settings.active_fazenda_id)
        .is('deleted_at', null)
        .single();

      setCurrentUserRole(myMembership?.role as Role || null);

      // Fetch all members of the farm
      const { data, error } = await supabase
        .from('user_fazendas')
        .select(`
          user_id,
          role,
          accepted_at,
          user_profiles!inner (
            display_name,
            phone
          )
        `)
        .eq('fazenda_id', settings.active_fazenda_id)
        .is('deleted_at', null)
        .order('accepted_at', { ascending: true });

      if (error) throw error;

      setMembers(data as Member[]);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast({
        title: 'Error loading members',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const canManage = currentUserRole === 'owner' || currentUserRole === 'manager';
  const canRemove = currentUserRole === 'owner';

  const handleOpenRoleDialog = (member: Member) => {
    setSelectedMember(member);
    setRoleDialogOpen(true);
  };

  const handleOpenRemoveDialog = (member: Member) => {
    setSelectedMember(member);
    setRemoveDialogOpen(true);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading members...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Farm Members</CardTitle>
            {canManage && (
              <Button onClick={() => setInviteDialogOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Member
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canManage ? 5 : 4} className="text-center text-muted-foreground">
                    No members found
                  </TableCell>
                </TableRow>
              ) : (
                members.map((member) => (
                  <TableRow key={member.user_id}>
                    <TableCell className="font-medium">
                      {member.user_profiles?.display_name || 'Unknown'}
                    </TableCell>
                    <TableCell>{member.user_profiles?.phone || 'N/A'}</TableCell>
                    <TableCell>
                      <RoleBadge role={member.role} />
                    </TableCell>
                    <TableCell>{formatDate(member.accepted_at)}</TableCell>
                    {canManage && (
                      <TableCell className="text-right space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenRoleDialog(member)}
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          Change Role
                        </Button>
                        {canRemove && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleOpenRemoveDialog(member)}
                          >
                            <UserMinus className="h-4 w-4 mr-1" />
                            Remove
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pending Invites Section */}
      {canManage && activeFarmId && (
        <PendingInvites fazendaId={activeFarmId} onUpdate={fetchMembers} />
      )}

      {/* Dialogs */}
      {activeFarmId && currentUserRole && (
        <>
          <MemberRoleDialog
            member={
              selectedMember
                ? {
                    user_id: selectedMember.user_id,
                    display_name: selectedMember.user_profiles?.display_name || 'Unknown',
                    role: selectedMember.role
                  }
                : null
            }
            open={roleDialogOpen}
            onOpenChange={setRoleDialogOpen}
            fazendaId={activeFarmId}
            callerRole={currentUserRole}
            onSuccess={fetchMembers}
          />

          <RemoveMemberDialog
            member={
              selectedMember
                ? {
                    user_id: selectedMember.user_id,
                    display_name: selectedMember.user_profiles?.display_name || 'Unknown'
                  }
                : null
            }
            open={removeDialogOpen}
            onOpenChange={setRemoveDialogOpen}
            fazendaId={activeFarmId}
            onSuccess={fetchMembers}
          />

          <InviteMemberDialog
            open={inviteDialogOpen}
            onOpenChange={setInviteDialogOpen}
            fazendaId={activeFarmId}
            callerRole={currentUserRole}
            onSuccess={fetchMembers}
          />
        </>
      )}
    </div>
  );
};

export default AdminMembros;