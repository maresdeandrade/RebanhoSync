import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Layers } from "lucide-react";

export interface AnimalSimulacaoCtaProps {
  animalId: string;
  className?: string;
}

export function AnimalSimulacaoCta({ animalId, className }: AnimalSimulacaoCtaProps) {
  return (
    <Button asChild variant="outline" size="sm" className={className}>
      <Link to={`/animais/${animalId}/simulacao`}>
        <Layers className="mr-2 h-4 w-4" />
        Simular cenário
      </Link>
    </Button>
  );
}
