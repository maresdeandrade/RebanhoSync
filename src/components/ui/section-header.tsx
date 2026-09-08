import * as React from "react";

import { cn } from "@/lib/utils";

export interface SectionHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  level?: 2 | 3;
  bordered?: boolean;
}

export function SectionHeader({
  title,
  description,
  actions,
  badge,
  level = 2,
  bordered = false,
  className,
  ...props
}: SectionHeaderProps) {
  const Heading = level === 3 ? "h3" : "h2";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        bordered && "border-b border-border/70 pb-3",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Heading
            className={cn(
              "font-semibold tracking-[-0.01em] text-foreground",
              level === 3 ? "text-base sm:text-h3" : "text-h3 sm:text-h2",
            )}
          >
            {title}
          </Heading>
          {badge ? <div className="shrink-0">{badge}</div> : null}
        </div>
        {description ? (
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>

      {actions ? (
        <div className="flex flex-wrap items-center gap-2 shrink-0 sm:self-start">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
