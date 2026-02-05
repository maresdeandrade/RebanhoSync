import { supabase } from '@/lib/supabase';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { useState } from 'react';

type SignUpForm = {
  email: string;
  password: string;
  confirmPassword: string;
  displayName: string;
  phone: string;
};

const SignUp = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const { register, handleSubmit, formState: { errors }, watch } = useForm<SignUpForm>();
  const password = watch('password');

  if (session) {
    return <Navigate to="/home" replace />;
  }

  const onSubmit = async (data: SignUpForm) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // 1. Signup no Supabase Auth (trigger criará user_profiles/user_settings)
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            display_name: data.displayName,
            phone: data.phone,
          },
        },
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('Falha ao criar usuário');

      // 2. ✅ Verificar se veio sessão (depende de Confirm Email config)
      if (authData.session) {
        // Confirm Email = OFF → já autenticado
        console.log('[signup] Session criada - criando fazenda inicial');
        
        // Criar fazenda inicial via RPC
        const { error: fazendaError } = await supabase
          .rpc('create_fazenda', { _nome: 'Minha Fazenda' });

        if (fazendaError) {
          console.error('[signup] Erro ao criar fazenda:', fazendaError);
          // Não bloqueia - usuário pode criar depois
        }

        // Redirecionar para home
        navigate('/home');
      } else {
        // Confirm Email = ON → precisa confirmar email
        setSuccess(
          'Conta criada com sucesso! Verifique seu email para confirmar o cadastro e depois faça login.'
        );
        setIsLoading(false);
      }
      
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      setError(error.message || 'Erro ao cadastrar usuário');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Cadastro - Gestão Pecuária</CardTitle>
          <p className="text-sm text-muted-foreground">Crie sua conta gratuitamente</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Nome</Label>
              <Input
                id="displayName"
                placeholder="Seu nome completo"
                {...register('displayName', { required: 'Nome é obrigatório' })}
                disabled={isLoading}
              />
              {errors.displayName && (
                <p className="text-sm text-destructive">{errors.displayName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                {...register('email', { 
                  required: 'E-mail é obrigatório',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: 'E-mail inválido'
                  }
                })}
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+55 11 98765-4321"
                {...register('phone', { 
                  required: 'Telefone é obrigatório',
                  pattern: {
                    value: /^\+?[1-9]\d{1,14}$/,
                    message: 'Telefone inválido'
                  }
                })}
                disabled={isLoading}
              />
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                {...register('password', { 
                  required: 'Senha é obrigatória',
                  minLength: {
                    value: 6,
                    message: 'Senha deve ter pelo menos 6 caracteres'
                  }
                })}
                disabled={isLoading}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Digite a senha novamente"
                {...register('confirmPassword', { 
                  required: 'Confirmação é obrigatória',
                  validate: value => value === password || 'As senhas não correspondem'
                })}
                disabled={isLoading}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
              )}
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
                {success}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Criando conta...' : 'Criar Conta'}
            </Button>

            <div className="text-center text-sm">
              Já tem uma conta?{' '}
              <Link to="/login" className="text-primary hover:underline">
                Faça login aqui
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SignUp;
