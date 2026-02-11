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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { showSuccess, showError } from "@/utils/toast";
import { Search } from "lucide-react";

interface AdicionarAnimaisLoteProps {
  lote: {
    id: string;
    fazenda_id: string;
    nome: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AdicionarAnimaisLote({
  lote,
  open,
  onOpenChange,
  onSuccess,
}: AdicionarAnimaisLoteProps) {
  const [search, setSearch] = useState("");
  const [selectedAnimais, setSelectedAnimais] = useState<Set<string>>(
    new Set(),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Buscar animais sem lote ou de outros lotes
  const animais = useLiveQuery(
    () =>
      db.state_animais
        .filter(
          (a) =>
            a.fazenda_id === lote.fazenda_id &&
            (!a.deleted_at || a.deleted_at === null) &&
            a.lote_id !== lote.id,
        )
        .toArray(),
    [lote.fazenda_id, lote.id],
  );

  const animaisFiltrados =
    animais?.filter((a) =>
      a.identificacao?.toLowerCase().includes(search.toLowerCase()),
    ) || [];

  const toggleAnimal = (animalId: string) => {
    const newSet = new Set(selectedAnimais);
    if (newSet.has(animalId)) {
      newSet.delete(animalId);
    } else {
      newSet.add(animalId);
    }
    setSelectedAnimais(newSet);
  };

  const handleConfirm = async () => {
    if (selectedAnimais.size === 0) {
      showError("Selecione pelo menos um animal.");
      return;
    }

    setIsSubmitting(true);
    const now = new Date().toISOString();

    const animaisPorId = new Map((animais ?? []).map((a) => [a.id, a]));
    const ops: OperationInput[] = [];

    for (const animalId of selectedAnimais) {
      const animal = animaisPorId.get(animalId) ?? (await db.state_animais.get(animalId));
      if (!animal || animal.lote_id === lote.id) continue;

      const eventoId = crypto.randomUUID();
      ops.push(
        {
          table: "eventos",
          action: "INSERT",
          record: {
            id: eventoId,
            dominio: "movimentacao",
            occurred_at: now,
            animal_id: animalId,
            lote_id: animal.lote_id ?? null,
            observacoes: "Movimentacao de lote em massa",
          },
        },
        {
          table: "eventos_movimentacao",
          action: "INSERT",
          record: {
            evento_id: eventoId,
            from_lote_id: animal.lote_id ?? null,
            to_lote_id: lote.id,
          },
        },
        {
          table: "animais",
          action: "UPDATE",
          record: {
            id: animalId,
            lote_id: lote.id,
            updated_at: now,
          },
        },
      );
    }

    if (ops.length === 0) {
      showError("Nenhum animal elegivel para movimentacao.");
      setIsSubmitting(false);
      return;
    }

    try {
      await createGesture(lote.fazenda_id, ops);
      showSuccess(
        `${selectedAnimais.size} animal(is) adicionado(s) ao lote ${lote.nome}!`,
      );
      setSelectedAnimais(new Set());
      setSearch("");
      onSuccess();
      onOpenChange(false);
    } catch (e) {
      showError("Erro ao adicionar animais ao lote.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Adicionar Animais ao Lote</DialogTitle>
          <DialogDescription>
            Selecione os animais para adicionar ao lote{" "}
            <strong>{lote.nome}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por identificação..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="border rounded-lg max-h-[400px] overflow-y-auto">
            {animaisFiltrados.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {search
                  ? "Nenhum animal encontrado"
                  : "Nenhum animal disponível"}
              </div>
            ) : (
              <div className="divide-y">
                {animaisFiltrados.map((animal) => (
                  <div
                    key={animal.id}
                    className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleAnimal(animal.id)}
                  >
                    <Checkbox
                      checked={selectedAnimais.has(animal.id)}
                      onCheckedChange={() => toggleAnimal(animal.id)}
                    />
                    <div className="flex-1">
                      <p className="font-semibold">{animal.identificacao}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {animal.sexo === "M" ? "Macho" : "Fêmea"}
                        </Badge>
                        {animal.lote_id ? (
                          <span className="text-xs text-muted-foreground">
                            Em outro lote
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Sem lote
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedAnimais.size > 0 && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">
                {selectedAnimais.size} animal(is) selecionado(s)
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedAnimais(new Set())}
              >
                Limpar seleção
              </Button>
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
            disabled={isSubmitting || selectedAnimais.size === 0}
          >
            {isSubmitting
              ? "Adicionando..."
              : `Adicionar ${selectedAnimais.size}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
