import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none",
  {
    variants: {
      tone: {
        neutral: "border-border/80 bg-background/75 text-muted-foreground",
        info: "border-info/15 bg-info-muted text-info",
        success: "border-success/15 bg-success-muted text-success",
        warning: "border-warning/20 bg-warning-muted text-warning",
        danger: "border-destructive/15 bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {}

export function StatusBadge({
  className,
  tone,
  ...props
}: StatusBadgeProps) {
  return (
    <div className={cn(statusBadgeVariants({ tone }), className)} {...props} />
  );
}
