import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { enqueueSanitaryAssessmentV1, type SanitaryAssessmentResultV1 } from "@/lib/sanitario/execution/sanitaryAssessmentV1";
import type { SanitaryProtocolWindowSourceV2 } from "@/lib/sanitario/windows/sanitaryProtocolWindowsV2";
import type { SanitaryTriageEvaluationV2 } from "@/lib/sanitario/triage/sanitaryTriageV2";

type Props = { source: SanitaryProtocolWindowSourceV2; evaluation: SanitaryTriageEvaluationV2; onClose: () => void; onQueued: () => void };

export function SanitaryAssessmentDialogV1({ source, evaluation, onClose, onQueued }: Props) {
  const [date, setDate] = useState(() => {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  });
  const [responsible, setResponsible] = useState("");
  const [observation, setObservation] = useState("");
  const [result, setResult] = useState<SanitaryAssessmentResultV1>("no_treatment_indicated");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const item = source.catalog.items.find(entry => entry.id === evaluation.itemId && entry.protocolId === evaluation.protocolId);
  const participants = evaluation.assessmentEventId ? (source.assessmentEventAnimals ?? []).filter(entry => entry.evento_id === evaluation.assessmentEventId && entry.fazenda_id === source.fazendaId).map(entry => entry.animal_id) : [evaluation.animalId];

  async function submit() {
    if (!source.fazendaId || !item || saving) return;
    setSaving(true); setError(null);
    try {
      await enqueueSanitaryAssessmentV1({ fazendaId: source.fazendaId, animalIds: participants, protocolId: evaluation.protocolId,
        itemId: item.id, itemVersion: item.version, occurredOn: date, responsibleName: responsible, result, observation, correctsEventId: evaluation.assessmentEventId });
      onQueued();
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "";
      setError(code.includes("PUSH_DISABLED") || code.includes("CUTOVER") || code.includes("FOUNDATION")
        ? "Registro indisponível: a sincronização sanitária desta fazenda ainda não está habilitada."
        : "Não foi possível registrar a avaliação. Confira a fazenda, os dados e a conexão e tente novamente.");
    } finally { setSaving(false); }
  }

  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}>
    <DialogContent>
      <DialogHeader><DialogTitle>{evaluation.assessmentEventId ? "Corrigir avaliação sanitária" : "Registrar avaliação sanitária"}</DialogTitle>
        <DialogDescription>{evaluation.identification} · {evaluation.protocolLabel} · {evaluation.itemLabel}. O resultado não registra aplicação de produto nem cria Agenda.</DialogDescription></DialogHeader>
      <div className="space-y-3">
        {evaluation.assessmentEventId ? <p className="text-sm">A correção preserva o registro anterior e abrange os {participants.length} participantes originais.</p> : null}
        <label className="block space-y-1 text-sm">Data da avaliação<Input aria-label="Data da avaliação" type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
        <label className="block space-y-1 text-sm">Responsável<Input aria-label="Responsável pela avaliação" value={responsible} onChange={event => setResponsible(event.target.value)} /></label>
        <label className="block space-y-1 text-sm">Resultado<select aria-label="Resultado da avaliação" className="h-10 w-full rounded-md border bg-background px-3" value={result} onChange={event => setResult(event.target.value as SanitaryAssessmentResultV1)}>
          <option value="no_treatment_indicated">Tratamento não indicado</option><option value="treatment_indicated">Tratamento indicado</option><option value="insufficient_data">Inconclusiva por dados insuficientes</option>
        </select></label>
        <label className="block space-y-1 text-sm">Observação<Input aria-label="Observação da avaliação" value={observation} onChange={event => setObservation(event.target.value)} /></label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button><Button onClick={() => void submit()} disabled={saving || !date || !responsible.trim() || !item || !participants.length || (Boolean(evaluation.assessmentEventId) && !observation.trim())}>{saving ? "Registrando..." : evaluation.assessmentEventId ? "Confirmar correção" : "Registrar avaliação"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
