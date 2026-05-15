import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { cn } from "@/lib/utils";

type AgendaComplianceBadge = {
  key: string;
  label: string;
  count: number;
  tone: "neutral" | "info" | "success" | "warning" | "danger";
};

type AgendaComplianceTopItem = {
  key: string;
  label: string;
  statusLabel: string;
  kindLabel: string;
  detail: string;
  recommendation: string;
  tone: "neutral" | "info" | "success" | "warning" | "danger";
};

type AgendaComplianceSummaryPanelProps = {
  openCount: number;
  blockingCount: number;
  badges: AgendaComplianceBadge[];
  topItems: AgendaComplianceTopItem[];
  onOpenComplianceOverlay: () => void;
};

export function AgendaComplianceSummaryPanel({
  openCount,
  blockingCount,
  badges,
  topItems,
  onOpenComplianceOverlay,
}: AgendaComplianceSummaryPanelProps) {
  const alertTone = blockingCount > 0 ? "danger" : "warning";

  return (
    <Card
      className={cn(
        "shadow-none",
        alertTone === "danger"
          ? "border-destructive/15 bg-destructive/5"
          : "border-warning/20 bg-warning-muted/70",
      )}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle
            className={cn(
              "h-4 w-4",
              alertTone === "danger"
                ? "text-destructive"
                : "text-amber-700 dark:text-amber-200",
            )}
          />
          {blockingCount > 0
            ? "Restricoes em aberto"
            : "Conformidade operacional pendente"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone={alertTone}>{openCount} frente(s)</StatusBadge>
          {badges.map((badge) => (
            <StatusBadge key={badge.key} tone={badge.tone}>
              {badge.label} {badge.count}
            </StatusBadge>
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {topItems.map((item) => (
            <div
              key={item.key}
              className="rounded-2xl border border-border/70 bg-background/90 p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{item.label}</p>
                <StatusBadge tone={item.tone}>{item.statusLabel}</StatusBadge>
                <StatusBadge tone={item.tone}>{item.kindLabel}</StatusBadge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {item.recommendation || item.detail}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={onOpenComplianceOverlay}>
            Abrir conformidade
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
