import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { AlertCircle } from "lucide-react";

import { db } from "@/lib/offline/db";
import { createGesture } from "@/lib/offline/ops";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { buildPastoOcupacaoOps } from "@/lib/pastos/pastoOcupacoes";
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

  const pastos = useLiveQuery(
    () =>
      db.state_pastos
        .filter(
          (pasto) =>
            pasto.fazenda_id === lote.fazenda_id &&
            (!pasto.deleted_at || pasto.deleted_at === null),
        )
        .toArray(),
    [lote.fazenda_id],
  );

  const pastoAtual = useLiveQuery(
    () => (lote.pasto_id ? db.state_pastos.get(lote.pasto_id) : null),
    [lote.pasto_id],
  );

  const animaisLote = useLiveQuery(
    () => db.state_animais.where("lote_id").equals(lote.id).count(),
    [lote.id],
  );

  const pastoSelecionado = pastos?.find((pasto) => pasto.id === novoPastoId);
  const exceedsCapacity =
    !!pastoSelecionado?.capacidade_ua &&
    !!animaisLote &&
    animaisLote > pastoSelecionado.capacidade_ua;

  // Resolve o toPastoId efetivo (null = remover do pasto)
  const toPastoIdEfetivo: string | null = novoPastoId === "null" ? null : novoPastoId;

  // Bloqueia se o destino for o mesmo pasto atual (incluindo null→null)
  const isMesmoPasto = toPastoIdEfetivo === (lote.pasto_id ?? null);

  const handleConfirm = async () => {
    if (isMesmoPasto) return;

    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();

      // Buscar contagem atual de animais do lote (para snapshot)
      const animaisCount = (await db.state_animais
        .where("lote_id")
        .equals(lote.id)
        .count()) ?? 0;

      // Buscar ocupação aberta atual do lote (se houver)
      const ocupacaoAberta = await db.state_pasto_ocupacoes
        .where("[fazenda_id+lote_id]")
        .equals([lote.fazenda_id, lote.id])
        .filter((o) => o.status === "aberta" && !o.deleted_at)
        .first();

      const { eventId, ops } = buildEventGesture({
        dominio: "movimentacao",
        fazendaId: lote.fazenda_id,
        loteId: lote.id,
        // lote→pasto: from_lote_id e to_lote_id são o mesmo lote (o pasto é que muda)
        fromLoteId: lote.id,
        toLoteId: lote.id,
        movementKind: "lote_pasto",
        fromPastoId: lote.pasto_id ?? null,
        toPastoId: toPastoIdEfetivo,
        // Permite destino null (remover do pasto)
        allowDestinationNull: true,
        // Não há animal individual — só o lote
        applyAnimalStateUpdate: false,
        // Emite UPDATE em lotes.pasto_id (opt-in explícito)
        applyLoteStateUpdate: true,
        occurredAt: now,
        observacoes: "Movimentacao de lote entre pastos",
        payload: { tipo_movimentacao: "lote_pasto" },
      });

      const ocupacaoOps = buildPastoOcupacaoOps({
        ocupacaoAbertaAtual: ocupacaoAberta ?? null,
        lote,
        toPastoId: toPastoIdEfetivo,
        eventId,
        occurredAt: now,
        animaisCount,
      });

      await createGesture(lote.fazenda_id, [...ops, ...ocupacaoOps]);
      showSuccess(`Pasto do lote ${lote.nome} atualizado.`);
      setNovoPastoId("null");
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      showError(`Erro ao mudar pasto do lote: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Mudar pasto do lote</DialogTitle>
          <DialogDescription>
            Realoque <strong>{lote.nome}</strong> com uma leitura mais clara de
            capacidade e ocupacao.
          </DialogDescription>
        </DialogHeader>

        <FormSection
          title="Novo pasto"
          description="Se necessario, remova o lote do pasto atual antes de reorganizar a ocupacao."
          actions={
            pastoAtual ? (
              <StatusBadge tone="neutral">Atual: {pastoAtual.nome}</StatusBadge>
            ) : (
              <StatusBadge tone="neutral">Sem pasto atual</StatusBadge>
            )
          }
          contentClassName="space-y-4"
        >
          <div className="space-y-2">
            <Label>Pasto de destino</Label>
            <Select value={novoPastoId} onValueChange={setNovoPastoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o pasto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">Nenhum (remover do pasto)</SelectItem>
                {pastos?.map((pasto) => (
                  <SelectItem key={pasto.id} value={pasto.id}>
                    {pasto.nome}
                    {pasto.capacidade_ua ? ` (${pasto.capacidade_ua} UA)` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {pastoSelecionado?.capacidade_ua && animaisLote ? (
            <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div className="flex items-start gap-3">
                {exceedsCapacity ? (
                  <AlertCircle className="mt-0.5 h-4 w-4 text-warning" />
                ) : null}
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge tone={exceedsCapacity ? "warning" : "neutral"}>
                      {animaisLote} animal(is)
                    </StatusBadge>
                    <StatusBadge tone="neutral">
                      Capacidade {pastoSelecionado.capacidade_ua} UA
                    </StatusBadge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {exceedsCapacity
                      ? "A ocupacao estimada excede a capacidade informada do pasto."
                      : "A capacidade do pasto suporta a ocupacao atual do lote."}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </FormSection>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting || isMesmoPasto}
          >
            {isSubmitting ? "Alterando..." : "Confirmar ajuste"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
