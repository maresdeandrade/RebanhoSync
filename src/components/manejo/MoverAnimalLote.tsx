import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { db } from "@/lib/offline/db";
import { useLotes } from "@/hooks/useLotes";
import { createGesture } from "@/lib/offline/ops";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { EventValidationError } from "@/lib/events/validators";
import { getAnimalSanitaryAlertBlockReason } from "@/lib/sanitario/compliance/alerts";
import {
  buildRegulatoryOperationalReadModel,
  loadRegulatorySurfaceSource,
} from "@/lib/sanitario/compliance/regulatoryReadModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormSection } from "@/components/ui/form-section";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
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

  const lotes = useLotes(animal.fazenda_id);
  const loteAtual = useLiveQuery(
    () => (animal.lote_id ? db.state_lotes.get(animal.lote_id) : null),
    [animal.lote_id],
  );
  const animalRecord = useLiveQuery(
    () => db.state_animais.get(animal.id),
    [animal.id],
  );
  const regulatorySurfaceSource = useLiveQuery(
    () => loadRegulatorySurfaceSource(animal.fazenda_id),
    [animal.fazenda_id],
  );
  const sanitaryBlockReason = animalRecord
    ? getAnimalSanitaryAlertBlockReason(animalRecord)
    : null;
  const regulatoryReadModel = useMemo(
    () =>
      buildRegulatoryOperationalReadModel(
        regulatorySurfaceSource ?? undefined,
      ),
    [regulatorySurfaceSource],
  );
  const movementComplianceGuards = regulatoryReadModel.flows.movementInternal;
  const complianceBlockReason = movementComplianceGuards.blockers[0]?.message ?? null;

  const handleConfirm = async () => {
    if (sanitaryBlockReason) {
      showError(sanitaryBlockReason);
      return;
    }

    if (complianceBlockReason) {
      showError(complianceBlockReason);
      return;
    }

    if (!novoLoteId) {
      showError("Selecione o lote de destino.");
      return;
    }

    setIsSubmitting(true);
    const now = new Date().toISOString();

    try {
      const { ops } = buildEventGesture({
        dominio: "movimentacao",
        fazendaId: animal.fazenda_id,
        occurredAt: now,
        animalId: animal.id,
        loteId: animal.lote_id ?? null,
        fromLoteId: animal.lote_id ?? null,
        toLoteId: novoLoteId,
        observacoes: "Movimentacao de lote",
      });

      await createGesture(animal.fazenda_id, ops);
      showSuccess(`Animal ${animal.identificacao} movido para o novo lote.`);
      setNovoLoteId("");
      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      if (error instanceof EventValidationError) {
        showError(error.issues[0]?.message ?? "Dados invalidos para movimentacao.");
        return;
      }
      showError("Erro ao mover animal.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Mover animal</DialogTitle>
          <DialogDescription>
            Ajuste o lote de <strong>{animal.identificacao}</strong> com contexto
            claro de origem e destino.
          </DialogDescription>
        </DialogHeader>

        <FormSection
          title="Destino operacional"
          description="Use esse dialog quando o ajuste for pontual. Para movimento em massa, prefira o detalhe do lote."
          actions={
            loteAtual ? (
              <StatusBadge tone="neutral">Atual: {loteAtual.nome}</StatusBadge>
            ) : (
              <StatusBadge tone="neutral">Sem lote atual</StatusBadge>
            )
          }
          contentClassName="space-y-4"
        >
          <div className="space-y-2">
            <Label>Novo lote</Label>
            <Select value={novoLoteId} onValueChange={setNovoLoteId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o lote de destino" />
              </SelectTrigger>
              <SelectContent>
                {lotes?.map((lote) => (
                  <SelectItem key={lote.id} value={lote.id}>
                    {lote.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {sanitaryBlockReason ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {sanitaryBlockReason}
            </div>
          ) : null}
          {!sanitaryBlockReason && complianceBlockReason ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {complianceBlockReason}
            </div>
          ) : null}
        </FormSection>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              isSubmitting ||
              !novoLoteId ||
              novoLoteId === animal.lote_id ||
              Boolean(sanitaryBlockReason) ||
              Boolean(complianceBlockReason)
            }
          >
            {isSubmitting ? "Movendo..." : "Confirmar movimentacao"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
