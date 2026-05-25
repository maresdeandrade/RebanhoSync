import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold leading-none",
  {
    variants: {
      tone: {
        neutral: "border-border bg-muted text-foreground",
        info: "border-info bg-info text-info-foreground",
        success: "border-success bg-success text-success-foreground",
        warning: "border-2 border-warning-strong bg-warning text-warning-foreground",
        danger: "border-2 border-destructive bg-destructive text-destructive-foreground",
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
