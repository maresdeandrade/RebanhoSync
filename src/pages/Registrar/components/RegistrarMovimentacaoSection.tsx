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
    <div className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-4">
      <div className="space-y-2">
        <Label>Lote Destino</Label>
        <Select onValueChange={props.onMovimentacaoDestinoChange} value={props.movimentacaoDestinoId}>
          <SelectTrigger className="h-12 rounded-xl bg-background">
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
      </div>
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

