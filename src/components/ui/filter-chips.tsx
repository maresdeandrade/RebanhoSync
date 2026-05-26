/**
 * FilterChips — chips horizontais com scroll para filtro de listas.
 *
 * - Chip ativo: bg-primary text-primary-foreground
 * - Chip inativo: border bg-card text-foreground
 * - Mostra contagem total e filtrada (ex.: "Animais (37 de 412)")
 * - Scroll horizontal sem scrollbar visível em mobile
 *
 * Design System §10.4
 *
 * @example
 * <FilterChips
 *   chips={[
 *     { id: "all", label: "Todos", count: 87 },
 *     { id: "warning", label: "Atenção", count: 3 },
 *     { id: "ok", label: "Em dia", count: 84 },
 *   ]}
 *   activeId="all"
 *   onSelect={(id) => setFilter(id)}
 * />
 */
import * as React from "react";
import { cn } from "@/lib/utils";

export interface FilterChip {
  id: string;
  label: string;
  /** Contagem de itens para este filtro */
  count?: number;
}

interface FilterChipsProps {
  chips: FilterChip[];
  activeId?: string;
  onSelect?: (id: string) => void;
  className?: string;
  /** Label de acessibilidade para o grupo (ex.: "Filtros de animal") */
  "aria-label"?: string;
}

export function FilterChips({
  chips,
  activeId,
  onSelect,
  className,
  "aria-label": ariaLabel = "Filtros",
}: FilterChipsProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "flex gap-2 overflow-x-auto pb-1 scrollbar-none",
        // Hide scrollbar cross-browser
        "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
        className,
      )}
    >
      {chips.map((chip) => {
        const isActive = chip.id === activeId;
        return (
          <button
            key={chip.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onSelect?.(chip.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-label font-semibold leading-none transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            <span>{chip.label}</span>
            {chip.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-caption font-bold tabular-nums",
                  isActive
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {chip.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
