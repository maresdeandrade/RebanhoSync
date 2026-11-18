import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { db } from "@/lib/offline/db";
import { Button } from "@/components/ui/button";
import { readStrategicCalendarPreferenceV1, type StrategicVariantV1 } from "@/lib/sanitario/calendar/strategicCalendarPreferenceV1";
import { saveStrategicCalendarV1 } from "@/lib/sanitario/calendar/saveStrategicCalendarV1";
import { projectStrategicCycleV1 } from "@/lib/sanitario/strategic/strategicCycleV1";
import type { SanitaryProtocolWindowSourceV2 } from "@/lib/sanitario/windows/sanitaryProtocolWindowsV2";

type Props = { source: SanitaryProtocolWindowSourceV2; canManage: boolean; onOpenAgenda: () => void; onOpenTriage: (protocolId?: string, itemId?: string) => void };
const assessmentLabels = { not_done: "Nenhuma avaliação localizada", no_treatment_indicated: "Concluída sem tratamento", treatment_indicated: "Tratamento indicado", insufficient_data: "Inconclusiva", conflict: "Avaliações conflitantes", unknown: "Avaliação desconhecida" };

export function StrategicCalendarPanelV1(props: Props) {
  return <StrategicCalendar key={props.source.fazendaId ?? ""} {...props} />;
}

