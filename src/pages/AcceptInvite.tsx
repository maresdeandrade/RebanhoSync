import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

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

  useEffect(() => {
    if (!token) {
      setError('Invalid invite link');
      setIsLoading(false);
      return;
    }

    loadInvite();
  }, [token]);

  const loadInvite = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.rpc('get_invite_preview', {
        _token: token
      });

      if (error) throw error;

      // RPC returns null if invite not found
      if (!data) {
        throw new Error('Invite not found');
      }

      setInvite(data);
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async () => {
    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please login to accept this invite',
        variant: 'destructive'
      });
      // Redirect to login with return URL
      navigate(`/login?redirect=/invites/${token}`);
      return;
    }

    setIsProcessing(true);
    try {
      const { data: fazendaId, error } = await supabase.rpc('accept_invite', {
        _token: token
      });

      if (error) throw error;

      toast({
        title: 'Success!',
        description: 'You have joined the farm'
      });

      // Redirect to home
      navigate('/home');
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      const { error } = await supabase.rpc('reject_invite', {
        _token: token
      });

      if (error) throw error;

      toast({
        title: 'Invite rejected',
        description: 'You have declined this invitation'
      });

      // Redirect to home or index
      navigate('/');
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
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
            <CardTitle className="text-destructive">Invite Not Found</CardTitle>
            <CardDescription>{error || 'This invite link is invalid'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')} className="w-full">
              Go to Home
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
            <CardTitle className="text-destructive">Invite Expired</CardTitle>
            <CardDescription>
              This invitation has expired or has already been used.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p><strong>Farm:</strong> {invite.fazenda_nome}</p>
              <p><strong>Status:</strong> <Badge>{invite.status}</Badge></p>
            </div>
            <Button onClick={() => navigate('/')} className="w-full mt-4">
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
          <CardTitle>You've Been Invited!</CardTitle>
          <CardDescription>
            You have been invited to join a farm on Gestão Agro
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-muted-foreground">Farm</span>
              <span className="font-semibold">{invite.fazenda_nome}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-muted-foreground">Role</span>
              <Badge className="capitalize">{invite.role}</Badge>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium text-muted-foreground">Invited by</span>
              <span>{invite.inviter_nome}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium text-muted-foreground">Expires</span>
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
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Accept
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
                  Reject
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
