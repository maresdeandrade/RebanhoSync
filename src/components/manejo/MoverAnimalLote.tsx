import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { useLotes } from "@/hooks/useLotes";
import { createGesture } from "@/lib/offline/ops";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { EventValidationError } from "@/lib/events/validators";
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
  const [novoLoteId, setNovoLoteId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Buscar lotes disponíveis
  const lotes = useLotes(animal.fazenda_id);

  // Buscar lote atual
  const loteAtual = useLiveQuery(
    () => (animal.lote_id ? db.state_lotes.get(animal.lote_id) : null),
    [animal.lote_id],
  );

  const handleConfirm = async () => {
    if (!novoLoteId) {
      showError("Selecione o lote de destino.");
      return;
    }

    setIsSubmitting(true);
    const now = new Date().toISOString();
    const novoLote = novoLoteId;

    try {
      const { ops } = buildEventGesture({
        dominio: "movimentacao",
        fazendaId: animal.fazenda_id,
        occurredAt: now,
        animalId: animal.id,
        loteId: animal.lote_id ?? null,
        fromLoteId: animal.lote_id ?? null,
        toLoteId: novoLote,
        observacoes: "Movimentacao de lote",
      });

      await createGesture(animal.fazenda_id, ops);
      const msg = `Animal ${animal.identificacao} movido para novo lote!`;
      showSuccess(msg);
      setNovoLoteId("");
      onSuccess();
      onOpenChange(false);
    } catch (e: unknown) {
      if (e instanceof EventValidationError) {
        showError(e.issues[0]?.message ?? "Dados invalidos para movimentacao.");
        return;
      }
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
            disabled={isSubmitting || !novoLoteId || novoLoteId === animal.lote_id}
          >
            {isSubmitting ? "Movendo..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
