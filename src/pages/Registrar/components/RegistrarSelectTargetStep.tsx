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
import {
  RegistrarQuickActionsGrid,
  type RegistrarQuickActionOption,
} from "@/pages/Registrar/components/RegistrarQuickActionsGrid";

type RegistrarSelectTargetStepProps<QuickActionKey extends string = string> = {
  quickAction: QuickActionKey | null;
  quickActions: RegistrarQuickActionOption<QuickActionKey>[];
  onApplyQuickAction: (action: QuickActionKey) => void;
  onClearQuickAction: () => void;
  selectedLoteId: string;
  onSelectedLoteIdChange: (value: string) => void;
  semLoteOption: string;
  lotes: Array<{ id: string; nome: string }>;
  selectedAnimaisCount: number;
  selectedVisibleCount: number;
  filteredAnimaisNoLote: Array<{ id: string; identificacao: string; sexo: "M" | "F" }>;
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

export function RegistrarSelectTargetStep<QuickActionKey extends string = string>(
  props: RegistrarSelectTargetStepProps<QuickActionKey>,
) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>1. Selecionar Alvo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Manejos mais usados</p>
              <p className="text-sm text-muted-foreground">
                Escolha um atalho e depois selecione o lote e os animais.
              </p>
            </div>
            {props.quickAction ? (
              <Button type="button" variant="ghost" size="sm" onClick={props.onClearQuickAction}>
                Limpar atalho
              </Button>
            ) : null}
          </div>

          <RegistrarQuickActionsGrid
            actions={props.quickActions}
            activeAction={props.quickAction}
            selectedAnimalsCount={props.selectedAnimaisCount}
            disableRequiresAnimals={false}
            onSelectAction={props.onApplyQuickAction}
          />
        </div>

        <div className="space-y-2">
          <Label>Lote</Label>
          <Select onValueChange={props.onSelectedLoteIdChange} value={props.selectedLoteId}>
            <SelectTrigger>
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
                  ? "Nao ha animais sem lote cadastrados."
                  : "Este lote ainda nao possui animais. Voce pode registrar compra ou sociedade por lote."}
              </p>
            ) : null}

            {props.animaisNoLoteCount > 0 && props.filteredAnimaisNoLote.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum animal encontrado com este filtro.
              </p>
            ) : null}
          </>
        ) : null}

        {props.requiresAnimalsForQuickAction ? (
          <p className="text-sm text-amber-700">
            Esta acao exige ao menos um animal selecionado antes de continuar.
          </p>
        ) : null}

        <Button
          className="w-full"
          disabled={!props.selectedLoteId || props.requiresAnimalsForQuickAction}
          onClick={props.onNext}
        >
          {props.quickActionLabel ? `Continuar para ${props.quickActionLabel}` : "Próximo"}{" "}
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
