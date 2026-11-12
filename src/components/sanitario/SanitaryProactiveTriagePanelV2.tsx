import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type {
  SanitaryOperationalContextV2,
  SanitaryProtocolWindowRowV2,
  SanitaryProtocolWindowSourceV2,
} from "@/lib/sanitario/windows/sanitaryProtocolWindowsV2";
import {
  createGroupedManualSanitaryAgendasV2,
  EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2,
} from "@/lib/sanitario/windows/sanitaryProtocolWindowsV2";
import {
  buildSanitaryWindowPlanningPreviewV2,
} from "@/lib/sanitario/preview/sanitaryWindowPlanningPreviewV2";
import { reviewSanitaryPlanningDateV2 } from "@/lib/sanitario/windows/sanitaryOperationalProjectionV2";
import {
  resolveSanitaryTriagePlanningRowsV2,
  triageSanitaryProtocolIntervalV2,
  type SanitaryTriageDispositionV2,
  type SanitaryTriageEvaluationV2,
} from "@/lib/sanitario/triage/sanitaryTriageV2";

type PeriodMode = "30" | "60" | "90" | "custom";
type SituationFilter = "todos" | SanitaryTriageDispositionV2;

type Props = {
  source: SanitaryProtocolWindowSourceV2 | undefined;
  initialAnimalId?: string | null;
  initialLotId?: string | null;
  onTargetChange?: (animalId: string, lotId: string) => void;
  onOpenSection?: (section: "agenda" | "historico") => void;
};

const PAGE_SIZE = 50;

const dispositionLabels: Record<SanitaryTriageDispositionV2, string> = {
  opportunity_in_window: "Oportunidade na janela",
  future_opportunity: "Oportunidade futura",
  scheduled: "Manejo já programado",
  factual_completed: "Atendimento factual comprovado",
  restricted: "Restrição técnica",
  insufficient_data: "Dados insuficientes",
  outside_period: "Fora do período",
};

function civilDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseCivilDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function addCivilDays(value: string, days: number) {
  const date = parseCivilDate(value);
  if (!date) return "";
  date.setDate(date.getDate() + days);
  return civilDateKey(date);
}

function todayKey() {
  return civilDateKey(new Date());
}

function periodForMode(mode: PeriodMode, startDate: string) {
  if (mode === "custom") return null;
  return { startDate, endDate: addCivilDays(startDate, Number(mode) - 1) };
}

function displayDate(value?: string) {
  return value ? value.split("-").reverse().join("/") : "sem limite";
}

function groupKey(evaluation: SanitaryTriageEvaluationV2) {
  return `${evaluation.protocolId}:${evaluation.itemId}`;
}

function selectionKey(evaluation: SanitaryTriageEvaluationV2) {
  return `${evaluation.animalId}:${evaluation.protocolId}:${evaluation.itemId}`;
}

function isSelectableEvaluation(evaluation: SanitaryTriageEvaluationV2) {
  return evaluation.disposition === "opportunity_in_window" &&
    !evaluation.alreadyPlanned &&
    evaluation.blockers.length === 0;
}

function groupEvaluations(evaluations: SanitaryTriageEvaluationV2[]) {
  const groups = new Map<string, SanitaryTriageEvaluationV2[]>();
  for (const evaluation of evaluations) {
    const key = groupKey(evaluation);
    const group = groups.get(key);
    if (group) group.push(evaluation);
    else groups.set(key, [evaluation]);
  }
  return [...groups.values()].sort((left, right) =>
    `${left[0].protocolLabel} ${left[0].itemLabel}`.localeCompare(
      `${right[0].protocolLabel} ${right[0].itemLabel}`,
      "pt-BR",
    ),
  );
}

function summarize(evaluations: SanitaryTriageEvaluationV2[]) {
  return evaluations.reduce<Record<SanitaryTriageDispositionV2, number>>((summary, evaluation) => {
    summary[evaluation.disposition] += 1;
    return summary;
  }, {
    opportunity_in_window: 0,
    future_opportunity: 0,
    scheduled: 0,
    factual_completed: 0,
    restricted: 0,
    insufficient_data: 0,
    outside_period: 0,
  });
}

function matchesText(evaluation: SanitaryTriageEvaluationV2, text: string) {
  if (!text.trim()) return true;
  return [
    evaluation.identification,
    evaluation.lotLabel,
    evaluation.protocolLabel,
    evaluation.itemLabel,
    evaluation.reason,
    ...evaluation.blockers,
  ].join(" ").toLocaleLowerCase("pt-BR").includes(text.trim().toLocaleLowerCase("pt-BR"));
}

