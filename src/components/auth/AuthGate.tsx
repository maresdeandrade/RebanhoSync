import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { useEffect, useState } from "react";

type UserRole = "cowboy" | "manager" | "owner";

export const AuthGate = ({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole?: UserRole;
}) => {
  const { session, loading, activeFarmId, role } = useAuth();
  const location = useLocation();
  const [checked, setChecked] = useState(false);

  // Verificar se o contexto de autenticação está disponível
  useEffect(() => {
    if (!loading) {
      setChecked(true);
    }
  }, [loading]);

  // Se ainda estiver carregando ou verificando, mostrar tela de carregamento
  if (loading || !checked) {
    return <LoadingScreen />;
  }

  // Se não houver sessão, redirecionar para login
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Se não houver fazenda ativa e não estiver na página de seleção, redirecionar
  if (!activeFarmId && location.pathname !== "/select-fazenda") {
    return <Navigate to="/select-fazenda" replace />;
  }

  // Verificar permissões de role se necessário
  if (requiredRole && role !== requiredRole && role !== "owner") {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-4 text-center">
        <h1 className="text-2xl font-bold text-destructive">Acesso Negado</h1>
        <p className="text-muted-foreground">
          Você não tem permissão para acessar esta área.
        </p>
        <button
          onClick={() => window.history.back()}
          className="mt-4 text-primary underline"
        >
          Voltar
        </button>
      </div>
    );
  }

  return <>{children}</>;
};
