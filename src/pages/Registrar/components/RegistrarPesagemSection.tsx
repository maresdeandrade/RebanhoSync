import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type RegistrarPesagemSectionProps = {
  selectedAnimalIds: string[];
  animaisNoLote: Array<{ id: string; identificacao: string }> | undefined;
  invalidAnimalIds: string[];
  weightInputStep: number;
  weightUnitLabel: string;
  pesagemData: Record<string, string>;
  onPesoChange: (animalId: string, value: string) => void;
};

export function RegistrarPesagemSection(props: RegistrarPesagemSectionProps) {
  const sectionId = useId();
  return (
    <div className="max-h-64 space-y-3 overflow-y-auto rounded-xl border border-border/70 bg-muted/20 p-4">
      {props.selectedAnimalIds.map((animalId) => {
        const animal = props.animaisNoLote?.find((item) => item.id === animalId);
        const isInvalid = props.invalidAnimalIds.includes(animalId);
        const inputId = `${sectionId}-peso-${animalId}`;
        const errorId = `${inputId}-error`;
        return (
          <div
            key={animalId}
            className="flex items-start justify-between gap-4 rounded-lg bg-background/80 p-3"
          >
            <Label htmlFor={inputId} className="w-24 pt-2">
              <span aria-hidden="true">{animal?.identificacao}</span>
              <span className="sr-only">{`Peso do animal ${animal?.identificacao ?? animalId} (${props.weightUnitLabel})`}</span>
            </Label>
            <div className="flex-1 space-y-1">
              <Input
                id={inputId}
                aria-invalid={isInvalid}
                aria-describedby={isInvalid ? errorId : undefined}
                className={cn("h-12 rounded-xl bg-background", isInvalid && "border-destructive focus-visible:ring-destructive/30")}
                type="number"
                step={props.weightInputStep}
                placeholder={`Peso (${props.weightUnitLabel})`}
                value={props.pesagemData[animalId] || ""}
                onChange={(event) => props.onPesoChange(animalId, event.target.value)}
              />
              {isInvalid ? <p id={errorId} className="text-xs text-destructive">Peso deve ser maior que zero.</p> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

