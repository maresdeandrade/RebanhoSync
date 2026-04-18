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
  return (
    <div className="max-h-64 space-y-4 overflow-y-auto border-t pt-4">
      {props.selectedAnimalIds.map((animalId) => {
        const animal = props.animaisNoLote?.find((item) => item.id === animalId);
        const isInvalid = props.invalidAnimalIds.includes(animalId);
        return (
          <div key={animalId} className="flex items-start justify-between gap-4">
            <Label className="w-24 pt-2">{animal?.identificacao}</Label>
            <div className="flex-1 space-y-1">
              <Input
                className={cn(isInvalid && "border-destructive focus-visible:ring-destructive/30")}
                type="number"
                step={props.weightInputStep}
                placeholder={`Peso (${props.weightUnitLabel})`}
                value={props.pesagemData[animalId] || ""}
                onChange={(event) => props.onPesoChange(animalId, event.target.value)}
              />
              {isInvalid ? <p className="text-xs text-destructive">Peso deve ser maior que zero.</p> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
