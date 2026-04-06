import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export const RequireFarm = ({ children }: { children: React.ReactNode }) => {
  const { session, activeFarmId, loading, role, refreshSettings } = useAuth();
  const [isRecoveringFarm, setIsRecoveringFarm] = useState(false);

  useEffect(() => {
    if (!session || !activeFarmId || role || loading || isRecoveringFarm) {
      return;
    }

    setIsRecoveringFarm(true);
    void refreshSettings().finally(() => {
      setIsRecoveringFarm(false);
    });
  }, [
    activeFarmId,
    isRecoveringFarm,
    loading,
    refreshSettings,
    role,
    session,
  ]);

  if (loading || isRecoveringFarm) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        Carregando...
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!activeFarmId) {
    return <Navigate to="/select-fazenda" replace />;
  }

  // ✅ Security Check: If role is null, user is not a member of this farm
  // This prevents unauthorized access if someone manually sets active_fazenda_id in localStorage
  if (!role) {
    console.warn(
      `[RequireFarm] Access denied: User ${session.user.id} has no role in farm ${activeFarmId}`,
    );
    return <Navigate to="/select-fazenda" replace />;
  }

  return <>{children}</>;
};