function StrategicCalendar({ source, canManage, onOpenAgenda, onOpenTriage }: Props) {
  const farmId = source.fazendaId ?? "";
  const confirmed = readStrategicCalendarPreferenceV1(source.farmConfig, farmId);
  const revision = confirmed?.revision ?? 0;
  const [draft, setDraft] = useState<{ revision: number; variant: StrategicVariantV1 | "" }>(() => ({ revision, variant: confirmed?.variant ?? "" }));
  const [saving, setSaving] = useState(false);
  const [submittedRevision, setSubmittedRevision] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [animalId, setAnimalId] = useState("");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const operations = useLiveQuery(() => db.queue_ops.filter(op => op.record?.fazenda_id === farmId && op.record?.domain === "sanitary_strategic_calendar_v1").toArray(), [farmId]);
  const pending = operations?.some(op => op.sync_state !== "REJECTED") ?? false;
  const rejected = operations?.find(op => op.sync_state === "REJECTED" && Number(op.record?.expected_revision) >= revision);
  const stale = draft.revision !== revision;
  const waiting = pending || (submittedRevision === revision && !rejected);
  const middleMonth = confirmed?.variant === "5-6-9" ? "06" : "07";
  const historicalVariantUnknown = Boolean(confirmed && confirmed.effectiveFrom > `${year}-${middleMonth}-01`);
  const project = animalId && Number.isInteger(year) && year >= 1900 && year <= 9999
    ? projectStrategicCycleV1({ source, animalId, cycleYear: year, variant: historicalVariantUnknown ? null : confirmed?.variant ?? null, configRevision: historicalVariantUnknown ? null : confirmed?.revision ?? null, evaluatedAt: today }) : null;
  async function save() {
    if (!canManage || !draft.variant || !farmId || operations === undefined || saving || waiting || stale || rejected) return;
    setSaving(true); setError(null);
    try {
      await saveStrategicCalendarV1(farmId, draft.revision, draft.variant);
      if (alive.current) setSubmittedRevision(draft.revision);
    } catch {
      if (alive.current) setError("Não foi possível salvar a variante. Verifique a sincronização e a fazenda selecionada.");
    } finally { if (alive.current) setSaving(false); }
  }
  return <section className="space-y-3 rounded-lg border bg-card p-4" aria-label="Controle estratégico individual">
    <h2 className="text-lg font-semibold">Controle estratégico individual</h2>
    <p className="text-sm">Confirmada: {confirmed?.variant ?? "não configurada"}. A variante é uma prática declarada pela fazenda, sem indicação automática de produto ou aplicação.</p>
    <label className="block text-sm">Variante declarada <select aria-label="Variante declarada" className="ml-2 rounded border bg-background p-1" value={draft.variant} disabled={!canManage || saving || waiting || stale || Boolean(rejected)} onChange={event => setDraft(current => ({ ...current, variant: event.target.value as StrategicVariantV1 | "" }))}>
      <option value="">Selecione</option><option value="5-7-9">5-7-9</option><option value="5-6-9">5-6-9</option>
    </select></label>
    <Button onClick={() => void save()} disabled={!canManage || !draft.variant || operations === undefined || saving || waiting || stale || Boolean(rejected) || draft.variant === confirmed?.variant}>Salvar variante</Button>
    {waiting && <p role="status">Aguardando sincronização; a variante confirmada permanece em vigor.</p>}
    {stale && <p role="alert">A configuração confirmada mudou. Recarregue antes de salvar.</p>}
    {rejected && <p role="alert">Alteração rejeitada ou conflitante. Revise a pendência de sincronização antes de tentar novamente.</p>}
    {stale && <Button variant="outline" onClick={() => { setDraft({ revision, variant: confirmed?.variant ?? "" }); setSubmittedRevision(null); }}>Recarregar variante</Button>}
    {error && <p role="alert">{error}</p>}
    <div className="flex flex-wrap gap-3 text-sm">
      <label>Animal <select aria-label="Animal do ciclo" className="ml-2 rounded border bg-background p-1" value={animalId} onChange={event => setAnimalId(event.target.value)}><option value="">Selecione</option>{source.animals.filter(animal => animal.fazenda_id === farmId && !animal.deleted_at).map(animal => <option key={animal.id} value={animal.id}>{animal.nome || animal.identificacao || animal.id}</option>)}</select></label>
      <label>Ano do ciclo <input aria-label="Ano do ciclo" className="ml-2 w-24 rounded border bg-background p-1" type="number" min="1900" max="9999" value={year || ""} onChange={event => setYear(Number(event.target.value))} /></label>
    </div>
    {historicalVariantUnknown && <p className="text-sm">A configuração atual não comprova a variante adotada durante todo este ciclo, incluindo o início da etapa intermediária.</p>}
    {project && <div className="space-y-3">{project.stages.map(stage => <div key={stage.stage} className="rounded border p-3 text-sm space-y-1">
      <p className="font-medium">{stage.stage === "may" ? "Maio" : stage.stage === "september" ? "Setembro" : stage.month === 6 ? "Junho contextual" : stage.month === 7 ? "Julho" : "Etapa intermediária não configurada"}</p>
      <p>{assessmentLabels[stage.assessment]} · {stage.application === "proven" ? "Aplicação comprovada" : "Aplicação não comprovada"}</p>
      <p>Janela: {stage.window ? `${stage.window.startDate ?? "início não informado"} a ${stage.window.endDate ?? "fim não informado"}` : "indeterminada"}{stage.lateEntry === true ? " · ingresso tardio" : stage.lateEntry === "unknown" ? " · ingresso desconhecido" : ""}</p>
      {stage.blockers.map(blocker => <p key={blocker}>{blocker}</p>)}
      {(stage.evidenceEventIds.length > 0 || stage.applicationEventIds.length > 0) && <p>Evidências: {[...stage.evidenceEventIds, ...stage.applicationEventIds].join(", ")} · <Link className="underline" to="/eventos">Consultar eventos</Link></p>}
      {(stage.agendaIds.length > 0 || stage.legacyAgendaIds.length > 0) && <Button variant="outline" onClick={onOpenAgenda}>Consultar Agendas</Button>}
      {stage.itemId && <Button variant="outline" onClick={() => { const item = source.catalog.items.find(candidate => candidate.id === stage.itemId); onOpenTriage(item?.protocolId, stage.itemId!); }}>Abrir Triagem</Button>}
    </div>)}</div>}
    <p className="text-xs text-muted-foreground">Junho permanece somente para consulta. A verificação de duplicidade entre dispositivos ocorre na sincronização; revise eventuais conflitos antes de planejar.</p>
  </section>;
}
