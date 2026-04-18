import type { Animal } from "@/lib/offline/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CompraNovoAnimalDraft } from "@/pages/Registrar/types";

type FinanceiroVendaPesosSectionProps = {
  selectedAnimalIds: string[];
  animaisNoLote: Animal[] | undefined;
  drafts: CompraNovoAnimalDraft[];
  weightInputStep: number;
  weightUnitLabel: string;
  onPesoAtIndexChange: (index: number, value: string) => void;
};

export function FinanceiroVendaPesosSection(
  props: FinanceiroVendaPesosSectionProps,
) {
  return (
    <div className="space-y-3 rounded-md border p-3">
      <div>
        <Label>Pesos individuais da venda</Label>
        <p className="text-xs text-muted-foreground">
          Esses pesos geram pesagens no mesmo gesto da saida.
        </p>
      </div>

      {props.selectedAnimalIds.map((animalId, index) => {
        const animal = props.animaisNoLote?.find((item) => item.id === animalId);
        const currentDraft = props.drafts[index];

        return (
          <div
            key={animalId}
            className="grid grid-cols-1 gap-2 rounded border p-2 md:grid-cols-[1fr_180px]"
          >
            <div className="flex items-center text-sm font-medium">
              {animal?.identificacao ?? animalId}
            </div>
            <Input
              type="number"
              step={props.weightInputStep}
              value={currentDraft?.pesoKg ?? ""}
              onChange={(event) =>
                props.onPesoAtIndexChange(index, event.target.value)
              }
              placeholder={`Peso ${props.weightUnitLabel}`}
            />
          </div>
        );
      })}
    </div>
  );
}