function SummaryCard({ label, value, description }: { label: string; value: number; description: string }) {
  return <Card>
    <CardHeader className="pb-2"><CardDescription>{label}</CardDescription><CardTitle className="text-2xl">{value}</CardTitle></CardHeader>
    <CardContent><p className="text-xs text-muted-foreground">{description}</p></CardContent>
  </Card>;
}

function EvaluationDetails({ evaluation, selected, onToggle, onOpenSection }: { evaluation: SanitaryTriageEvaluationV2; selected: boolean; onToggle: (evaluation: SanitaryTriageEvaluationV2) => void; onOpenSection?: Props["onOpenSection"] }) {
  const selectable = isSelectableEvaluation(evaluation);
  return <li className="rounded-md border border-border/70 bg-background p-3 text-sm">
    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
      <div className="space-y-1">
        <div className="flex items-start gap-2">
          {selectable ? <input type="checkbox" aria-label={`Selecionar ${evaluation.identification} para Agenda`} checked={selected} onChange={() => onToggle(evaluation)} /> : null}
          <div>
            <p className="font-medium">{evaluation.identification} · {evaluation.lotLabel}</p>
            <p>{dispositionLabels[evaluation.disposition]} · {evaluation.reason}</p>
          </div>
        </div>
        <p className="text-muted-foreground">Janela técnica: {displayDate(evaluation.intervalStart)} a {displayDate(evaluation.intervalEnd)}</p>
        {evaluation.warnings.map(warning => <p key={warning} className="text-amber-700">{warning}</p>)}
        {evaluation.blockers.map(blocker => <p key={blocker} className="text-red-700">{blocker}</p>)}
        {evaluation.documentaryPendingReasons.map(reason => <p key={reason} className="text-amber-700">Dados documentais: {reason}</p>)}
        {evaluation.plannedFor ? <p className="text-muted-foreground">Agenda existente para {displayDate(evaluation.plannedFor)}.</p> : null}
      </div>
      <div className="flex shrink-0 gap-2">
        <Link className="text-primary underline" to={evaluation.animalHref}>Abrir animal</Link>
        {evaluation.disposition === "scheduled" && onOpenSection ? <button type="button" className="text-primary underline" onClick={() => onOpenSection("agenda")}>Abrir Agenda</button> : null}
        {evaluation.disposition === "factual_completed" && onOpenSection ? <button type="button" className="text-primary underline" onClick={() => onOpenSection("historico")}>Abrir histórico</button> : null}
      </div>
    </div>
  </li>;
}

function EvaluationGroup({ group, selectedKeys, onToggle, onSelectGroup, onOpenSection }: { group: SanitaryTriageEvaluationV2[]; selectedKeys: Set<string>; onToggle: (evaluation: SanitaryTriageEvaluationV2) => void; onSelectGroup: (group: SanitaryTriageEvaluationV2[]) => void; onOpenSection?: Props["onOpenSection"] }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const visible = open ? group.slice(0, page * PAGE_SIZE) : [];
  const first = group[0];
  const selectableGroup = group.filter(isSelectableEvaluation);
  return <section className="rounded-lg border border-border p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <button type="button" className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left font-medium" aria-expanded={open} onClick={() => setOpen(current => !current)}>
        <span>{first.protocolLabel} · {first.itemLabel}</span>
        <span className="text-sm text-muted-foreground">{group.length} avaliações {open ? "−" : "+"}</span>
      </button>
      <Button type="button" variant="outline" size="sm" disabled={!selectableGroup.length} onClick={() => onSelectGroup(selectableGroup)} aria-label={`Selecionar elegíveis do grupo ${first.protocolLabel} ${first.itemLabel} (${selectableGroup.length})`}>
        Selecionar elegíveis ({selectableGroup.length})
      </Button>
    </div>
    {open ? <>
      <ul className="mt-3 space-y-2">{visible.map((evaluation, index) => <EvaluationDetails key={`${selectionKey(evaluation)}:${index}`} evaluation={evaluation} selected={selectedKeys.has(selectionKey(evaluation))} onToggle={onToggle} onOpenSection={onOpenSection} />)}</ul>
      {visible.length < group.length ? <button type="button" className="mt-3 text-sm text-primary underline" onClick={() => setPage(current => current + 1)}>Mostrar mais ({group.length - visible.length} restantes)</button> : null}
    </> : null}
  </section>;
}

