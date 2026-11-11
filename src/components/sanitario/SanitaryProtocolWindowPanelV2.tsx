import { useEffect, useMemo, useRef, useState } from "react";
import { SanitaryContextRequirementsV2 } from "./SanitaryRuleContextEditorV2";
import { CalendarPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildSanitaryWindowPlanningPreviewV2 } from "@/lib/sanitario/preview/sanitaryWindowPlanningPreviewV2";
import { Input } from "@/components/ui/input";
import { SanitaryProtocolWindowTableV2 } from "@/components/sanitario/SanitaryProtocolWindowTableV2";
import type { SanitaryWindowSortKeyV2 } from "@/components/sanitario/SanitaryProtocolWindowTableV2";
import {
  buildSanitaryProtocolWindowV2,
  EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2,
  type SanitaryOperationalContextV2,
  type SanitaryProtocolWindowFiltersV2,
  type SanitaryProtocolWindowRowV2,
  type SanitaryProtocolWindowSourceV2,
} from "@/lib/sanitario/windows/sanitaryProtocolWindowsV2";
import type { SanitaryEligibilityStatus } from "@/lib/sanitario/eligibility/sanitaryEligibility";
import { formatSanitaryProtocolItemLabelV2 } from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";
import { sanitaryRequiresRabiesAssessmentV2 } from "@/lib/sanitario/agenda/sanitaryContextualPlanningV2";
import { reviewSanitaryPlanningDateV2 } from "@/lib/sanitario/windows/sanitaryOperationalProjectionV2";
import { format } from "date-fns";
import type { SanitaryNeedsSectionV2 } from "./SanitaryNeedCardV2";

const initialFilters: SanitaryProtocolWindowFiltersV2 = {
  lotId: "todos",
  animalId: "todos",
  category: "todas",
  sex: "todos",
  animalStatus: "ativo",
  eligibilityStatus: "todos",
};

const eligibilityOptions: Array<[SanitaryEligibilityStatus, string]> = [
  ["in_action_window", "Em janela"],
  ["near_deadline", "Próximo do limite"],
  ["eligible_soon", "Próximo da janela"],
  ["overdue", "Atrasado"],
  ["insufficient_data", "Dados insuficientes"],
  ["not_yet_eligible", "Fora da janela futura"],
  ["not_applicable", "Não aplicável"],
  ["completed", "Já executado"],
];

const summaryStatuses: Array<{
  key: SanitaryWindowStatusCardFilterV2;
  label: string;
  match: (row: SanitaryProtocolWindowRowV2) => boolean;
}> = [
  { key: "in_action_window", label: "Em janela", match: (row) => row.status === "in_action_window" && !row.alreadyPlanned },
  { key: "upcoming", label: "Próximos", match: (row) => ["eligible_soon", "not_yet_eligible", "near_deadline"].includes(row.status) && !row.alreadyPlanned },
  { key: "overdue", label: "Atrasados", match: (row) => row.status === "overdue" && !row.alreadyPlanned },
  { key: "insufficient_data", label: "Dados insuficientes", match: (row) => row.status === "insufficient_data" },
  { key: "blocked", label: "Bloqueados", match: (row) => row.blockers.length > 0 },
  { key: "not_applicable", label: "Não aplicáveis", match: (row) => row.status === "not_applicable" },
  { key: "already_planned", label: "Já planejados", match: (row) => row.alreadyPlanned },
];

type SanitaryWindowStatusCardFilterV2 =
  | "todos"
  | "in_action_window"
  | "upcoming"
  | "overdue"
  | "insufficient_data"
  | "blocked"
  | "not_applicable"
  | "already_planned";

