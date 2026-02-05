import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export const RequireFarm = ({ children }: { children: React.ReactNode }) => {
  const { session, activeFarmId, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Carregando...</div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!activeFarmId) {
    return <Navigate to="/select-fazenda" replace />;
  }

  return <>{children}</>;
};
