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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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

  // Buscar touros disponíveis (machos reprodutores habilitados DO LOTE)
  const touros = useLiveQuery(
    () =>
      db.state_animais
        .filter(
          (a) =>
            a.fazenda_id === lote.fazenda_id &&
            a.lote_id === lote.id && // ✅ APENAS do lote atual!
            a.sexo === "M" &&
            (!a.deleted_at || a.deleted_at === null) &&
            isAnimalBreedingEligible(a),
        )
        .toArray(),
    [lote.fazenda_id, lote.id],
  );

  // Buscar touro atual
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
      showSuccess(`Touro do lote ${lote.nome} atualizado!`);
      setNovoTouroId("null");
      onSuccess();
      onOpenChange(false);
    } catch (e) {
      showError("Erro ao trocar touro do lote.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Trocar Touro do Lote</DialogTitle>
          <DialogDescription>
            Selecione o novo touro para o lote <strong>{lote.nome}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {touroAtual && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">Touro Atual</p>
              <p className="text-lg">{touroAtual.identificacao}</p>
              {touroAtual.nome && (
                <p className="text-xs text-muted-foreground mt-1">
                  {touroAtual.nome}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Novo Touro</Label>
            <Select value={novoTouroId} onValueChange={setNovoTouroId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o touro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">Nenhum (remover touro)</SelectItem>
                {touros?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.identificacao}
                    {t.nome && ` (${t.nome})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {touros && touros.length === 0 && (
            <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
              Nenhum touro disponivel. Defina um macho como reprodutor e deixe
              o status reprodutivo como apto.
            </div>
          )}
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
            disabled={isSubmitting || novoTouroId === lote.touro_id}
          >
            {isSubmitting ? "Alterando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
