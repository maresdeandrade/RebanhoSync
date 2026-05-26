/**
 * SyncStatusBadge — versão compacta do estado de sincronização para o header.
 *
 * Segue a regra de prioridade definida no Design System §19.2:
 *   1. Rejeitados > 0  → "Revisão necessária" (danger)
 *   2. Sincronizando > 0 → "Sincronizando" (info)
 *   3. No aparelho > 0  → "Salvo localmente" (warning)
 *   4. Último com ajuste → "Confirmado com ajuste" (warning)
 *   5. Tudo certo        → "Em dia" (success)
 *
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
import type { FarmSyncSummary } from "@/lib/offline/syncPresentation";

interface SyncStatusBadgeProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  summary: FarmSyncSummary;
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

function getBadgeState(summary: FarmSyncSummary): BadgeState {
  if (summary.rejectionCount > 0) {
    return {
      tone: "danger",
      label: "Revisão necessária",
      Icon: CloudAlert,
    };
  }
  if (summary.syncingCount > 0) {
    return {
      tone: "info",
      label: "Sincronizando",
      Icon: Loader2,
      spin: true,
    };
  }
  if (summary.savedLocalCount > 0) {
    return {
      tone: "warning",
      label: "Salvo localmente",
      Icon: CloudUpload,
    };
  }
  if (summary.lastCompletedStage === "synced_altered") {
    return {
      tone: "warning",
      label: "Confirmado com ajuste",
      Icon: CloudUpload,
    };
  }
  return {
    tone: "success",
    label: "Em dia",
    Icon: CheckCircle2,
  };
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
