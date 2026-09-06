import type { ReactNode } from "react";

export interface CockpitCardProps {
  title: string;
  value: string | number | null;
  unit?: string;
  icon: ReactNode;
  status: "empty" | "partial" | "complete" | "bloqueado";
  reason?: string;
  source?: string;
  limitation?: string;
  extraContent?: ReactNode;
}

export function CockpitCard({
  title,
  value,
  unit,
  icon,
  status,
  reason,
  source,
  limitation,
  extraContent,
}: CockpitCardProps) {
  const getStatusStyles = (currentStatus: typeof status) => {
    switch (currentStatus) {
      case "complete":
        return "border-semantic-success-border bg-semantic-success-muted text-foreground";
      case "partial":
        return "border-semantic-warning-border bg-semantic-warning-muted text-foreground";
      case "bloqueado":
        return "border-semantic-error-border bg-semantic-error-muted text-foreground";
      default:
        return "border-semantic-unknown-border bg-semantic-unknown-muted text-foreground";
    }
  };

  const getStatusLabel = (currentStatus: typeof status) => {
    switch (currentStatus) {
      case "complete":
        return "Completo";
      case "partial":
        return "Parcial";
      case "bloqueado":
        return "Bloqueado";
      default:
        return "Vazio";
    }
  };

  const getStatusBadgeStyles = (currentStatus: typeof status) => {
    switch (currentStatus) {
      case "complete":
        return "border-semantic-success-border bg-semantic-success-muted text-foreground";
      case "partial":
        return "border-semantic-warning-border bg-semantic-warning-muted text-foreground";
      case "bloqueado":
        return "border-semantic-error-border bg-semantic-error-muted text-foreground";
      default:
        return "border-semantic-unknown-border bg-semantic-unknown-muted text-foreground";
    }
  };

  return (
    <div className={`flex flex-col justify-between rounded-xl border p-4 ${getStatusStyles(status)}`}>
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-background/50 border border-current/10">
              {icon}
            </div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {title}
            </h4>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getStatusBadgeStyles(status)}`}>
            {getStatusLabel(status)}
          </span>
        </div>

        <div className="space-y-1">
          <p className="text-2xl font-extrabold tracking-tight text-foreground">
            {value !== null ? (typeof value === "number" ? value.toFixed(1) : value) : "—"}
            {value !== null && unit && (
              <span className="text-xs font-semibold text-muted-foreground ml-1.5 uppercase tracking-wide">
                {unit}
              </span>
            )}
          </p>
          {reason && (
            <p className="text-xs font-medium text-foreground/80 leading-snug">
              {reason}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-current/10 space-y-1.5 text-[11px] text-muted-foreground">
        {source && (
          <p>
            <span className="font-semibold text-foreground/75">Fonte:</span> {source}
          </p>
        )}
        {limitation && (
          <p className="font-medium text-semantic-warning">
            <span className="font-semibold">Nota:</span> {limitation}
          </p>
        )}
        {extraContent}
      </div>
    </div>
  );
}
