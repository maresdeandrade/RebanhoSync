import * as React from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type MetricTone = "default" | "info" | "success" | "warning" | "danger";

const toneStyles: Record<MetricTone, string> = {
  default: "border-border/70",
  info: "border-info/15 bg-info-muted/60",
  success: "border-success/15 bg-success-muted/70",
  warning: "border-warning/20 bg-warning-muted/80",
  danger: "border-destructive/25 bg-destructive/10",
};

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: MetricTone;
  extraContent?: React.ReactNode;
}

export function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  extraContent,
  className,
  ...props
}: MetricCardProps) {
  return (
    <Card className={cn("shadow-none", toneStyles[tone], className)} {...props}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
          <p className="text-3xl font-semibold tracking-[-0.02em] tabular-nums text-foreground">{value}</p>
        </div>
        {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      </CardHeader>
      {hint || extraContent ? (
        <CardContent className="space-y-2 pt-0">
          {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
          {extraContent}
        </CardContent>
      ) : null}
    </Card>
  );
}
