import * as React from "react";

import { cn } from "@/lib/utils";

interface PageIntroProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageIntro({
  eyebrow,
  title,
  description,
  meta,
  actions,
  className,
  ...props
}: PageIntroProps) {
  return (
    <section
      className={cn(
        "app-surface flex flex-col gap-5 p-5 sm:p-6 xl:flex-row xl:items-end xl:justify-between",
        className,
      )}
      {...props}
    >
      <div className="space-y-3">
        {eyebrow ? <div className="app-kicker">{eyebrow}</div> : null}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {meta ? <div className="flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>

      {actions ? (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
          {actions}
        </div>
      ) : null}
    </section>
  );
}
