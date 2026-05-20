import { type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

interface EmptyStateProps {
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
}: EmptyStateProps) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-card px-6 py-10 text-center shadow-none">
      <Icon className="mb-4 h-12 w-12 text-muted-foreground" />
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      {description ? (
        <p className="mb-4 max-w-sm text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <Button onClick={action.onClick}>{action.label}</Button> : null}
    </div>
  );
}
