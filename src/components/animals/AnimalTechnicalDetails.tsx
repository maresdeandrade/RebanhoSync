import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function AnimalTechnicalDetails({
  label = "Ver detalhes técnicos",
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-xl border border-border/70 bg-muted/20">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        {label}
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-4 border-t border-border/70 p-4">{children}</div>
    </details>
  );
}
