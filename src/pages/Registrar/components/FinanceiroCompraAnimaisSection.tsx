import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  CompraNovoAnimalDraft,
  RegistrarSexo,
} from "@/pages/Registrar/types";

type FinanceiroCompraAnimaisSectionProps = {
  drafts: CompraNovoAnimalDraft[];
  isIndividualWeightMode: boolean;
  weightInputStep: number;
  weightUnitLabel: string;
  onIdentificacaoChange: (localId: string, value: string) => void;
  onSexoChange: (localId: string, value: RegistrarSexo) => void;
  onDataNascimentoChange: (localId: string, value: string) => void;
  onPesoChange: (localId: string, value: string) => void;
};

export function FinanceiroCompraAnimaisSection(
  props: FinanceiroCompraAnimaisSectionProps,
) {
  return (
    <div className="space-y-3 rounded-md border p-3">
      <div>
        <Label>Animais gerados pela compra</Label>
        <p className="text-xs text-muted-foreground">
          Identificacao pode ficar vazia. O sistema gera automaticamente.
        </p>
      </div>

      {props.drafts.map((draft, index) => (
        <div
          key={draft.localId}
          className="grid grid-cols-1 gap-2 rounded border p-2 md:grid-cols-[1.2fr_140px_170px_140px]"
        >
          <Input
            value={draft.identificacao}
            onChange={(event) =>
              props.onIdentificacaoChange(draft.localId, event.target.value)
            }
            placeholder={`Identificacao do animal ${index + 1}`}
          />
          <Select
            value={draft.sexo}
            onValueChange={(value) =>
              props.onSexoChange(draft.localId, value as RegistrarSexo)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="F">Femea</SelectItem>
              <SelectItem value="M">Macho</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={draft.dataNascimento}
            onChange={(event) =>
              props.onDataNascimentoChange(draft.localId, event.target.value)
            }
          />
          <Input
            type="number"
            step={props.weightInputStep}
            value={draft.pesoKg}
            disabled={!props.isIndividualWeightMode}
            onChange={(event) => props.onPesoChange(draft.localId, event.target.value)}
            placeholder={`Peso ${props.weightUnitLabel}`}
          />
        </div>
      ))}
    </div>
  );
}
