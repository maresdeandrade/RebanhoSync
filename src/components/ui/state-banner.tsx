import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const stateBannerVariants = cva(
  "relative grid w-full gap-2 rounded-xl border p-4 text-foreground [&>svg]:h-5 [&>svg]:w-5",
  {
    variants: {
      tone: {
        neutral: "border-border bg-muted/60",
        info: "border-semantic-info-border bg-semantic-info-muted",
        success: "border-semantic-success-border bg-semantic-success-muted",
        warning: "border-semantic-warning-border bg-semantic-warning-muted",
        error: "border-semantic-error-border bg-semantic-error-muted",
        offline: "border-semantic-offline-border bg-semantic-offline-muted",
        pending: "border-semantic-pending-border bg-semantic-pending-muted",
        conflict: "border-semantic-conflict-border bg-semantic-conflict-muted",
        unknown: "border-semantic-unknown-border bg-semantic-unknown-muted",
        notPermitted:
          "border-semantic-not-permitted-border bg-semantic-not-permitted-muted",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

export interface StateBannerProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof stateBannerVariants> {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  live?: "off" | "polite" | "assertive";
}

export const StateBanner = React.forwardRef<HTMLDivElement, StateBannerProps>(
  (
    {
      title,
      description,
      icon,
      action,
      live = "off",
      tone,
      className,
      ...props
    },
    ref,
  ) => (
    <div
      ref={ref}
      role={live === "assertive" ? "alert" : "status"}
      aria-live={live}
      className={cn(stateBannerVariants({ tone }), className)}
      {...props}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span aria-hidden="true" className="mt-0.5 shrink-0">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-semibold leading-5">{title}</p>
          {description ? (
            <div className="text-sm leading-5 text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
      </div>
      {action ? (
        <div className="pt-1 sm:justify-self-start">{action}</div>
      ) : null}
    </div>
  ),
);
StateBanner.displayName = "StateBanner";

// eslint-disable-next-line react-refresh/only-export-components
export { stateBannerVariants };
