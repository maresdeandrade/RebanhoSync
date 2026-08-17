import { ChevronRight, ChevronLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RegistrarAnimalSelectionPanel } from "@/pages/Registrar/components/RegistrarAnimalSelectionPanel";
import type { RegistrarTargetMode } from "@/pages/Registrar/helpers/commercialForm";

type RegistrarSelectTargetStepProps = {
  targetMode: RegistrarTargetMode | null;
  onTargetModeChange: (mode: RegistrarTargetMode) => void;
  selectedLoteId: string;
  onSelectedLoteIdChange: (value: string) => void;
  semLoteOption: string;
  lotes: Array<{ id: string; nome: string }>;
  selectedAnimaisCount: number;
  selectedVisibleCount: number;
  filteredAnimaisNoLote: Array<{
    id: string;
    identificacao: string;
    sexo: "M" | "F";
  }>;
  visibleAnimalIds: string[];
  selectedAnimais: string[];
  animalSearch: string;
  onAnimalSearchChange: (value: string) => void;
  onSelectVisible: (visibleIds: string[]) => void;
  onClearSelection: () => void;
  onToggleAnimalSelection: (animalId: string, checked: boolean) => void;
  animaisNoLoteCount: number;
  onNext: () => void;
  onBack: () => void;
};

export function RegistrarSelectTargetStep(
  props: RegistrarSelectTargetStepProps,
) {
  const hasExistingTarget =
    props.selectedLoteId.trim().length > 0 || props.selectedAnimaisCount > 0;
  const canContinue =
    props.targetMode === "none" ||
    (props.targetMode === "existing" && hasExistingTarget);

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
        <CardTitle className="text-base">Alvo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-3">
          <Label>Contexto do registro</Label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { value: "existing", label: "Com animais ou lote existentes" },
                { value: "none", label: "Sem animal ou lote existente" },
              ] as const
            ).map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={
                  props.targetMode === option.value ? "default" : "outline"
                }
                onClick={() => props.onTargetModeChange(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {props.targetMode === "existing" ? (
          <div className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <Label>Lote</Label>
              <span className="text-xs text-muted-foreground">
                {props.animaisNoLoteCount} animal(is)
              </span>
            </div>
            <Select
              onValueChange={props.onSelectedLoteIdChange}
              value={props.selectedLoteId}
            >
              <SelectTrigger className="min-h-11">
                <SelectValue placeholder="Selecione o lote" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={props.semLoteOption}>Sem lote</SelectItem>
                {props.lotes.map((lote) => (
                  <SelectItem key={lote.id} value={lote.id}>
                    {lote.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {props.targetMode === "existing" && props.selectedLoteId ? (
          <>
            <RegistrarAnimalSelectionPanel
              selectedAnimaisCount={props.selectedAnimaisCount}
              selectedVisibleCount={props.selectedVisibleCount}
              filteredAnimaisNoLote={props.filteredAnimaisNoLote}
              visibleAnimalIds={props.visibleAnimalIds}
              selectedAnimais={props.selectedAnimais}
              animalSearch={props.animalSearch}
              onAnimalSearchChange={props.onAnimalSearchChange}
              onSelectVisible={props.onSelectVisible}
              onClearSelection={props.onClearSelection}
              onToggleAnimalSelection={props.onToggleAnimalSelection}
            />

            {props.animaisNoLoteCount === 0 ? (
              <p className="text-sm text-muted-foreground">
                {props.selectedLoteId === props.semLoteOption
                  ? "Sem animais fora de lote."
                  : "Lote vazio."}
              </p>
            ) : null}

            {props.animaisNoLoteCount > 0 &&
            props.filteredAnimaisNoLote.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum animal encontrado com este filtro.
              </p>
            ) : null}
          </>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            className="min-h-12 rounded-xl border-2 px-6"
            onClick={props.onBack}
          >
            <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
          <Button
            className="min-h-12 flex-1 rounded-xl text-base font-semibold"
            disabled={!canContinue}
            onClick={props.onNext}
          >
            Escolher manejo <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
