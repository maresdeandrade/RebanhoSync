import { Move, Scale, Syringe } from "lucide-react";

import { Button } from "@/components/ui/button";

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
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
      <Button
        variant={props.tipoManejo === "sanitario" ? "default" : "outline"}
        className="h-24 flex-col gap-2"
        disabled={props.selectedAnimaisCount === 0}
        onClick={() => props.onSelectAction("sanitario")}
      >
        <Syringe className="h-6 w-6" /> Sanitario
      </Button>
      <Button
        variant={props.tipoManejo === "pesagem" ? "default" : "outline"}
        className="h-24 flex-col gap-2"
        disabled={props.selectedAnimaisCount === 0}
        onClick={() => props.onSelectAction("pesagem")}
      >
        <Scale className="h-6 w-6" /> Pesagem
      </Button>
      <Button
        variant={props.tipoManejo === "movimentacao" ? "default" : "outline"}
        className="h-24 flex-col gap-2"
        disabled={props.selectedAnimaisCount === 0}
        onClick={() => props.onSelectAction("movimentacao")}
      >
        <Move className="h-6 w-6" /> Mover
      </Button>
      <Button
        variant={props.tipoManejo === "nutricao" ? "default" : "outline"}
        className="h-24 flex-col gap-2"
        disabled={props.selectedAnimaisCount === 0}
        onClick={() => props.onSelectAction("nutricao")}
      >
        <Scale className="h-6 w-6" /> Nutricao
      </Button>
      <Button
        variant={props.tipoManejo === "financeiro" ? "default" : "outline"}
        className="h-24 flex-col gap-2"
        onClick={() => props.onSelectAction("financeiro")}
      >
        <Move className="h-6 w-6" /> Financeiro
      </Button>
      <Button
        variant={props.tipoManejo === "reproducao" ? "default" : "outline"}
        className="h-24 flex-col gap-2"
        onClick={() => props.onSelectAction("reproducao")}
        disabled={props.selectedAnimaisCount === 0}
      >
        <div className="h-6 w-6 rounded-full border-2 border-current" /> Reproducao
      </Button>
    </div>
  );
}