import { ChevronRight } from "lucide-react";

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

type RegistrarSelectTargetStepProps<QuickActionKey extends string = string> = {
  quickAction: QuickActionKey | null;
  onApplyQuickAction: (action: QuickActionKey) => void;
  onClearQuickAction: () => void;
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
  requiresAnimalsForQuickAction: boolean;
  quickActionLabel: string | null;
  onNext: () => void;
};

export function RegistrarSelectTargetStep<
  QuickActionKey extends string = string,
>(props: RegistrarSelectTargetStepProps<QuickActionKey>) {
  return (
    <Card className="overflow-hidden border-sky-200/70 shadow-sm dark:border-sky-900/60">
      <CardHeader className="border-b border-sky-100 bg-sky-50/70 dark:border-sky-900/50 dark:bg-sky-950/20">
        <CardTitle className="text-base">1. Alvo do manejo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
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

        {props.selectedLoteId ? (
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
                  ? "Nao ha animais sem lote."
                  : "Lote vazio. Compra ou sociedade podem ser registradas pelo financeiro."}
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

        {props.requiresAnimalsForQuickAction ? (
          <p className="rounded-xl border border-amber-200/70 bg-amber-50/70 p-3 text-sm font-medium text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            Esta acao exige ao menos um animal selecionado antes de continuar.
          </p>
        ) : null}

        <Button
          className="min-h-12 w-full bg-[#0057C2] text-base font-semibold text-white hover:bg-[#00479f]"
          disabled={
            !props.selectedLoteId || props.requiresAnimalsForQuickAction
          }
          onClick={props.onNext}
        >
          {props.quickActionLabel
            ? `Continuar para ${props.quickActionLabel}`
            : "Escolher manejo"}{" "}
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
