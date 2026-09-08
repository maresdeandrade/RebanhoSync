import * as React from "react";
import { type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-card px-6 py-10 text-center shadow-none",
        className,
      )}
      {...props}
    >
      <Icon className="mb-4 h-12 w-12 text-muted-foreground" />
      <h3 className="mb-2 text-lg font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mb-4 max-w-sm text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <Button onClick={action.onClick}>{action.label}</Button> : null}
    </div>
  );
}
