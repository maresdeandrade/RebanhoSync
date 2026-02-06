import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

type Role = 'owner' | 'manager' | 'cowboy';

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
  onSuccess 
}: MemberRoleDialogProps) => {
  const [newRole, setNewRole] = useState<Role | ''>('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleChangeRole = async () => {
    if (!member || !newRole) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.rpc('admin_set_member_role', {
        _fazenda_id: fazendaId,
        _target_user_id: member.user_id,
        _new_role: newRole
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: `Role updated to ${newRole}`
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Reset when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open && member) {
      setNewRole(member.role);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Role - {member?.display_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="role">New Role</Label>
            <Select value={newRole} onValueChange={(value) => setNewRole(value as Role)}>
              <SelectTrigger id="role">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {callerRole === 'owner' && (
                  <SelectItem value="owner">Owner</SelectItem>
                )}
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="cowboy">Cowboy</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleChangeRole} disabled={isLoading || !newRole}>
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
