import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

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
            variant={props.activeAction === action.key ? "default" : "outline"}
            className="h-auto flex-col items-start gap-2 p-4 text-left"
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