import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Search } from "lucide-react";

import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import type { OperationInput } from "@/lib/offline/types";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { EventValidationError } from "@/lib/events/validators";
import { listAnimalsBlockedBySanitaryAlert } from "@/lib/sanitario/compliance/alerts";
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
import { Checkbox } from "@/components/ui/checkbox";
import { FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { showSuccess, showError } from "@/utils/toast";

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

  const animais = useLiveQuery(
    () =>
      db.state_animais
        .filter(
          (animal) =>
            animal.fazenda_id === lote.fazenda_id &&
            (!animal.deleted_at || animal.deleted_at === null) &&
            animal.lote_id !== lote.id,
        )
        .toArray(),
    [lote.fazenda_id, lote.id],
  );
  const regulatorySurfaceSource = useLiveQuery(
    () => loadRegulatorySurfaceSource(lote.fazenda_id),
    [lote.fazenda_id],
  );

  const animaisFiltrados =
    animais?.filter((animal) =>
      animal.identificacao?.toLowerCase().includes(search.toLowerCase()),
    ) || [];
  const regulatoryReadModel = useMemo(
    () =>
      buildRegulatoryOperationalReadModel(
        regulatorySurfaceSource ?? undefined,
      ),
    [regulatorySurfaceSource],
  );
  const movementComplianceGuards = regulatoryReadModel.flows.movementInternal;
  const complianceBlockReason = movementComplianceGuards.blockers[0]?.message ?? null;
  const blockedAnimals = listAnimalsBlockedBySanitaryAlert(animais ?? []);
  const blockedAnimalIds = new Set(blockedAnimals.map(({ animal }) => animal.id));
  const blockedAnimalReasonById = new Map(
    blockedAnimals.map(({ animal, alert }) => [
      animal.id,
      alert.diseaseName ?? "suspeita sanitaria",
    ]),
  );

  const toggleAnimal = (animalId: string) => {
    const next = new Set(selectedAnimais);
    if (next.has(animalId)) {
      next.delete(animalId);
    } else {
      next.add(animalId);
    }
    setSelectedAnimais(next);
  };

  const handleConfirm = async () => {
    if (selectedAnimais.size === 0) {
      showError("Selecione pelo menos um animal.");
      return;
    }

    if (complianceBlockReason) {
      showError(complianceBlockReason);
      return;
    }

    setIsSubmitting(true);
    const now = new Date().toISOString();

    const animaisPorId = new Map((animais ?? []).map((animal) => [animal.id, animal]));
    const ops: OperationInput[] = [];

    for (const animalId of selectedAnimais) {
      const animal =
        animaisPorId.get(animalId) ?? (await db.state_animais.get(animalId));
      if (!animal || animal.lote_id === lote.id) continue;
      if (blockedAnimalIds.has(animal.id)) continue;

      const built = buildEventGesture({
        dominio: "movimentacao",
        fazendaId: lote.fazenda_id,
        occurredAt: now,
        animalId,
        loteId: animal.lote_id ?? null,
        fromLoteId: animal.lote_id ?? null,
        toLoteId: lote.id,
        observacoes: "Movimentacao de lote em massa",
      });

      ops.push(...built.ops);
    }

    if (ops.length === 0) {
      showError(
        selectedAnimais.size > 0 && blockedAnimals.length > 0
          ? "Os animais selecionados estao bloqueados por suspeita sanitaria aberta."
          : "Nenhum animal elegivel para movimentacao.",
      );
      setIsSubmitting(false);
      return;
    }

    try {
      await createGesture(lote.fazenda_id, ops);
      showSuccess(
        `${selectedAnimais.size} animal(is) adicionado(s) ao lote ${lote.nome}.`,
      );
      setSelectedAnimais(new Set());
      setSearch("");
      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      if (error instanceof EventValidationError) {
        showError(error.issues[0]?.message ?? "Dados invalidos para movimentacao.");
        return;
      }
      showError("Erro ao adicionar animais ao lote.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Adicionar animais ao lote</DialogTitle>
          <DialogDescription>
            Monte a lista de entrada para <strong>{lote.nome}</strong> sem perder
            contexto do lote de origem.
          </DialogDescription>
        </DialogHeader>

        <FormSection
          title="Selecao de animais"
          description="Busque por identificacao e marque apenas os animais que devem entrar neste lote."
          actions={
            <StatusBadge tone="info">
              {selectedAnimais.size} selecionado(s)
            </StatusBadge>
          }
          contentClassName="space-y-4"
        >
          <div className="relative">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por identificacao"
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-border/70 bg-background/80">
            {animaisFiltrados.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                {search
                  ? "Nenhum animal encontrado para a busca atual."
                  : "Nenhum animal disponivel fora deste lote."}
              </div>
            ) : (
              <div className="divide-y divide-border/70">
                {animaisFiltrados.map((animal) => (
                  <label
                    key={animal.id}
                    className="flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
                  >
                    <Checkbox
                      checked={selectedAnimais.has(animal.id)}
                      onCheckedChange={() => toggleAnimal(animal.id)}
                      disabled={blockedAnimalIds.has(animal.id)}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-medium text-foreground">
                        {animal.identificacao}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge tone="neutral">
                          {animal.sexo === "M" ? "Macho" : "Femea"}
                        </StatusBadge>
                        <StatusBadge tone="neutral">
                          {animal.lote_id ? "Em outro lote" : "Sem lote"}
                        </StatusBadge>
                        {blockedAnimalIds.has(animal.id) ? (
                          <StatusBadge tone="danger">
                            Bloqueado:{" "}
                            {blockedAnimalReasonById.get(animal.id) ?? "suspeita"}
                          </StatusBadge>
                        ) : null}
                      </div>
                    </div>
                    {blockedAnimalIds.has(animal.id) ? (
                      <span className="text-xs text-amber-700">
                        Encerrar a suspeita sanitaria antes da movimentacao.
                      </span>
                    ) : null}
                  </label>
                ))}
              </div>
            )}
          </div>

          {selectedAnimais.size > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Revise a selecao antes de confirmar a movimentacao em massa.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedAnimais(new Set())}
              >
                Limpar selecao
              </Button>
            </div>
          ) : null}

          {complianceBlockReason ? (
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
              selectedAnimais.size === 0 ||
              Boolean(complianceBlockReason)
            }
          >
            {isSubmitting ? "Adicionando..." : `Adicionar ${selectedAnimais.size}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
