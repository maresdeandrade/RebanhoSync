import { Move, Scale, Syringe } from "lucide-react";

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

export function RegistrarManejoActionsGrid(props: RegistrarManejoActionsGridProps) {
  const getActionClassName = (active: boolean) =>
    cn(
      "h-20 sm:h-24 px-1 sm:px-4 flex-col gap-1.5 sm:gap-2 rounded-xl border text-center shadow-sm transition-colors text-[10px] sm:text-sm",
      active
        ? "border-[#0057C2] bg-sky-50 text-[#002B45] ring-1 ring-[#0057C2] hover:bg-sky-100 dark:border-sky-500 dark:bg-sky-950/50 dark:text-sky-100"
        : "border-border/70 bg-card text-foreground hover:border-sky-300 hover:bg-sky-50 dark:hover:border-sky-800 dark:hover:bg-sky-950/30",
    );

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-6">
      <Button
        variant="outline"
        className={getActionClassName(props.tipoManejo === "sanitario")}
        disabled={props.selectedAnimaisCount === 0}
        onClick={() => props.onSelectAction("sanitario")}
      >
        <Syringe className="h-6 w-6" /> Sanitario
      </Button>
      <Button
        variant="outline"
        className={getActionClassName(props.tipoManejo === "pesagem")}
        disabled={props.selectedAnimaisCount === 0}
        onClick={() => props.onSelectAction("pesagem")}
      >
        <Scale className="h-6 w-6" /> Pesagem
      </Button>
      <Button
        variant="outline"
        className={getActionClassName(props.tipoManejo === "movimentacao")}
        disabled={props.selectedAnimaisCount === 0}
        onClick={() => props.onSelectAction("movimentacao")}
      >
        <Move className="h-6 w-6" /> Mover
      </Button>
      <Button
        variant="outline"
        className={getActionClassName(props.tipoManejo === "nutricao")}
        disabled={props.selectedAnimaisCount === 0}
        onClick={() => props.onSelectAction("nutricao")}
      >
        <Scale className="h-6 w-6" /> Nutricao
      </Button>
      <Button
        variant="outline"
        className={getActionClassName(props.tipoManejo === "financeiro")}
        onClick={() => props.onSelectAction("financeiro")}
      >
        <Move className="h-6 w-6" /> Financeiro
      </Button>
      <Button
        variant="outline"
        className={getActionClassName(props.tipoManejo === "reproducao")}
        onClick={() => props.onSelectAction("reproducao")}
        disabled={props.selectedAnimaisCount === 0}
      >
        <div className="h-6 w-6 rounded-full border-2 border-current" /> Reproducao
      </Button>
    </div>
  );
}
