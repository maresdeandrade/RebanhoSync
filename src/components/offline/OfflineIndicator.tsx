/**
 * OfflineIndicator — indicador global de conectividade.
 *
 * - Online → invisível (não polui a UI).
 * - Offline → pill "Sem internet" com ícone CloudOff.
 * - Reconectando → pill com spinner.
 * - Offline > 24h → banner sticky no topo com contagem de gestos na fila.
 *
 * Design System §18
 */
import { useEffect, useState } from "react";
import { AlertTriangle, CloudOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ConnectivityState = "online" | "offline" | "reconnecting";

function useConnectivity(): ConnectivityState {
  const [state, setState] = useState<ConnectivityState>(
    navigator.onLine ? "online" : "offline",
  );

  useEffect(() => {
    function handleOffline() {
      setState("offline");
    }

    function handleOnline() {
      setState("reconnecting");
      // Pequeno delay para confirmar a reconexão antes de marcar online
      const timer = setTimeout(() => setState("online"), 1500);
      return () => clearTimeout(timer);
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return state;
}

interface OfflineIndicatorProps {
  /** Número de gestos na fila (para banner de 24h). */
  pendingCount?: number;
  /** Callback ao clicar em "Tentar sincronizar agora". */
  onSyncNow?: () => void;
  className?: string;
}

/**
 * Pill pequena — usar no header ao lado do SyncStatusBadge.
 */
export function OfflineIndicatorPill({ className }: { className?: string }) {
  const state = useConnectivity();

  if (state === "online") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-warning-strong bg-warning-muted px-2.5 py-1 text-xs font-semibold leading-none text-foreground",
        className,
      )}
    >
      {state === "reconnecting" ? (
        <>
          <Loader2 className="size-3.5 animate-spin" strokeWidth={2} aria-hidden="true" />
          <span>Reconectando…</span>
        </>
      ) : (
        <>
          <CloudOff className="size-3.5" strokeWidth={2} aria-hidden="true" />
          <span>Sem internet</span>
        </>
      )}
    </div>
  );
}

/**
 * Banner de degradação consciente — aparece quando offline por mais de 24h.
 * Montar no AppShell ou no layout principal.
 */
export function OfflineDegradationBanner({
  pendingCount = 0,
  onSyncNow,
}: OfflineIndicatorProps) {
  const state = useConnectivity();
  const [offlineSince, setOfflineSince] = useState<Date | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (state === "offline" && !offlineSince) {
      setOfflineSince(new Date());
    }
    if (state === "online") {
      setOfflineSince(null);
      setShowBanner(false);
    }
  }, [state, offlineSince]);

  useEffect(() => {
    if (!offlineSince) return;
    const MS_24H = 24 * 60 * 60 * 1000;
    const remaining = MS_24H - (Date.now() - offlineSince.getTime());

    if (remaining <= 0) {
      setShowBanner(true);
      return;
    }

    const timer = setTimeout(() => setShowBanner(true), remaining);
    return () => clearTimeout(timer);
  }, [offlineSince]);

  if (!showBanner || state === "online") return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b-2 border-warning-strong bg-warning-muted px-4 py-3 text-sm font-medium text-foreground"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 shrink-0 text-warning" strokeWidth={2} aria-hidden="true" />
        <span>
          Você está offline há mais de 1 dia.{" "}
          {pendingCount > 0 && (
            <strong>{pendingCount} registros aguardam envio.</strong>
          )}
        </span>
      </div>
      {onSyncNow && (
        <button
          type="button"
          onClick={onSyncNow}
          className="shrink-0 rounded-md bg-warning px-3 py-1.5 text-xs font-semibold text-warning-foreground hover:bg-warning/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Tentar sincronizar agora
        </button>
      )}
    </div>
  );
}
