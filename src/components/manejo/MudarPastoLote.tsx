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
import { Badge } from "@/components/ui/badge";
import { showSuccess, showError } from "@/utils/toast";
import { AlertCircle } from "lucide-react";

interface MudarPastoLoteProps {
  lote: {
    id: string;
    fazenda_id: string;
    nome: string;
    pasto_id?: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function MudarPastoLote({
  lote,
  open,
  onOpenChange,
  onSuccess,
}: MudarPastoLoteProps) {
  const [novoPastoId, setNovoPastoId] = useState<string>("null");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Buscar pastos disponíveis
  const pastos = useLiveQuery(
    () =>
      db.state_pastos
        .filter(
          (p) =>
            p.fazenda_id === lote.fazenda_id &&
            (!p.deleted_at || p.deleted_at === null),
        )
        .toArray(),
    [lote.fazenda_id],
  );

  // Buscar pasto atual
  const pastoAtual = useLiveQuery(
    () => (lote.pasto_id ? db.state_pastos.get(lote.pasto_id) : null),
    [lote.pasto_id],
  );

  // Buscar animais no lote para calcular lotação
  const animaisLote = useLiveQuery(
    () => db.state_animais.where("lote_id").equals(lote.id).count(),
    [lote.id],
  );

  const pastoSelecionado = pastos?.find((p) => p.id === novoPastoId);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    const now = new Date().toISOString();

    const op = {
      table: "lotes",
      action: "UPDATE" as const,
      record: {
        id: lote.id,
        pasto_id: novoPastoId === "null" ? null : novoPastoId,
        updated_at: now,
      },
    };

    try {
      await createGesture(lote.fazenda_id, [op]);
      showSuccess(`Pasto do lote ${lote.nome} atualizado!`);
      setNovoPastoId("null");
      onSuccess();
      onOpenChange(false);
    } catch (e) {
      showError("Erro ao mudar pasto do lote.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mudar Pasto do Lote</DialogTitle>
          <DialogDescription>
            Selecione o novo pasto para o lote <strong>{lote.nome}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {pastoAtual && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">Pasto Atual</p>
              <p className="text-lg">{pastoAtual.nome}</p>
              {pastoAtual.capacidade_ua && (
                <p className="text-xs text-muted-foreground mt-1">
                  Capacidade: {pastoAtual.capacidade_ua} UA
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Novo Pasto</Label>
            <Select value={novoPastoId} onValueChange={setNovoPastoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o pasto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">Nenhum (remover do pasto)</SelectItem>
                {pastos?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                    {p.capacidade_ua && ` (${p.capacidade_ua} UA)`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {pastoSelecionado &&
            pastoSelecionado.capacidade_ua &&
            animaisLote && (
              <div
                className={`p-3 rounded-lg border ${
                  animaisLote > pastoSelecionado.capacidade_ua
                    ? "bg-destructive/10 border-destructive"
                    : "bg-muted"
                }`}
              >
                <div className="flex items-start gap-2">
                  {animaisLote > pastoSelecionado.capacidade_ua && (
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium">Lotação</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {animaisLote} animais / Capacidade:{" "}
                      {pastoSelecionado.capacidade_ua} UA
                    </p>
                    {animaisLote > pastoSelecionado.capacidade_ua && (
                      <Badge variant="destructive" className="mt-2">
                        Excede capacidade
                      </Badge>
                    )}
                  </div>
                </div>
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
            disabled={isSubmitting || novoPastoId === lote.pasto_id}
          >
            {isSubmitting ? "Alterando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
