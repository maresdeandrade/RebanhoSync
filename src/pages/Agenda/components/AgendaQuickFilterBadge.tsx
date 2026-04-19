import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { getQuickFilterBadgeToneClass } from "@/pages/Agenda/helpers/quickFilters";
import type { QuickFilterTone } from "@/pages/Agenda/types";

type AgendaQuickFilterBadgeProps = {
  tone: QuickFilterTone;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
};

export function AgendaQuickFilterBadge({
  tone,
  active,
  onClick,
  children,
  className,
}: AgendaQuickFilterBadgeProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none",
        getQuickFilterBadgeToneClass(tone),
        "cursor-pointer transition-colors hover:brightness-[0.98]",
        active ? "border-primary/70 ring-2 ring-primary/20" : null,
        className,
      )}
    >
      {children}
    </button>
  );
}