type Props = {
  source: SanitaryProtocolWindowSourceV2 | undefined;
  initialAnimalId?: string | null;
  initialLotId?: string | null;
  initialLotContextId?: string | null;
  initialProtocolId?: string;
  initialItemId?: string;
  initialEvaluatedAt?: string;
  contextual?: boolean;
  onClearInitialFilter?: () => void;
  onEvaluatedAtChange?: (date: string) => void;
  onConsultationScopeChange?: (animalId: string, lotId: string) => void;
  onOpenSection?: (section: SanitaryNeedsSectionV2) => void;
  onPlan: (
    rows: SanitaryProtocolWindowRowV2[],
    plannedFor: string,
    operationalContext: SanitaryOperationalContextV2,
  ) => Promise<void>;
};

function todayKey() {
  return format(new Date(), "yyyy-MM-dd");
}

function matchesStatusCardFilter(
  row: SanitaryProtocolWindowRowV2,
  filter: SanitaryWindowStatusCardFilterV2,
) {
  if (filter === "todos") return true;
  return summaryStatuses.find((summary) => summary.key === filter)?.match(row) ?? true;
}

function sortValue(row: SanitaryProtocolWindowRowV2, key: SanitaryWindowSortKeyV2) {
  if (key === "animal") return row.identification;
  if (key === "lote") return row.lotLabel;
  if (key === "sexo") return `${row.sexLabel} ${row.ageLabel}`;
  if (key === "idade") return row.ageLabel;
  if (key === "categoria") return row.categoryLabel;
  if (key === "status") {
    if (row.alreadyPlanned) return "Já planejado";
    if (row.blockers.length > 0) return "Bloqueado";
    return row.status;
  }
  if (key === "motivo") return row.reason;
  return row.plannedFor ?? "";
}

function sortRows(
  rows: SanitaryProtocolWindowRowV2[],
  key: SanitaryWindowSortKeyV2,
  direction: "asc" | "desc",
) {
  const factor = direction === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const comparison = sortValue(left.row, key).localeCompare(
        sortValue(right.row, key),
        "pt-BR",
        { numeric: true, sensitivity: "base" },
      );
      return comparison === 0 ? left.index - right.index : comparison * factor;
    })
    .map((entry) => entry.row);
}

