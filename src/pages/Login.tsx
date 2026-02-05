import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/lib/supabase';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Login = () => {
  const { session, activeFarmId } = useAuth();

  // ✅ Melhora UX: redireciona direto para /home se já tiver fazenda ativa
  if (session) {
    if (activeFarmId) {
      return <Navigate to="/home" replace />;
    }
    return <Navigate to="/select-fazenda" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Gestão Pecuária</CardTitle>
          <p className="text-sm text-muted-foreground">Entre para gerenciar sua fazenda</p>
        </CardHeader>
        <CardContent>
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            theme="light"
            providers={[]}
            localization={{
              variables: {
                sign_in: {
                  email_label: 'E-mail',
                  password_label: 'Senha',
                  button_label: 'Entrar',
                  loading_button_label: 'Entrando...',
                  email_input_placeholder: 'Seu e-mail',
                  password_input_placeholder: 'Sua senha',
                },
              },
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;