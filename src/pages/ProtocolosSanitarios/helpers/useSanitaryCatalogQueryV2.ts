import { liveQuery } from "dexie";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  pullSanitarioProtocolCatalogV2,
  type SanitarioProtocolCatalogPullResultV2,
} from "@/lib/offline/pull";
import { supabase } from "@/lib/supabase";
import {
  readLocalSanitaryProtocolCatalogV2,
  type SanitaryProtocolCatalogReadModelV2,
} from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";

export function useSanitaryCatalogQueryV2() {
  const { catalog, error, retryLocalRead } = useGlobalCatalogCache();
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [emptyConfirmed, setEmptyConfirmed] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const inFlight = useRef<Promise<SanitarioProtocolCatalogPullResultV2> | null>(
    null,
  );
  const generation = useRef(0);
  const mounted = useRef(false);
  const invalidate = useCallback(() => {
    ++generation.current;
  }, []);

  const refresh = useCallback(async () => {
    const request = ++generation.current;
    const isCurrent = () => mounted.current && request === generation.current;
    retryLocalRead();
    setOnline(navigator.onLine);
    if (!navigator.onLine) return;
    setRefreshing(true);
    setRefreshError(null);
    setConfirmed(false);
    setEmptyConfirmed(false);
    if (!inFlight.current) {
      inFlight.current = refreshAuthenticatedCatalog().finally(() => {
        inFlight.current = null;
      });
    }
    await finishCatalogRefresh(inFlight.current, isCurrent, {
      confirmed: setConfirmed,
      emptyConfirmed: setEmptyConfirmed,
      error: setRefreshError,
      refreshing: setRefreshing,
    });
  }, [retryLocalRead]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const reconnect = () => {
      void refresh();
    };
    const disconnect = () => {
      invalidate();
      setOnline(false);
      setConfirmed(false);
      setEmptyConfirmed(false);
      setRefreshing(false);
      setRefreshError(null);
    };
    window.addEventListener("online", reconnect);
    window.addEventListener("offline", disconnect);
    return () => {
      mounted.current = false;
      invalidate();
      window.removeEventListener("online", reconnect);
      window.removeEventListener("offline", disconnect);
    };
  }, [refresh, invalidate]);

  return {
    catalog,
    error,
    refreshError,
    refreshing,
    confirmed,
    emptyConfirmed,
    online,
    refresh,
    isLoading: catalog === null && error === null,
  };
}

async function readGlobalCatalog() {
  const local = await readLocalSanitaryProtocolCatalogV2();
  // This surface is the global catalog, never a projection of another farm.
  const protocols = local.protocols.filter(
    (p) => p.scope === "global" && p.fazendaId === null,
  );
  const ids = new Set(protocols.map((p) => p.id));
  return {
    protocols,
    items: local.items.filter((item) => ids.has(item.protocolId)),
    productClassGroups: local.productClassGroups.filter(
      (g) => g.scope === "global" && g.fazendaId === null,
    ),
  };
}

async function refreshAuthenticatedCatalog() {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw { code: "PGRST301" };
  return pullSanitarioProtocolCatalogV2();
}

function formatCatalogRefreshError(cause: unknown): string {
  const code =
    cause && typeof cause === "object" && "code" in cause ? cause.code : null;
  return code === "PGRST301" || code === "PGRST303" || code === "42501"
    ? "Não foi possível autenticar a consulta. Verifique sua sessão e tente novamente. Os dados locais foram preservados."
    : "Não foi possível atualizar o catálogo. Os dados locais foram preservados; tente novamente com conexão.";
}

function hasConfirmedRemoteEmpty(
  result: SanitarioProtocolCatalogPullResultV2 | undefined,
): boolean {
  return result?.remoteEmpty === true && result?.protocolsFullFetch === true;
}

async function finishCatalogRefresh(
  request: Promise<SanitarioProtocolCatalogPullResultV2>,
  isCurrent: () => boolean,
  update: {
    confirmed: (value: boolean) => void;
    emptyConfirmed: (value: boolean) => void;
    error: (value: string) => void;
    refreshing: (value: boolean) => void;
  },
) {
  try {
    const result = await request;
    if (isCurrent()) {
      update.confirmed(true);
      update.emptyConfirmed(hasConfirmedRemoteEmpty(result));
    }
  } catch (cause) {
    if (!isCurrent()) return;
    update.error(formatCatalogRefreshError(cause));
  } finally {
    if (isCurrent()) update.refreshing(false);
  }
}

function useGlobalCatalogCache() {
  const [catalog, setCatalog] =
    useState<SanitaryProtocolCatalogReadModelV2 | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [revision, setRevision] = useState(0);
  const readFailed = useRef(false);
  useEffect(() => {
    const subscription = liveQuery(async () => {
      return readGlobalCatalog();
    }).subscribe({
      next: (local) => {
        readFailed.current = false;
        setCatalog(local);
        setError(null);
      },
      error: () => {
        readFailed.current = true;
        setError("Falha ao ler catálogo local. Tente novamente.");
      },
    });
    return () => subscription.unsubscribe();
  }, [revision]);

  const retryLocalRead = useCallback(() => {
    if (readFailed.current) setRevision((value) => value + 1);
  }, []);
  return { catalog, error, retryLocalRead };
}
