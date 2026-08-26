import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LoadingScreen } from "@/components/ui/loading-screen";

export const RequireSuperAdmin = ({ children }: { children: React.ReactNode }) => {
  const { session, loading, isSuperAdmin } = useAuth();

  if (loading || (session && isSuperAdmin === null)) {
    return <LoadingScreen />;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (isSuperAdmin !== true) {
    if (import.meta.env.DEV) {
      console.warn("[RequireSuperAdmin] Acesso negado: usuário não é SuperAdmin");
    }
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
};
