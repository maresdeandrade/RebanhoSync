import {
  Activity,
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
  hasExistingTarget: boolean;
  onSelectAction: (
    action:
      | "sanitario"
      | "pesagem"
      | "movimentacao"
      | "nutricao"
      | "comercial"
      | "reproducao"
      | "ecc",
  ) => void;
};

export function RegistrarManejoActionsGrid(
  props: RegistrarManejoActionsGridProps,
) {
  const getActionClassName = (active: boolean) =>
    cn(
      "relative h-auto min-h-24 min-w-0 flex-col gap-3 whitespace-normal rounded-xl border px-3 py-4 text-center text-sm shadow-none transition-colors sm:px-4",
      active
        ? "border-primary/30 bg-primary/10 text-primary ring-1 ring-primary/25 hover:bg-primary/15"
        : "border-border/70 bg-card text-foreground hover:border-primary/25 hover:bg-muted/60",
    );

  const actions = [
    {
      key: "sanitario",
      label: "Sanitário",
      icon: Syringe,
      requiresAnimals: true,
    },
    { key: "pesagem", label: "Pesagem", icon: Scale, requiresAnimals: true },
    { key: "movimentacao", label: "Mover", icon: Move, requiresAnimals: true },
    { key: "nutricao", label: "Nutrição", icon: Sprout, requiresAnimals: true },
    {
      key: "comercial",
      label: "Negócios Patrimoniais",
      icon: Banknote,
      requiresAnimals: false,
    },
    {
      key: "reproducao",
      label: "Reprodução",
      icon: HeartPulse,
      requiresAnimals: true,
    },
    {
      key: "ecc",
      label: "ECC",
      icon: Activity,
      requiresAnimals: true,
    },
  ] as const;

  return (
    <div
      role="group"
      aria-label="Tipo de manejo"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4"
    >
      {actions.map((action) => {
        const Icon = action.icon;
        const active = props.tipoManejo === action.key;
        const disabled =
          action.requiresAnimals &&
          (!props.hasExistingTarget || props.selectedAnimaisCount === 0);

        return (
          <Button
            key={action.key}
            type="button"
            variant="outline"
            aria-pressed={active}
            className={getActionClassName(active)}
            disabled={disabled}
            onClick={() => props.onSelectAction(action.key)}
          >
            {active ? (
              <span className="absolute right-2 top-2 rounded-full bg-primary p-0.5 text-primary-foreground">
                <Check className="h-3 w-3" />
              </span>
            ) : null}
            <Icon aria-hidden="true" className="h-5 w-5" />
            <span className="max-w-full break-words font-semibold leading-snug">
              {action.label}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
