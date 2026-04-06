import * as React from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MetricTone = "default" | "info" | "success" | "warning" | "danger";

const toneStyles: Record<MetricTone, string> = {
  default: "border-border/70",
  info: "border-info/15 bg-info-muted/60",
  success: "border-success/15 bg-success-muted/70",
  warning: "border-warning/20 bg-warning-muted/80",
  danger: "border-destructive/15 bg-destructive/5",
};

interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: MetricTone;
}

export function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  className,
  ...props
}: MetricCardProps) {
  return (
    <Card className={cn("shadow-none", toneStyles[tone], className)} {...props}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-3xl font-semibold tracking-[-0.02em]">{value}</p>
        </div>
        {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      </CardHeader>
      {hint ? (
        <CardContent>
          <p className="text-sm leading-6 text-muted-foreground">{hint}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}
