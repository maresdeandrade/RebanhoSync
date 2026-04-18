import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RegistrarMovimentacaoSectionProps = {
  movimentacaoDestinoId: string;
  onMovimentacaoDestinoChange: (value: string) => void;
  lotesDestino: Array<{ id: string; nome: string }>;
  movimentacaoSemDestino: boolean;
  movimentacaoDestinoIgualOrigem: boolean;
  transitChecklistSection: ReactNode;
  sanitaryMovementBlockSection: ReactNode;
  movementComplianceBlockSection: ReactNode;
};

export function RegistrarMovimentacaoSection(props: RegistrarMovimentacaoSectionProps) {
  return (
    <div className="space-y-4 border-t pt-4">
      <Label>Lote Destino</Label>
      <Select onValueChange={props.onMovimentacaoDestinoChange} value={props.movimentacaoDestinoId}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione o destino" />
        </SelectTrigger>
        <SelectContent>
          {props.lotesDestino.map((lote) => (
            <SelectItem key={lote.id} value={lote.id}>
              {lote.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {props.movimentacaoSemDestino ? (
        <p className="text-xs text-destructive">Selecione o lote de destino antes de continuar.</p>
      ) : null}
      {props.movimentacaoDestinoIgualOrigem ? (
        <p className="text-xs text-destructive">Origem e destino devem ser diferentes.</p>
      ) : null}
      {props.transitChecklistSection}
      {props.sanitaryMovementBlockSection}
      {props.movementComplianceBlockSection}
    </div>
  );
}