export function SanitaryProtocolWindowPanelV2({
  source,
  initialAnimalId,
  initialLotId,
  initialLotContextId,
  initialProtocolId = "",
  initialItemId = "",
  initialEvaluatedAt,
  contextual = false,
  onClearInitialFilter,
  onEvaluatedAtChange,
  onConsultationScopeChange,
  onOpenSection,
  onPlan,
}: Props) {
  const [protocolId, setProtocolId] = useState(initialProtocolId);
  const [itemId, setItemId] = useState(initialItemId);
  const [showTechnicalVersions, setShowTechnicalVersions] = useState(Boolean(initialItemId));
  const [evaluatedAt, setEvaluatedAt] = useState(initialEvaluatedAt ?? todayKey);
  const [plannedFor, setPlannedFor] = useState(todayKey);
  const [filters, setFilters] = useState(() => ({
    ...initialFilters,
    animalId: initialAnimalId || "todos",
    lotId: initialAnimalId ? "todos" : initialLotId || "todos",
  }));
  const [statusCardFilter, setStatusCardFilter] =
    useState<SanitaryWindowStatusCardFilterV2>("todos");
  const [sortKey, setSortKey] = useState<SanitaryWindowSortKeyV2>("animal");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [operationalContext, setOperationalContext] =
    useState<SanitaryOperationalContextV2>(
      EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2,
    );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [planning, setPlanning] = useState(false);
  const submitting = useRef(false);
  const [review, setReview] = useState<{ rows: SanitaryProtocolWindowRowV2[]; plannedFor: string; context: SanitaryOperationalContextV2 } | null>(null);
  const [planningError, setPlanningError] = useState<string | null>(null);
  const reviewPreview = useMemo(() => review ? buildSanitaryWindowPlanningPreviewV2(review) : null, [review]);
  const dateReview = useMemo(() => review && source ? reviewSanitaryPlanningDateV2({ ...review, source }) : [], [review, source]);
  const reviewBlocked = !dateReview.length || dateReview.some(entry => entry.situation !== "compatible");
  const reviewWarnings = [...new Set(review?.rows.flatMap((row) => row.warnings) ?? [])];
  const protocols = source?.catalog.protocols ?? [];
  const rabiesSelected = protocols.some(protocol => protocol.id === protocolId && protocol.familyCode === "raiva_herbivoros");
  const items = source?.catalog.items.filter((item) => item.protocolId === protocolId) ?? [];
  const displayedItems = showTechnicalVersions ? items : items.filter(item => item.status === "active" && !items.some(candidate => candidate.logicalItemKey === item.logicalItemKey && candidate.status === "active" && candidate.version > item.version));
  const filteredAnimal = source?.animals.find((entry) => entry.id === filters.animalId);
  const filteredLot = source?.lots.find((entry) => entry.id === filters.lotId);
  const lotContext = source?.lots.find((entry) => entry.id === initialLotContextId);
  const filteredAnimalLabel =
    filteredAnimal?.nome?.trim() || filteredAnimal?.identificacao || "animal selecionado";
  useEffect(() => {
    setOperationalContext(EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2);
    setSelectedIds(new Set());
    setReview(null);
  }, [source?.fazendaId]);
  const filteredLotLabel = filteredLot?.nome || "lote selecionado";
  const previousProtocol = useRef(protocolId);
  useEffect(() => {
    if (previousProtocol.current !== protocolId) setItemId("");
    previousProtocol.current = protocolId;
    setSelectedIds(new Set());
  }, [protocolId]);

  useEffect(() => {
    setFilters((current) => ({
      ...current,
      animalId: initialAnimalId || "todos",
      lotId: initialAnimalId ? "todos" : initialLotId || "todos",
    }));
  }, [initialAnimalId, initialLotId]);

  useEffect(
    () => setSelectedIds(new Set()),
    [itemId, evaluatedAt, filters, operationalContext],
  );

  const result = useMemo(
    () =>
      source && protocolId && itemId
        ? buildSanitaryProtocolWindowV2({
            source,
            protocolId,
            itemId,
            evaluatedAt,
            filters,
            operationalContext,
          })
        : null,
    [evaluatedAt, filters, itemId, operationalContext, protocolId, source],
  );
  const categoryResult = useMemo(
    () =>
      !contextual && source && protocolId && itemId
        ? buildSanitaryProtocolWindowV2({
            source,
            protocolId,
            itemId,
            evaluatedAt,
            filters: { ...filters, category: "todas" },
            operationalContext,
          })
        : null,
    [evaluatedAt, filters, itemId, operationalContext, protocolId, source, contextual],
  );
  const selectedRows = result?.rows.filter((row) => selectedIds.has(row.animalId) && row.canSelect) ?? [];
  const visibleRows = useMemo(
    () =>
      result
        ? sortRows(
            result.rows.filter((row) => matchesStatusCardFilter(row, statusCardFilter)),
            sortKey,
            sortDirection,
          )
        : [],
    [result, sortDirection, sortKey, statusCardFilter],
  );
  const visibleEligibleRows = visibleRows.filter((row) => row.canSelect);
  const visibleSelectedRows = visibleRows.filter(
    (row) => row.canSelect && selectedIds.has(row.animalId),
  );
  const hiddenSelectionCount = selectedRows.length - visibleSelectedRows.length;
  const allVisibleEligibleSelected =
    visibleEligibleRows.length > 0 &&
    visibleEligibleRows.every((row) => selectedIds.has(row.animalId));
  const categories = Array.from(
    new Map(
      (categoryResult?.rows ?? []).map((row) => [row.category, row.categoryLabel]),
    ).entries(),
  );
  const selectedItem = items.find(item => item.id === itemId);
  const requiresRisk = !!selectedItem?.eligibilityRule.requires_risk_area_overlay;
  const requiresRiskContext = !!selectedItem?.eligibilityRule.requires_risk_context;
  const requiresCadence = (selectedItem?.boosterRule.recurrenceRule as { kind?: string } | undefined)?.kind === "annual_or_semester_by_risk" && !result?.rows.every(row => row.contextResolution?.cadence.status === "known");
  const requiresManagement = !!selectedItem?.eligibilityRule.requires_destination_context;
  const requiresRabiesAssessment = rabiesSelected && (!contextual || (
    (selectedItem?.snapshotTemplate.metadata as Record<string, unknown> | undefined)?.catalog_review_scope === "manual_planning" &&
    result?.rows.some(row => {
      const birth = source?.animals.find(animal => animal.id === row.animalId)?.data_nascimento;
      return birth && sanitaryRequiresRabiesAssessmentV2(selectedItem, birth, evaluatedAt);
    })
  ));

  const planSelected = async () => {
    if (!review || reviewBlocked || submitting.current) return;
    submitting.current = true;
    setPlanningError(null);
    setPlanning(true);
    try {
      await onPlan(dateReview.map(entry => entry.fresh!), review.plannedFor, review.context);
      setReview(null);
      setSelectedIds(new Set());
    } catch (error) {
      setPlanningError(error instanceof Error ? error.message : "Não foi possível salvar o planejamento. Tente novamente.");
    } finally {
      submitting.current = false;
      setPlanning(false);
    }
  };

  const clearInitialFilter = () => {
    setFilters((current) => ({ ...current, animalId: "todos", lotId: "todos" }));
    onClearInitialFilter?.();
    onConsultationScopeChange?.("", "");
  };

  const toggleSort = (key: SanitaryWindowSortKeyV2) => {
    setSortKey((current) => {
      if (current === key) {
        setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
        return current;
      }
      setSortDirection("asc");
      return key;
    });
  };

  const selectAllVisible = (checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const row of visibleEligibleRows) {
        if (checked) next.add(row.animalId);
        else next.delete(row.animalId);
      }
      return next;
    });
  };

  if (!source) {
    return <p className="text-sm text-muted-foreground">Carregando catálogo, rebanho e histórico sanitário local...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        Isso cria agenda futura, não execução. Produto real, dose, via, estoque e carência permanecem exclusivos do registro executado.
      </div>

      {protocols.length === 0 ? <div role="status" className="rounded-lg border border-dashed border-border p-4 text-sm">Nenhum protocolo disponível no catálogo local. Use Atualizar catálogo quando houver conexão. Se continuar vazio, a implantação deve disponibilizar o catálogo no ambiente; produtos cadastrados isoladamente não criam protocolos.</div> : null}

      {filters.animalId !== "todos" ? (
        <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-foreground">
              Filtro ativo: animal {filteredAnimalLabel}
            </p>
            {lotContext ? (
              <p className="text-muted-foreground">
                Lote usado apenas como contexto auxiliar: {lotContext.nome}.
              </p>
            ) : null}
          </div>
          {!contextual ? <Button type="button" size="sm" variant="outline" onClick={clearInitialFilter}>
            Limpar filtro
          </Button> : null}
        </div>
      ) : null}

      {filters.animalId === "todos" && filters.lotId !== "todos" ? (
        <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium text-foreground">
            Filtro ativo: lote {filteredLotLabel}
          </p>
          {!contextual ? <Button type="button" size="sm" variant="outline" onClick={clearInitialFilter}>
            Limpar filtro
          </Button> : null}
        </div>
      ) : null}

      {requiresRisk || requiresRiskContext || requiresCadence || requiresManagement ? <section className="space-y-3 rounded-lg border border-border p-4" aria-label="Contexto operacional">
        <div>
          <h3 className="font-semibold">Contexto operacional</h3>
          <p className="text-sm text-muted-foreground">
            Idade, sexo, lote, reprodução e estágio de manejo são resolvidos individualmente nos registros disponíveis. Risco e decisões técnicas sem evidência suficiente precisam de complemento; não são execução.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {requiresRiskContext ? <label className="space-y-1 text-sm"><span className="font-medium">Contexto de risco sanitário</span><select aria-label="Contexto de risco sanitário" className="h-11 w-full rounded-xl border border-border bg-background px-3" value={operationalContext.riskContext == null ? "unknown" : operationalContext.riskContext ? "yes" : "no"} onChange={event => setOperationalContext(current => ({ ...current, riskContext: event.target.value === "unknown" ? null : event.target.value === "yes" }))}><option value="unknown">Não informado</option><option value="yes">Confirmado</option><option value="no">Não confirmado</option></select></label> : null}
          {requiresRisk ? <label className="space-y-1 text-sm"><span className="font-medium">Área de risco para raiva</span><select aria-label="Área de risco para raiva" className="h-11 w-full rounded-xl border border-border bg-background px-3" value={operationalContext.rabiesRiskArea === null ? "unknown" : operationalContext.rabiesRiskArea ? "yes" : "no"} onChange={(event) => setOperationalContext((current) => ({ ...current, rabiesRiskArea: event.target.value === "unknown" ? null : event.target.value === "yes" }))}><option value="unknown">Não informado</option><option value="yes">Sim</option><option value="no">Não</option></select></label> : null}
          {requiresCadence ? <label className="space-y-1 text-sm"><span className="font-medium">Cadência sanitária</span><select aria-label="Cadência sanitária" className="h-11 w-full rounded-xl border border-border bg-background px-3" value={operationalContext.sanitaryCadence ?? "unknown"} onChange={(event) => setOperationalContext((current) => ({ ...current, sanitaryCadence: event.target.value === "unknown" ? null : event.target.value as "annual" | "semiannual" }))}><option value="unknown">Não informado</option><option value="annual">Anual</option><option value="semiannual">Semestral</option></select></label> : null}
          {requiresManagement ? <label className="space-y-1 text-sm"><span className="font-medium">Manejo</span><select aria-label="Manejo sanitário" className="h-11 w-full rounded-xl border border-border bg-background px-3" value={["pre_feedlot", "deferred_pasture"].includes(operationalContext.management ?? "") ? operationalContext.management! : "unknown"} onChange={(event) => setOperationalContext((current) => ({ ...current, management: event.target.value === "unknown" ? null : event.target.value as SanitaryOperationalContextV2["management"] }))}><option value="unknown">Não informado</option><option value="pre_feedlot">Pré-confinamento</option><option value="deferred_pasture">Pasto vedado</option></select></label> : null}
        </div>
      </section> : null}

      {items.find((item) => item.id === itemId) ? <SanitaryContextRequirementsV2 item={items.find((item) => item.id === itemId)!} source={source} context={operationalContext} onChange={setOperationalContext} targetAnimalIds={contextual ? result?.rows.map(row => row.animalId) : undefined} hideScheduled={Boolean(result?.rows.length && result.rows.every((row) => row.contextResolution?.reproduction.status === "known"))} /> : null}

      {requiresRabiesAssessment && <section className="space-y-3 rounded-lg border border-border p-4" aria-label="Avaliação técnica para raiva">
        <p className="text-sm text-muted-foreground">Consulta e planejamento manual não presumem obrigatoriedade regional. Menores de três meses e indicações contextuais exigem avaliação técnica.</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={operationalContext.rabiesTechnicalAssessment?.confirmed ?? false} onChange={event => setOperationalContext(current => ({ ...current, rabiesTechnicalAssessment: { responsibleReference: current.rabiesTechnicalAssessment?.responsibleReference ?? "", confirmed: event.target.checked } }))} />Confirmo a avaliação técnica desta indicação</label>
        <label className="block space-y-1 text-sm"><span>Responsável pela avaliação</span><Input aria-label="Responsável pela avaliação de raiva" value={operationalContext.rabiesTechnicalAssessment?.responsibleReference ?? ""} onChange={event => setOperationalContext(current => ({ ...current, rabiesTechnicalAssessment: { confirmed: current.rabiesTechnicalAssessment?.confirmed ?? false, responsibleReference: event.target.value } }))} /></label>
      </section>}
      {!contextual ? <section className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-3 lg:grid-cols-6" aria-label="Filtros das janelas sanitárias">
        {!contextual ? <label className="space-y-1 text-sm lg:col-span-2"><span className="font-medium">Protocolo</span><select aria-label="Selecionar protocolo" className="h-11 w-full rounded-xl border border-border bg-background px-3" value={protocolId} onChange={(event) => setProtocolId(event.target.value)}><option value="">Selecione</option>{protocols.map((protocol) => <option key={protocol.id} value={protocol.id}>{protocol.name}</option>)}</select></label> : null}
        {!contextual ? <label className="space-y-1 text-sm lg:col-span-2"><span className="font-medium">Item do protocolo</span><select aria-label="Selecionar item do protocolo" className="h-11 w-full rounded-xl border border-border bg-background px-3" value={itemId} disabled={!protocolId} onChange={(event) => setItemId(event.target.value)}><option value="">Selecione</option>{displayedItems.map((item) => <option key={item.id} value={item.id}>{formatSanitaryProtocolItemLabelV2(item.logicalItemKey)} · versão {item.version}</option>)}</select></label> : null}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showTechnicalVersions} onChange={event => { setShowTechnicalVersions(event.target.checked); setItemId(""); }} />Consultar versões históricas e técnicas</label>
        <label className="space-y-1 text-sm"><span className="font-medium">Data de avaliação</span><Input aria-label="Data de avaliação" type="date" value={evaluatedAt} onChange={(event) => { setEvaluatedAt(event.target.value); onEvaluatedAtChange?.(event.target.value); }} /></label>
        <label className="space-y-1 text-sm"><span className="font-medium">Lote</span><select aria-label="Filtrar por lote" className="h-11 w-full rounded-xl border border-border bg-background px-3" value={filters.lotId} onChange={(event) => { const lotId = event.target.value; setFilters(current => ({ ...current, animalId: "todos", lotId })); onConsultationScopeChange?.("", lotId === "todos" ? "" : lotId); }}><option value="todos">Todos</option>{source.lots.filter((lot) => !lot.deleted_at).map((lot) => <option key={lot.id} value={lot.id}>{lot.nome}</option>)}</select></label>
        <details className="md:col-span-3 lg:col-span-6"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Filtros de categoria, sexo e situação</summary><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 text-sm"><span className="font-medium">Categoria</span><select aria-label="Filtrar por categoria" className="h-11 w-full rounded-xl border border-border bg-background px-3" value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}><option value="todas">Todas</option>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="space-y-1 text-sm"><span className="font-medium">Sexo</span><select aria-label="Filtrar por sexo" className="h-11 w-full rounded-xl border border-border bg-background px-3" value={filters.sex} onChange={(event) => setFilters((current) => ({ ...current, sex: event.target.value as SanitaryProtocolWindowFiltersV2["sex"] }))}><option value="todos">Todos</option><option value="F">Fêmeas</option><option value="M">Machos</option></select></label>
        <label className="space-y-1 text-sm"><span className="font-medium">Situação do animal</span><select aria-label="Filtrar por situação do animal" className="h-11 w-full rounded-xl border border-border bg-background px-3" value={filters.animalStatus} onChange={(event) => setFilters((current) => ({ ...current, animalStatus: event.target.value as SanitaryProtocolWindowFiltersV2["animalStatus"] }))}><option value="ativo">Ativos</option><option value="todos">Todos</option><option value="vendido">Vendidos</option><option value="morto">Mortos</option><option value="retirado">Retirados</option></select></label>
        <label className="space-y-1 text-sm"><span className="font-medium">Elegibilidade</span><select aria-label="Filtrar por elegibilidade" className="h-11 w-full rounded-xl border border-border bg-background px-3" value={filters.eligibilityStatus} onChange={(event) => setFilters((current) => ({ ...current, eligibilityStatus: event.target.value as SanitaryEligibilityStatus | "todos" }))}><option value="todos">Todas</option>{eligibilityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div></details>
      </section> : null}

      {result ? <p className="text-sm">{filters.animalId === "todos" ? "Consulta coletiva" : `Consulta individual: ${filteredAnimalLabel}`} · {result.rows.length} animal(is) com avaliações retornadas. Data da avaliação: {evaluatedAt.split("-").reverse().join("/")}.</p> : null}
      {!protocolId || !itemId ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Selecione um protocolo e um item para calcular as janelas do rebanho.</div>
      ) : result ? (
        <>
          {!contextual ? <details><summary className="cursor-pointer text-sm font-medium">Filtros técnicos da avaliação</summary><section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7" aria-label="Resumo das janelas sanitárias">
            {summaryStatuses.map((summary) => {
              const active = statusCardFilter === summary.key;
              return (
                <button
                  key={summary.label}
                  type="button"
                  className={`rounded-lg border p-3 text-left transition ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                  onClick={() => setStatusCardFilter(summary.key)}
                >
                  <div className="text-2xl font-semibold">{result.rows.filter(summary.match).length}</div>
                  <div className="text-xs text-muted-foreground">{summary.label}</div>
                </button>
              );
            })}
          </section></details> : null}
          {statusCardFilter !== "todos" ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
              <span>Filtro ativo: {summaryStatuses.find((summary) => summary.key === statusCardFilter)?.label}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => setStatusCardFilter("todos")}>
                Limpar filtro
              </Button>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
            <span className="text-muted-foreground">
              {visibleSelectedRows.length} selecionado(s) de {visibleEligibleRows.length} elegível(is) visível(is) · {selectedRows.length} selecionado(s) no resultado
            </span>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" disabled={visibleEligibleRows.length === 0} onClick={() => selectAllVisible(true)}>
                Selecionar todos os elegíveis visíveis
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={selectedIds.size === 0} onClick={() => setSelectedIds(new Set())}>
                Limpar seleção
              </Button>
            </div>
          </div>
          {hiddenSelectionCount > 0 ? <p role="status" className="text-sm">{hiddenSelectionCount} selecionado(s) fora da visualização; não será(ão) incluído(s) nesta revisão.</p> : null}
          {visibleRows.length > 0 && visibleEligibleRows.length === 0 ? <div role="status" className="space-y-2 rounded-lg border border-border p-3 text-sm">
            <p>{visibleRows.length} avaliações visíveis. Nenhum animal selecionável para novo planejamento neste filtro.</p>
            {visibleRows.some(row => row.alreadyPlanned) ? <><p>{visibleRows.filter(row => row.alreadyPlanned).length} animal(is) com Agenda existente.</p>{onOpenSection ? <Button type="button" variant="outline" onClick={() => onOpenSection("agenda")}>Abrir Agenda sanitária</Button> : null}</> : null}
            <p>Consulte abaixo os motivos, restrições e Agendas existentes.</p>
          </div> : null}
          <SanitaryProtocolWindowTableV2
            catalog={source.catalog}
            rows={visibleRows}
            selectedIds={selectedIds}
            sortKey={sortKey}
            sortDirection={sortDirection}
            visibleEligibleCount={visibleEligibleRows.length}
            allVisibleEligibleSelected={allVisibleEligibleSelected}
            onSelectAllVisible={selectAllVisible}
            onSortChange={toggleSort}
            onSelectionChange={(animalId, checked) => setSelectedIds((current) => { const next = new Set(current); if (checked) next.add(animalId); else next.delete(animalId); return next; })}
          />
          {visibleEligibleRows.length > 0 ? <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-border p-4">
            <div className="min-w-0 space-y-3">{evaluatedAt !== plannedFor ? <p className="text-sm text-muted-foreground">Os resultados usam a data da avaliação. A revisão reavalia cada animal na data planejada, e a gravação valida novamente.</p> : null}<label className="block space-y-1 text-sm"><span className="font-medium">Data planejada</span><Input aria-label="Data planejada da agenda agrupada" type="date" value={plannedFor} onChange={(event) => setPlannedFor(event.target.value)} /></label><div className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Contexto usado neste planejamento:</span> raiva {operationalContext.rabiesRiskArea === null ? "não informada" : operationalContext.rabiesRiskArea ? "em área de risco" : "fora de área de risco"}; cadência {operationalContext.sanitaryCadence === "annual" ? "anual" : operationalContext.sanitaryCadence === "semiannual" ? "semestral" : "não informada"}; reprodução e estágio de manejo resolvidos individualmente; manejo programado {operationalContext.management === "pre_weaning" ? "pré-desmama" : operationalContext.management === "rearing" ? "recria" : operationalContext.management === "pre_feedlot" ? "pré-confinamento" : operationalContext.management === "deferred_pasture" ? "pasto vedado" : "não informado"}.</div></div>
            <div className="flex flex-wrap items-center gap-3"><span className="text-sm text-muted-foreground">{visibleSelectedRows.length} selecionado(s)</span><Button type="button" disabled={visibleSelectedRows.length === 0 || !plannedFor || planning} onClick={() => { setPlanningError(null); setReview({ rows: visibleSelectedRows, plannedFor, context: { ...operationalContext } }); }}><CalendarPlus className="h-4 w-4" />Planejar agenda para selecionados</Button></div>
          </div> : null}
        </>
      ) : null}
      <Dialog open={!!review} onOpenChange={(open) => { if (!open && !submitting.current) setReview(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revisar planejamento sanitário</DialogTitle>
            <DialogDescription>Confirme os animais e a data. Este planejamento cria somente intenção futura, sem Evento, baixa de estoque ou carência ativa.</DialogDescription>
          </DialogHeader>
          {review ? <div className="max-h-80 space-y-3 overflow-auto text-sm">
            <p><strong>Data planejada:</strong> {review.plannedFor.split("-").reverse().join("/")}</p>
            <p>{reviewPreview?.summary.totalAnimals} animal(is) selecionado(s).</p>
            <p>{review.rows[0]?.planningKind === "avaliacao_manejo_generica" ? "Avaliação/manejo genérico: sem produto, dose, via ou esquema de aplicação." : "Esquema definido: produto e histórico revalidados ao salvar."}</p>
            <ul className="space-y-2">{dateReview.map(entry => <li key={`${entry.original.itemId}:${entry.original.animalId}`}><strong>{entry.original.identification}</strong> · {entry.original.lotLabel}<br />{entry.original.protocolLabel} · {entry.original.itemLabel}<br /><strong>{entry.label}</strong><br /><span className="text-muted-foreground">{entry.reason}</span></li>)}</ul>
            <p>A confirmação revalida novamente os dados locais na transação de gravação.</p>
            {dateReview.some(entry => entry.situation === "incompatible" || entry.situation === "existing") ? <Button type="button" variant="outline" disabled={planning} onClick={() => {
              const remaining = dateReview.filter(entry => entry.situation !== "incompatible" && entry.situation !== "existing").map(entry => entry.original);
              setSelectedIds(new Set(remaining.map(row => row.animalId)));
              setReview({ ...review, rows: remaining });
            }}>Excluir incompatíveis e revisar novamente</Button> : null}
            {reviewWarnings.length ? <details>
              <summary className="cursor-pointer">Cuidados técnicos do planejamento ({reviewWarnings.length})</summary>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {reviewWarnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </details> : null}
            <p>Produto já cadastrado será reutilizado na execução. Produto real, dose e via serão confirmados no registro factual.</p>
          </div> : null}
          {planningError ? <p role="alert" className="text-sm text-destructive">{planningError}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={planning} onClick={() => setReview(null)}>Voltar à seleção</Button>
            <Button type="button" disabled={planning || reviewBlocked || !reviewPreview?.commands.length || !!reviewPreview?.rejected.length} onClick={planSelected}>{planning ? "Salvando..." : "Confirmar e gerar Agenda"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
