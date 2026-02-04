import { Navigate, useLocation } from "react-router-dom";

// Mock de estado de autenticação para Fase 0
const useAuth = () => {
  return {
    isAuthenticated: true, // Simular logado
    activeFarmId: "farm-123", // Simular fazenda selecionada
  };
};

export const AuthGate = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, activeFarmId } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!activeFarmId && location.pathname !== "/select-fazenda") {
    return <Navigate to="/select-fazenda" replace />;
  }

  return <>{children}</>;
};