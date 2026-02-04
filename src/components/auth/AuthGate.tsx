import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export const AuthGate = ({ children, requiredRole }: { children: React.ReactNode, requiredRole?: string }) => {
  const { session, loading, activeFarmId, role } = useAuth();
  const location = useLocation();

  if (loading) return <div className="flex h-screen items-center justify-center">Carregando...</div>;

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!activeFarmId && location.pathname !== "/select-fazenda") {
    return <Navigate to="/select-fazenda" replace />;
  }

  if (requiredRole && role !== requiredRole && role !== 'owner') {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-4 text-center">
        <h1 className="text-2xl font-bold text-destructive">Acesso Negado</h1>
        <p className="text-muted-foreground">Você não tem permissão para acessar esta área.</p>
        <button onClick={() => window.history.back()} className="mt-4 text-primary underline">Voltar</button>
      </div>
    );
  }

  return <>{children}</>;
};