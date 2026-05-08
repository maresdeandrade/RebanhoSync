import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type RegistrarQuickActionOption<Key extends string = string> = {
  key: Key;
  label: string;
  helper: string;
  requiresAnimals?: boolean;
  icon: LucideIcon;
};

type RegistrarQuickActionsGridProps<Key extends string = string> = {
  actions: RegistrarQuickActionOption<Key>[];
  activeAction: Key | null;
  selectedAnimalsCount: number;
  disableRequiresAnimals: boolean;
  onSelectAction: (action: Key) => void;
};

export function RegistrarQuickActionsGrid<Key extends string = string>(
  props: RegistrarQuickActionsGridProps<Key>,
) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {props.actions.map((action) => {
        const Icon = action.icon;
        const disabled =
          props.disableRequiresAnimals &&
          action.requiresAnimals === true &&
          props.selectedAnimalsCount === 0;

        return (
          <Button
            key={action.key}
            type="button"
            variant="outline"
            className={cn(
              "h-auto min-h-24 flex-col items-start gap-2 rounded-xl border p-4 text-left shadow-sm transition-colors",
              props.activeAction === action.key
                ? "border-[#0057C2] bg-sky-50 text-[#002B45] ring-1 ring-[#0057C2] hover:bg-sky-100 dark:border-sky-500 dark:bg-sky-950/50 dark:text-sky-100"
                : "border-border/70 bg-card text-foreground hover:border-sky-300 hover:bg-sky-50 dark:hover:border-sky-800 dark:hover:bg-sky-950/30",
            )}
            disabled={disabled}
            onClick={() => props.onSelectAction(action.key)}
          >
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              <span className="font-semibold">{action.label}</span>
            </div>
            <span className="whitespace-normal text-xs opacity-80">{action.helper}</span>
          </Button>
        );
      })}
    </div>
  );
}
