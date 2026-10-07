/**
 * SyncStatusBadge — versão compacta do estado de sincronização para o header.
 *
 * Projeta a prioridade compartilhada de sync/reconcile.
 * Tap/click abre o painel de sincronização completo.
 */
import * as React from "react";
import {
  CheckCircle2,
  CloudAlert,
  CloudOff,
  CloudUpload,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getFarmSyncHealth,
  type FarmSyncSummary,
} from "@/lib/offline/syncPresentation";

interface SyncStatusBadgeProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  summary?: FarmSyncSummary;
  /** Se `true`, mostra apenas o ícone (toolbar densa). Sempre exige aria-label. */
  iconOnly?: boolean;
}

type Tone = "success" | "warning" | "info" | "danger";

interface BadgeState {
  tone: Tone;
  label: string;
  Icon: React.ElementType;
  spin?: boolean;
}

function getBadgeState(summary?: FarmSyncSummary): BadgeState {
  const health = getFarmSyncHealth(summary);
  const Icon =
    health.stage === "checking" || health.stage === "syncing"
      ? Loader2
      : health.tone === "danger" || health.stage === "reconcile"
        ? CloudAlert
        : health.stage === "healthy"
          ? CheckCircle2
          : CloudUpload;
  return { ...health, Icon, spin: Icon === Loader2 };
}

const toneStyles: Record<Tone, string> = {
  success: "bg-success text-success-foreground border-success",
  warning: "bg-warning text-warning-foreground border-warning-strong border-2",
  info: "bg-info text-info-foreground border-info",
  danger:
    "bg-destructive text-destructive-foreground border-destructive border-2",
};

export function SyncStatusBadge({
  summary,
  iconOnly = false,
  className,
  ...props
}: SyncStatusBadgeProps) {
  const state = getBadgeState(summary);
  const { tone, label, Icon, spin } = state;

  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        toneStyles[tone],
        className,
      )}
      {...props}
    >
      <Icon
        className={cn("size-3.5 shrink-0", spin && "animate-spin")}
        strokeWidth={2}
        aria-hidden="true"
      />
      {!iconOnly && <span>{label}</span>}
    </button>
  );
}

/**
 * OfflinePill — exibido apenas quando o dispositivo está sem internet.
 * Invisível quando online (não polui o header).
 */
interface OfflinePillProps extends React.HTMLAttributes<HTMLDivElement> {
  offline: boolean;
  reconnecting?: boolean;
}

export function OfflinePill({
  offline,
  reconnecting = false,
  className,
  ...props
}: OfflinePillProps) {
  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-warning-strong bg-warning-muted px-2.5 py-1 text-xs font-semibold leading-none text-foreground",
        className,
      )}
      {...props}
    >
      {reconnecting ? (
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
