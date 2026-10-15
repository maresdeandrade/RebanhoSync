import { useCallback, useEffect, useRef, useState } from "react";
import { pullSanitarioProductClassV2Catalog, pullSanitarioTechnicalCatalogV2, pullSanitarioProtocolCatalogV2 } from "@/lib/offline/pull";

export function useSanitaryPlanningRefreshV2(fazendaId: string | null, onUpdated?: () => void) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const generation = useRef(0);
  const invalidate = useCallback(() => { ++generation.current; }, []);
  const refresh = useCallback(async () => {
    if (!fazendaId) return;
    const request = ++generation.current;
    if (!navigator.onLine) {
      setRefreshError("Sem conexão. Consulta e planejamento usam o catálogo já disponível neste dispositivo.");
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    setRefreshError(null);
    const results = await Promise.allSettled([
      pullSanitarioProductClassV2Catalog(fazendaId),
      pullSanitarioTechnicalCatalogV2(fazendaId),
      pullSanitarioProtocolCatalogV2(),
    ]);
    if (request !== generation.current) return;
    if (results.some((result) => result.status === "rejected")) {
      setRefreshError("Não foi possível atualizar todo o catálogo. Os dados locais foram preservados; tente novamente com conexão.");
    }
    setRefreshing(false);
    onUpdated?.();
  }, [fazendaId, onUpdated]);

  useEffect(() => {
    // Keep opening the offline flow independent from network response time.
    setRefreshError(null);
    setRefreshing(false);
    window.addEventListener("online", refresh);
    return () => { invalidate(); window.removeEventListener("online", refresh); };
  }, [refresh, invalidate]);
  return { refresh, refreshing, refreshError };
}
