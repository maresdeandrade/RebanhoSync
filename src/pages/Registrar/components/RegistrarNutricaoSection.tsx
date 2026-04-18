import type { ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type RegistrarNutricaoSectionProps = {
  alimentoNome: string;
  onAlimentoNomeChange: (value: string) => void;
  quantidadeKg: string;
  onQuantidadeKgChange: (value: string) => void;
  nutricaoAlimentoMissing: boolean;
  nutricaoQuantidadeInvalida: boolean;
  nutritionComplianceBlockSection: ReactNode;
};

export function RegistrarNutricaoSection(props: RegistrarNutricaoSectionProps) {
  return (
    <div className="space-y-4 border-t pt-4">
      <div className="space-y-2">
        <Label>Alimento</Label>
        <Input
          className={cn(
            props.nutricaoAlimentoMissing && "border-destructive focus-visible:ring-destructive/30",
          )}
          value={props.alimentoNome}
          onChange={(event) => props.onAlimentoNomeChange(event.target.value)}
          placeholder="Ex.: racao proteica"
        />
        {props.nutricaoAlimentoMissing ? (
          <p className="text-xs text-destructive">Informe o alimento usado neste manejo.</p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label>Quantidade (kg)</Label>
        <Input
          className={cn(
            props.nutricaoQuantidadeInvalida && "border-destructive focus-visible:ring-destructive/30",
          )}
          type="number"
          step="0.001"
          value={props.quantidadeKg}
          onChange={(event) => props.onQuantidadeKgChange(event.target.value)}
        />
        {props.nutricaoQuantidadeInvalida ? (
          <p className="text-xs text-destructive">Quantidade deve ser maior que zero.</p>
        ) : null}
      </div>
      {props.nutritionComplianceBlockSection}
    </div>
  );
}
