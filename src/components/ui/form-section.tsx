import * as React from "react";

import { cn } from "@/lib/utils";

interface FormSectionProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  contentClassName?: string;
}

export function FormSection({
  title,
  description,
  actions,
  className,
  contentClassName,
  children,
  ...props
}: FormSectionProps) {
  return (
    <section
      className={cn("app-surface overflow-hidden p-0", className)}
      {...props}
    >
      <div className="flex flex-col gap-3 border-b border-border/70 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-[-0.01em] text-foreground">
            {title}
          </h2>
          {description ? (
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>

      <div className={cn("px-5 py-5", contentClassName)}>{children}</div>
    </section>
  );
}
