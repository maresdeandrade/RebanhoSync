import {
  Banknote,
  Check,
  HeartPulse,
  Move,
  Scale,
  Sprout,
  Syringe,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RegistrarManejoActionsGridProps = {
  tipoManejo: string;
  selectedAnimaisCount: number;
  onSelectAction: (
    action:
      | "sanitario"
      | "pesagem"
      | "movimentacao"
      | "nutricao"
      | "financeiro"
      | "reproducao",
  ) => void;
};

export function RegistrarManejoActionsGrid(
  props: RegistrarManejoActionsGridProps,
) {
  const getActionClassName = (active: boolean) =>
    cn(
      "relative h-24 px-3 sm:h-24 sm:px-4 flex-col gap-2 rounded-xl border text-center shadow-sm transition-colors text-sm",
      active
        ? "border-[#0057C2] bg-sky-50 text-[#002B45] ring-2 ring-[#0057C2] hover:bg-sky-100 dark:border-sky-500 dark:bg-sky-950/50 dark:text-sky-100"
        : "border-border/70 bg-card text-foreground hover:border-sky-300 hover:bg-sky-50 dark:hover:border-sky-800 dark:hover:bg-sky-950/30",
    );

  const actions = [
    {
      key: "sanitario",
      label: "Sanitario",
      icon: Syringe,
      requiresAnimals: true,
    },
    { key: "pesagem", label: "Pesagem", icon: Scale, requiresAnimals: true },
    { key: "movimentacao", label: "Mover", icon: Move, requiresAnimals: true },
    { key: "nutricao", label: "Nutricao", icon: Sprout, requiresAnimals: true },
    {
      key: "financeiro",
      label: "Financeiro",
      icon: Banknote,
      requiresAnimals: false,
    },
    {
      key: "reproducao",
      label: "Reproducao",
      icon: HeartPulse,
      requiresAnimals: true,
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
      {actions.map((action) => {
        const Icon = action.icon;
        const active = props.tipoManejo === action.key;
        const disabled =
          action.requiresAnimals && props.selectedAnimaisCount === 0;

        return (
          <Button
            key={action.key}
            variant="outline"
            aria-pressed={active}
            className={getActionClassName(active)}
            disabled={disabled}
            onClick={() => props.onSelectAction(action.key)}
          >
            {active ? (
              <span className="absolute right-2 top-2 rounded-full bg-[#0057C2] p-0.5 text-white">
                <Check className="h-3 w-3" />
              </span>
            ) : null}
            <Icon className="h-6 w-6" />
            <span className="font-semibold leading-tight">{action.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
