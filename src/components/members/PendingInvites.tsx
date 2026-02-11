import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Copy, X, Check } from "lucide-react";

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

export const PendingInvites = ({
  fazendaId,
  onUpdate,
}: PendingInvitesProps) => {
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchInvites = async () => {
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
        title: "Error loading invites",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fazendaId]);

  const handleCancelInvite = async (inviteId: string) => {
    try {
      const { error } = await supabase.rpc("cancel_invite", {
        _invite_id: inviteId,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Invite cancelled",
      });

      fetchInvites();
      onUpdate();
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast({
        title: "Error",
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
        title: "Copied!",
        description: "Invite link copied to clipboard",
      });
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading pending invites...
      </p>
    );
  }

  if (invites.length === 0) {
    return null;
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-lg">Pending Invites</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contact</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invites.map((invite) => (
              <TableRow key={invite.id}>
                <TableCell>
                  {invite.email || invite.phone}
                  {isExpired(invite.expires_at) && (
                    <Badge variant="destructive" className="ml-2">
                      Expired
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="capitalize">{invite.role}</TableCell>
                <TableCell>{formatDate(invite.expires_at)}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyLink(invite.token, invite.id)}
                    disabled={isExpired(invite.expires_at)}
                  >
                    {copiedId === invite.id ? (
                      <Check className="h-4 w-4 mr-1" />
                    ) : (
                      <Copy className="h-4 w-4 mr-1" />
                    )}
                    Copy Link
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleCancelInvite(invite.id)}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