function PlanningDialog({ review, dateReview, preview, planning, error, onDateChange, onClose, onConfirm, onRemoveRejected }: { review: { rows: SanitaryProtocolWindowRowV2[]; plannedFor: string; context: SanitaryOperationalContextV2 }; dateReview: ReturnType<typeof reviewSanitaryPlanningDateV2>; preview: ReturnType<typeof buildSanitaryWindowPlanningPreviewV2> | null; planning: boolean; error: string | null; onDateChange: (date: string) => void; onClose: () => void; onConfirm: () => void; onRemoveRejected: () => void }) {
  const blocked = !dateReview.length || dateReview.some(entry => entry.situation !== "compatible") || !preview?.commands.length || !!preview?.rejected.length;
  const rejected = dateReview.filter(entry => entry.situation !== "compatible");
  return <Dialog open onOpenChange={open => { if (!open && !planning) onClose(); }}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Revisar planejamento sanitário</DialogTitle>
        <DialogDescription>Confirme os animais e a data. Isto cria somente Agenda futura, sem Evento, baixa de estoque ou carência ativa.</DialogDescription>
      </DialogHeader>
      <div className="max-h-96 space-y-3 overflow-auto text-sm">
        <label className="block space-y-1"><span className="font-medium">Data planejada</span><Input aria-label="Data planejada da Agenda" type="date" value={review.plannedFor} onChange={event => onDateChange(event.target.value)} /></label>
        <p>{review.rows.length} avaliação(ões) selecionada(s). Prévia: {preview?.commands.length ?? 0} Agenda(s) elegível(is), {rejected.length + (preview?.rejected.length ?? 0)} excluída(s) ou bloqueada(s).</p>
        <ul className="space-y-2">{dateReview.map(entry => <li key={`${entry.original.itemId}:${entry.original.animalId}`}><strong>{entry.original.identification}</strong> · {entry.original.lotLabel}<br />{entry.original.protocolLabel} · {entry.original.itemLabel}<br /><strong>{entry.label}</strong><br /><span className="text-muted-foreground">{entry.reason}</span></li>)}</ul>
        {preview?.rejected.length ? <p className="text-amber-700">A prévia também rejeitou {preview.rejected.length} comando(s) por equivalência ou restrição operacional.</p> : null}
        {rejected.length ? <Button type="button" variant="outline" disabled={planning} onClick={onRemoveRejected}>Remover excluídos e continuar</Button> : null}
        <p className="text-muted-foreground">A confirmação revalida novamente os dados locais na transação de gravação.</p>
        {error ? <p role="alert" className="text-destructive">{error}</p> : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" disabled={planning} onClick={onClose}>Voltar à seleção</Button>
        <Button type="button" disabled={planning || blocked} onClick={onConfirm}>{planning ? "Salvando..." : "Confirmar e gerar Agenda"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

export function SanitaryProactiveTriagePanelV2({ source, initialAnimalId, initialLotId, onTargetChange, onOpenSection }: Props) {
  const initialStart = todayKey();
  const [periodMode, setPeriodMode] = useState<PeriodMode>("30");
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(() => addCivilDays(initialStart, 29));
  const [protocolFilter, setProtocolFilter] = useState("todos");
  const [itemFilter, setItemFilter] = useState("todos");
  const [lotFilter, setLotFilter] = useState(initialLotId ?? "todos");
  const [animalFilter, setAnimalFilter] = useState(initialAnimalId ?? "todos");
  const [situationFilter, setSituationFilter] = useState<SituationFilter>("todos");
  const [text, setText] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [review, setReview] = useState<{ rows: SanitaryProtocolWindowRowV2[]; plannedFor: string; context: SanitaryOperationalContextV2 } | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planningError, setPlanningError] = useState<string | null>(null);
  const [planningNotice, setPlanningNotice] = useState<string | null>(null);

  const period = periodForMode(periodMode, startDate) ?? { startDate, endDate };
  const periodStartDate = period.startDate;
  const periodEndDate = period.endDate;
  const startDateObject = parseCivilDate(period.startDate);
  const endDateObject = parseCivilDate(period.endDate);
  const periodError = !startDateObject || !endDateObject
    ? "Informe datas civis válidas no formato AAAA-MM-DD."
    : period.startDate > period.endDate
      ? "Informe um intervalo válido: a data inicial não pode ser posterior à final."
      : null;
  const result = useMemo(() => {
    if (!source || periodError) return null;
    try {
      return triageSanitaryProtocolIntervalV2({ source, startDate: periodStartDate, endDate: periodEndDate });
    } catch {
      return null;
    }
  }, [periodEndDate, periodError, periodStartDate, source]);

  const protocols = useMemo(() => [...new Map((result?.evaluations ?? []).map(row => [row.protocolId, row.protocolLabel])).entries()], [result]);
  const items = useMemo(() => [...new Map((result?.evaluations ?? []).filter(row => protocolFilter === "todos" || row.protocolId === protocolFilter).map(row => [row.itemId, row.itemLabel])).entries()], [protocolFilter, result]);
  const lots = useMemo(() => [...new Map((result?.evaluations ?? []).map(row => [row.lotId ?? "sem-lote", row.lotLabel])).entries()], [result]);
  const animals = useMemo(() => [...new Map((result?.evaluations ?? []).map(row => [row.animalId, row.identification])).entries()], [result]);
  const filtered = useMemo(() => (result?.evaluations ?? []).filter(row =>
    (protocolFilter === "todos" || row.protocolId === protocolFilter) &&
    (itemFilter === "todos" || row.itemId === itemFilter) &&
    (lotFilter === "todos" || (row.lotId ?? "sem-lote") === lotFilter) &&
    (animalFilter === "todos" || row.animalId === animalFilter) &&
    (situationFilter === "todos" || row.disposition === situationFilter) &&
    matchesText(row, text) &&
    row.disposition !== "outside_period"
  ), [animalFilter, itemFilter, lotFilter, protocolFilter, result, situationFilter, text]);
  const selectableEvaluations = useMemo(() => filtered.filter(isSelectableEvaluation), [filtered]);
  const selectableKeys = useMemo(() => new Set(selectableEvaluations.map(selectionKey)), [selectableEvaluations]);
  const selectedEvaluations = useMemo(
    () => selectableEvaluations.filter(evaluation => selectedKeys.has(selectionKey(evaluation))),
    [selectableEvaluations, selectedKeys],
  );
  useEffect(() => {
    setSelectedKeys(current => {
      const next = new Set([...current].filter(key => selectableKeys.has(key)));
      return next.size === current.size ? current : next;
    });
  }, [selectableKeys]);
  const groups = useMemo(() => groupEvaluations(filtered), [filtered]);
  const filteredSummary = useMemo(() => summarize(filtered), [filtered]);
  const farmEvaluations = result?.evaluations.filter(row => row.disposition !== "outside_period") ?? [];
  const farmDistinctAnimals = new Set(farmEvaluations.map(row => row.animalId)).size;
  const filteredDistinctAnimals = new Set(filtered.map(row => row.animalId)).size;
  const dateReview = useMemo(() => review && source ? reviewSanitaryPlanningDateV2({ source, ...review }) : [], [review, source]);
  const preview = useMemo(() => review ? buildSanitaryWindowPlanningPreviewV2(review) : null, [review]);

  const toggleSelection = (evaluation: SanitaryTriageEvaluationV2) => {
    if (!isSelectableEvaluation(evaluation)) return;
    const key = selectionKey(evaluation);
    setSelectedKeys(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setPlanningNotice(null);
  };

  const selectEvaluations = (evaluations: SanitaryTriageEvaluationV2[]) => {
    const eligible = evaluations.filter(isSelectableEvaluation);
    if (!eligible.length) return;
    setSelectedKeys(current => new Set([...current, ...eligible.map(selectionKey)]));
    setPlanningNotice(null);
    setPlanningError(null);
  };

  const openPlanningReview = () => {
    if (!source || !result) return;
    const evaluations = filtered.filter(evaluation =>
      isSelectableEvaluation(evaluation) && selectedKeys.has(selectionKey(evaluation)),
    );
    const rows = resolveSanitaryTriagePlanningRowsV2({ source, evaluatedAt: result.evaluatedAt, evaluations });
    if (!rows.length) {
      setPlanningError("Selecione ao menos uma oportunidade elegível na janela.");
      return;
    }
    setPlanningError(null);
    setReview({ rows, plannedFor: period.startDate, context: { ...EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2 } });
  };

  const removeRejectedFromReview = () => {
    const rejectedKeys = new Set(dateReview.filter(entry => entry.situation !== "compatible").map(entry => selectionKey(entry.original as SanitaryTriageEvaluationV2)));
    setSelectedKeys(current => new Set([...current].filter(key => !rejectedKeys.has(key))));
    setReview(current => current ? { ...current, rows: current.rows.filter(row => !rejectedKeys.has(selectionKey(row as SanitaryTriageEvaluationV2))) } : current);
    setPlanningError(null);
  };

  const confirmPlanning = async () => {
    if (!review || !source?.fazendaId || planning) return;
    setPlanning(true);
    setPlanningError(null);
    try {
      const freshRows = dateReview.filter(entry => entry.situation === "compatible").map(entry => entry.fresh!).filter(Boolean);
      const results = await createGroupedManualSanitaryAgendasV2({
        rows: freshRows,
        fazendaId: source.fazendaId,
        plannedFor: review.plannedFor,
        confirmed: true,
        operationalContext: review.context,
      });
      setPlanningNotice(`${results.length} Agenda(s) criada(s) como intenção futura.`);
      setSelectedKeys(new Set());
      setReview(null);
    } catch (error) {
      setPlanningError(error instanceof Error ? error.message : "Não foi possível salvar o planejamento. Tente novamente.");
    } finally {
      setPlanning(false);
    }
  };

  if (!source) return <p className="text-sm text-muted-foreground">Carregando catálogo, rebanho e histórico sanitário local...</p>;
  if (source.animals.length === 0) return <div role="status" className="rounded-lg border border-dashed border-border p-4 text-sm">Nenhum animal ativo disponível nesta fazenda para triagem sanitária. Isso não comprova conformidade sanitária.</div>;
  if (source.catalog.items.length === 0) return <div role="status" className="rounded-lg border border-dashed border-border p-4 text-sm">Nenhum item de protocolo disponível no catálogo local. Atualize o catálogo quando houver conexão. Isso não comprova conformidade sanitária.</div>;

  return <div className="space-y-4">
    <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">Triagem informativa da fazenda ativa. Esta consulta não cria Agenda, Evento, baixa de estoque ou operação de sincronização. Ausência de oportunidade não comprova conformidade sanitária.</div>
    <Card>
      <CardHeader><CardTitle>Período da triagem</CardTitle><CardDescription>Datas civis locais com limites inclusivos. O período personalizado aceita intervalos futuros sem limite de 90 dias.</CardDescription></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-4">
        <label className="space-y-1 text-sm"><span className="font-medium">Horizonte</span><select aria-label="Horizonte da triagem" className="h-10 w-full rounded-md border border-input bg-background px-3" value={periodMode} onChange={event => setPeriodMode(event.target.value as PeriodMode)}><option value="30">Próximos 30 dias</option><option value="60">Próximos 60 dias</option><option value="90">Próximos 90 dias</option><option value="custom">Personalizado</option></select></label>
        <label className="space-y-1 text-sm"><span className="font-medium">Data inicial</span><Input aria-label="Data inicial da triagem" type="date" value={startDate} onChange={event => { setStartDate(event.target.value); setPeriodMode("custom"); }} /></label>
        <label className="space-y-1 text-sm"><span className="font-medium">Data final</span><Input aria-label="Data final da triagem" type="date" value={endDate} onChange={event => { setEndDate(event.target.value); setPeriodMode("custom"); }} /></label>
        <div className="flex items-end text-sm text-muted-foreground"><p>Consulta: {displayDate(period.startDate)} a {displayDate(period.endDate)}</p></div>
      </CardContent>
      {periodError ? <p role="alert" className="px-6 pb-4 text-sm text-destructive">{periodError}</p> : null}
    </Card>
    {result ? <>
      <Card>
        <CardHeader><CardTitle>Indicadores filtrados</CardTitle><CardDescription>{filtered.length} avaliações em {filteredDistinctAnimals} animais distintos. Total da fazenda no período: {farmEvaluations.length} avaliações em {farmDistinctAnimals} animais distintos. Os indicadores distinguem avaliações de animais e respeitam os filtros atuais.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryCard label="Oportunidades na janela" value={filteredSummary.opportunity_in_window} description="Avaliações filtradas que intersectam o período." />
          <SummaryCard label="Próximas oportunidades" value={filteredSummary.future_opportunity} description="Avaliações filtradas futuras fora do período imediato." />
          <SummaryCard label="Programadas" value={filteredSummary.scheduled} description="Agendas existentes filtradas, sem tratar Agenda como execução." />
          <SummaryCard label="Restrições" value={filteredSummary.restricted} description="Avaliações filtradas com bloqueio ou condição técnica." />
          <SummaryCard label="Dados insuficientes" value={filteredSummary.insufficient_data} description="Avaliações filtradas sem evidência suficiente." />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Filtros operacionais</CardTitle><CardDescription>Os filtros só alteram a apresentação, não os fatos de origem.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <select aria-label="Filtrar por protocolo" className="h-10 rounded-md border border-input bg-background px-3" value={protocolFilter} onChange={event => { setProtocolFilter(event.target.value); setItemFilter("todos"); }}><option value="todos">Todos os protocolos</option>{protocols.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
          <select aria-label="Filtrar por manejo" className="h-10 rounded-md border border-input bg-background px-3" value={itemFilter} onChange={event => setItemFilter(event.target.value)}><option value="todos">Todos os manejos</option>{items.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
          <select aria-label="Filtrar por lote" className="h-10 rounded-md border border-input bg-background px-3" value={lotFilter} onChange={event => { setLotFilter(event.target.value); onTargetChange?.(animalFilter === "todos" ? "" : animalFilter, event.target.value === "todos" ? "" : event.target.value); }}><option value="todos">Todos os lotes</option>{lots.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
          <select aria-label="Filtrar por animal" className="h-10 rounded-md border border-input bg-background px-3" value={animalFilter} onChange={event => { setAnimalFilter(event.target.value); onTargetChange?.(event.target.value === "todos" ? "" : event.target.value, lotFilter === "todos" ? "" : lotFilter); }}><option value="todos">Todos os animais</option>{animals.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
          <select aria-label="Filtrar por situação" className="h-10 rounded-md border border-input bg-background px-3" value={situationFilter} onChange={event => setSituationFilter(event.target.value as SituationFilter)}><option value="todos">Todas as situações</option>{Object.entries(dispositionLabels).filter(([key]) => key !== "outside_period").map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          <Input aria-label="Buscar na triagem" placeholder="Buscar animal, lote ou protocolo" value={text} onChange={event => setText(event.target.value)} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Oportunidades e condições por protocolo</CardTitle><CardDescription>Selecione somente oportunidades elegíveis na janela. A confirmação cria Agenda futura, nunca Evento factual.</CardDescription></CardHeader>
        <CardContent>
          <div className="mb-3 flex flex-wrap items-center gap-3"><span className="text-sm text-muted-foreground">{selectedEvaluations.length} avaliação(ões) selecionada(s)</span><Button type="button" variant="outline" disabled={!selectableEvaluations.length} onClick={() => selectEvaluations(selectableEvaluations)}>Selecionar elegíveis no recorte ({selectableEvaluations.length})</Button><Button type="button" variant="outline" disabled={!selectedKeys.size} onClick={() => setSelectedKeys(new Set())}>Limpar seleção</Button><Button type="button" disabled={!selectedEvaluations.length || !source.fazendaId} onClick={openPlanningReview}>Planejar selecionados</Button>{planningNotice ? <span role="status" className="text-sm text-green-700">{planningNotice}</span> : null}{planningError && !review ? <span role="alert" className="text-sm text-destructive">{planningError}</span> : null}</div>
          {groups.length === 0 ? <p role="status" className="text-sm text-muted-foreground">Nenhuma oportunidade ou condição encontrada com os filtros atuais. Isso não constitui comprovação de conformidade.</p> : <div className="space-y-3">{groups.map(group => <EvaluationGroup key={groupKey(group[0])} group={group} selectedKeys={selectedKeys} onToggle={toggleSelection} onSelectGroup={selectEvaluations} onOpenSection={onOpenSection} />)}</div>}
        </CardContent>
      </Card>
      {review ? <PlanningDialog review={review} dateReview={dateReview} preview={preview} planning={planning} error={planningError} onDateChange={date => setReview(current => current ? { ...current, plannedFor: date } : current)} onClose={() => { if (!planning) { setReview(null); setPlanningError(null); } }} onConfirm={confirmPlanning} onRemoveRejected={removeRejectedFromReview} /> : null}
    </> : null}
  </div>;
}
