import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
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
import { isAnimalBreedingEligible } from "@/lib/animals/maleProfile";
import { showSuccess, showError } from "@/utils/toast";

interface TrocarTouroLoteProps {
  lote: {
    id: string;
    fazenda_id: string;
    nome: string;
    touro_id?: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function TrocarTouroLote({
  lote,
  open,
  onOpenChange,
  onSuccess,
}: TrocarTouroLoteProps) {
  const [novoTouroId, setNovoTouroId] = useState<string>("null");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const touros = useLiveQuery(
    () =>
      db.state_animais
        .filter(
          (animal) =>
            animal.fazenda_id === lote.fazenda_id &&
            animal.lote_id === lote.id &&
            animal.sexo === "M" &&
            (!animal.deleted_at || animal.deleted_at === null) &&
            isAnimalBreedingEligible(animal),
        )
        .toArray(),
    [lote.fazenda_id, lote.id],
  );

  const touroAtual = useLiveQuery(
    () => (lote.touro_id ? db.state_animais.get(lote.touro_id) : null),
    [lote.touro_id],
  );

  const handleConfirm = async () => {
    setIsSubmitting(true);
    const now = new Date().toISOString();

    const op = {
      table: "lotes",
      action: "UPDATE" as const,
      record: {
        id: lote.id,
        touro_id: novoTouroId === "null" ? null : novoTouroId,
        updated_at: now,
      },
    };

    try {
      await createGesture(lote.fazenda_id, [op]);
      showSuccess(`Reprodutor do lote ${lote.nome} atualizado.`);
      setNovoTouroId("null");
      onSuccess();
      onOpenChange(false);
    } catch {
      showError("Erro ao trocar touro do lote.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Trocar reprodutor do lote</DialogTitle>
          <DialogDescription>
            Ajuste o macho responsavel pela cobertura do lote{" "}
            <strong>{lote.nome}</strong>.
          </DialogDescription>
        </DialogHeader>

        <FormSection
          title="Reprodutor ativo"
          description="Somente machos elegiveis e presentes no lote aparecem como opcao para evitar configuracoes incoerentes."
          actions={
            touroAtual ? (
              <StatusBadge tone="neutral">
                Atual: {touroAtual.identificacao}
              </StatusBadge>
            ) : (
              <StatusBadge tone="neutral">Sem touro definido</StatusBadge>
            )
          }
          contentClassName="space-y-4"
        >
          <div className="space-y-2">
            <Label>Novo touro</Label>
            <Select value={novoTouroId} onValueChange={setNovoTouroId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o touro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">Nenhum (remover touro)</SelectItem>
                {touros?.map((touro) => (
                  <SelectItem key={touro.id} value={touro.id}>
                    {touro.identificacao}
                    {touro.nome ? ` (${touro.nome})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {touros && touros.length === 0 ? (
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
              Nenhum macho elegivel foi encontrado neste lote. Ajuste o perfil
              do animal antes de defini-lo como reprodutor.
            </div>
          ) : null}
        </FormSection>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting || novoTouroId === lote.touro_id}
          >
            {isSubmitting ? "Alterando..." : "Salvar reprodutor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
