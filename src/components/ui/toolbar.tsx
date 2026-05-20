import * as React from "react";

import { cn } from "@/lib/utils";

export function Toolbar({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-3 shadow-none sm:p-4 lg:flex-row lg:items-center lg:justify-between",
        className,
      )}
      {...props}
    />
  );
}

export function ToolbarGroup({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center",
        className,
      )}
      {...props}
    />
  );
}
