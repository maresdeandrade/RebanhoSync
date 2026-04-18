import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

type RegistrarAnimalSelectionRecord = {
  id: string;
  identificacao: string;
  sexo: "M" | "F";
};

type RegistrarAnimalSelectionPanelProps = {
  selectedAnimaisCount: number;
  selectedVisibleCount: number;
  filteredAnimaisNoLote: RegistrarAnimalSelectionRecord[];
  visibleAnimalIds: string[];
  selectedAnimais: string[];
  animalSearch: string;
  onAnimalSearchChange: (value: string) => void;
  onSelectVisible: (visibleIds: string[]) => void;
  onClearSelection: () => void;
  onToggleAnimalSelection: (animalId: string, checked: boolean) => void;
};

export function RegistrarAnimalSelectionPanel(props: RegistrarAnimalSelectionPanelProps) {
  return (
    <>
      <div className="rounded-lg border border-border/70 bg-muted/25 p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {props.selectedAnimaisCount} animal(is) selecionado(s)
            </p>
            <p className="text-xs text-muted-foreground">
              Filtre por identificacao, nome, RFID ou sexo para reduzir erro de selecao.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={
                props.filteredAnimaisNoLote.length === 0 ||
                props.selectedVisibleCount === props.filteredAnimaisNoLote.length
              }
              onClick={() => props.onSelectVisible(props.visibleAnimalIds)}
            >
              Selecionar visiveis
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={props.selectedAnimaisCount === 0}
              onClick={props.onClearSelection}
            >
              Limpar selecao
            </Button>
          </div>
        </div>

        <div className="relative mt-3">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            value={props.animalSearch}
            onChange={(event) => props.onAnimalSearchChange(event.target.value)}
            placeholder="Buscar animal neste lote"
            aria-label="Buscar animal no lote selecionado"
          />
        </div>
      </div>

      <div className="max-h-64 divide-y overflow-y-auto rounded-lg border">
        {props.filteredAnimaisNoLote.map((animal) => (
          <label
            key={animal.id}
            htmlFor={`registrar-animal-${animal.id}`}
            className="flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-muted/35"
          >
            <Checkbox
              id={`registrar-animal-${animal.id}`}
              aria-label={`Selecionar animal ${animal.identificacao}`}
              checked={props.selectedAnimais.includes(animal.id)}
              onCheckedChange={(checked) =>
                props.onToggleAnimalSelection(animal.id, checked === true)
              }
            />
            <span className="font-medium">{animal.identificacao}</span>
            <span className="text-xs text-muted-foreground">
              {animal.sexo === "M" ? "Macho" : "Femea"}
            </span>
          </label>
        ))}
      </div>
    </>
  );
}