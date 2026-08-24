import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold leading-none",
  {
    variants: {
      tone: {
        neutral: "border-border bg-muted text-foreground",
        info: "border-semantic-info-border bg-semantic-info-muted text-foreground",
        success:
          "border-semantic-success-border bg-semantic-success-muted text-foreground",
        warning:
          "border-semantic-warning-border bg-semantic-warning-muted text-foreground",
        danger:
          "border-semantic-error-border bg-semantic-error-muted text-foreground",
        offline:
          "border-semantic-offline-border bg-semantic-offline-muted text-foreground",
        pending:
          "border-semantic-pending-border bg-semantic-pending-muted text-foreground",
        conflict:
          "border-semantic-conflict-border bg-semantic-conflict-muted text-foreground",
        unknown:
          "border-semantic-unknown-border bg-semantic-unknown-muted text-foreground",
        notPermitted:
          "border-semantic-not-permitted-border bg-semantic-not-permitted-muted text-foreground",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export interface StatusBadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {}

export function StatusBadge({ className, tone, ...props }: StatusBadgeProps) {
  return (
    <div className={cn(statusBadgeVariants({ tone }), className)} {...props} />
  );
}
