import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import type { OperationInput } from "@/lib/offline/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { showSuccess, showError } from "@/utils/toast";

interface MoverAnimalLoteProps {
  animal: {
    id: string;
    fazenda_id: string;
    identificacao: string;
    lote_id?: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function MoverAnimalLote({
  animal,
  open,
  onOpenChange,
  onSuccess,
}: MoverAnimalLoteProps) {
  const [novoLoteId, setNovoLoteId] = useState<string>("null");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Buscar lotes disponíveis
  const lotes = useLiveQuery(
    () =>
      db.state_lotes
        .filter(
          (l) =>
            l.fazenda_id === animal.fazenda_id &&
            (!l.deleted_at || l.deleted_at === null),
        )
        .toArray(),
    [animal.fazenda_id],
  );

  // Buscar lote atual
  const loteAtual = useLiveQuery(
    () => (animal.lote_id ? db.state_lotes.get(animal.lote_id) : null),
    [animal.lote_id],
  );

  const handleConfirm = async () => {
    setIsSubmitting(true);
    const now = new Date().toISOString();
    const novoLote = novoLoteId === "null" ? null : novoLoteId;
    const eventoId = crypto.randomUUID();

    const ops: OperationInput[] = [
      {
        table: "eventos",
        action: "INSERT",
        record: {
          id: eventoId,
          dominio: "movimentacao",
          occurred_at: now,
          animal_id: animal.id,
          lote_id: animal.lote_id ?? null,
          observacoes: "Movimentacao de lote",
        },
      },
      {
        table: "eventos_movimentacao",
        action: "INSERT",
        record: {
          evento_id: eventoId,
          from_lote_id: animal.lote_id ?? null,
          to_lote_id: novoLote,
        },
      },
      {
        table: "animais",
        action: "UPDATE",
        record: {
          id: animal.id,
          lote_id: novoLote,
          updated_at: now,
        },
      },
    ];

    try {
      await createGesture(animal.fazenda_id, ops);
      const msg =
        novoLoteId === "null"
          ? `Animal ${animal.identificacao} removido do lote!`
          : `Animal ${animal.identificacao} movido para novo lote!`;
      showSuccess(msg);
      setNovoLoteId("null");
      onSuccess();
      onOpenChange(false);
    } catch (e) {
      showError("Erro ao mover animal.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mover Animal</DialogTitle>
          <DialogDescription>
            Selecione o novo lote para <strong>{animal.identificacao}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loteAtual && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">Lote Atual</p>
              <p className="text-lg">{loteAtual.nome}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Novo Lote</Label>
            <Select value={novoLoteId} onValueChange={setNovoLoteId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o lote" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">Nenhum (remover do lote)</SelectItem>
                {lotes?.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting || novoLoteId === animal.lote_id}
          >
            {isSubmitting ? "Movendo..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
