import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, ShieldX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SanitaryProtocolWindowTableV2 } from "@/components/sanitario/SanitaryProtocolWindowTableV2";
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

const initialFilters: SanitaryProtocolWindowFiltersV2 = {
  lotId: "todos",
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
  label: string;
  match: (row: SanitaryProtocolWindowRowV2) => boolean;
}> = [
  { label: "Em janela", match: (row) => row.status === "in_action_window" && !row.alreadyPlanned },
  { label: "Próximos", match: (row) => ["eligible_soon", "not_yet_eligible", "near_deadline"].includes(row.status) && !row.alreadyPlanned },
  { label: "Atrasados", match: (row) => row.status === "overdue" && !row.alreadyPlanned },
  { label: "Dados insuficientes", match: (row) => row.status === "insufficient_data" },
  { label: "Bloqueados", match: (row) => row.blockers.length > 0 },
  { label: "Não aplicáveis", match: (row) => row.status === "not_applicable" },
  { label: "Já planejados", match: (row) => row.alreadyPlanned },
];

type Props = {
  source: SanitaryProtocolWindowSourceV2 | undefined;
  onPlan: (
    rows: SanitaryProtocolWindowRowV2[],
    plannedFor: string,
    operationalContext: SanitaryOperationalContextV2,
  ) => Promise<void>;
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function SanitaryProtocolWindowPanelV2({ source, onPlan }: Props) {
  const [protocolId, setProtocolId] = useState("");
  const [itemId, setItemId] = useState("");
  const [evaluatedAt, setEvaluatedAt] = useState(todayKey);
  const [plannedFor, setPlannedFor] = useState(todayKey);
  const [filters, setFilters] = useState(initialFilters);
  const [operationalContext, setOperationalContext] =
    useState<SanitaryOperationalContextV2>(
      EMPTY_SANITARY_OPERATIONAL_CONTEXT_V2,
    );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [planning, setPlanning] = useState(false);
  const protocols = source?.catalog.protocols ?? [];
  const items = source?.catalog.items.filter((item) => item.protocolId === protocolId) ?? [];

  useEffect(() => {
    setItemId("");
    setSelectedIds(new Set());
  }, [protocolId]);

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
      source && protocolId && itemId
        ? buildSanitaryProtocolWindowV2({
            source,
            protocolId,
            itemId,
            evaluatedAt,
            filters: { ...filters, category: "todas" },
            operationalContext,
          })
        : null,
    [evaluatedAt, filters, itemId, operationalContext, protocolId, source],
  );
  const selectedRows = result?.rows.filter((row) => selectedIds.has(row.animalId) && row.canSelect) ?? [];
  const categories = Array.from(
    new Map(
      (categoryResult?.rows ?? []).map((row) => [row.category, row.categoryLabel]),
    ).entries(),
  );

  const planSelected = async () => {
    if (selectedRows.length === 0 || !plannedFor) return;
    setPlanning(true);
    try {
      await onPlan(selectedRows, plannedFor, operationalContext);
      setSelectedIds(new Set());
    } finally {
      setPlanning(false);
    }
  };

  if (!source) {
    return <p className="text-sm text-muted-foreground">Carregando catálogo, rebanho e histórico sanitário local...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        Isso cria agenda futura, não execução. Produto real, dose, via, estoque e carência permanecem exclusivos do registro executado.
      </div>

      <section className="space-y-3 rounded-lg border border-border p-4" aria-label="Contexto operacional">
        <div>
          <h3 className="font-semibold">Contexto operacional</h3>
          <p className="text-sm text-muted-foreground">
            Contexto operacional ajuda a avaliar a janela, mas não substitui fonte técnica nem execução.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-sm"><span className="font-medium">Área de risco para raiva</span><select aria-label="Área de risco para raiva" className="h-11 w-full rounded-xl border border-border bg-background px-3" value={operationalContext.rabiesRiskArea === null ? "unknown" : operationalContext.rabiesRiskArea ? "yes" : "no"} onChange={(event) => setOperationalContext((current) => ({ ...current, rabiesRiskArea: event.target.value === "unknown" ? null : event.target.value === "yes" }))}><option value="unknown">Não informado</option><option value="yes">Sim</option><option value="no">Não</option></select></label>
          <label className="space-y-1 text-sm"><span className="font-medium">Cadência sanitária</span><select aria-label="Cadência sanitária" className="h-11 w-full rounded-xl border border-border bg-background px-3" value={operationalContext.sanitaryCadence ?? "unknown"} onChange={(event) => setOperationalContext((current) => ({ ...current, sanitaryCadence: event.target.value === "unknown" ? null : event.target.value as "annual" | "semiannual" }))}><option value="unknown">Não informado</option><option value="annual">Anual</option><option value="semiannual">Semestral</option></select></label>
          <label className="space-y-1 text-sm"><span className="font-medium">Contexto reprodutivo</span><select aria-label="Contexto reprodutivo" className="h-11 w-full rounded-xl border border-border bg-background px-3" value={operationalContext.reproductiveContext ?? "unknown"} onChange={(event) => setOperationalContext((current) => ({ ...current, reproductiveContext: event.target.value === "unknown" ? null : event.target.value as "prepartum" | "peripartum" }))}><option value="unknown">Não informado</option><option value="prepartum">Pré-parto</option><option value="peripartum">Periparto</option></select></label>
          <label className="space-y-1 text-sm"><span className="font-medium">Manejo</span><select aria-label="Manejo sanitário" className="h-11 w-full rounded-xl border border-border bg-background px-3" value={operationalContext.management ?? "unknown"} onChange={(event) => setOperationalContext((current) => ({ ...current, management: event.target.value === "unknown" ? null : event.target.value as SanitaryOperationalContextV2["management"] }))}><option value="unknown">Não informado</option><option value="pre_weaning">Pré-desmama</option><option value="rearing">Recria</option><option value="pre_feedlot">Pré-confinamento</option><option value="deferred_pasture">Pasto vedado</option></select></label>
        </div>
      </section>

      <section className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-3 lg:grid-cols-6" aria-label="Filtros das janelas sanitárias">
        <label className="space-y-1 text-sm lg:col-span-2"><span className="font-medium">Protocolo</span><select aria-label="Selecionar protocolo" className="h-11 w-full rounded-xl border border-border bg-background px-3" value={protocolId} onChange={(event) => setProtocolId(event.target.value)}><option value="">Selecione</option>{protocols.map((protocol) => <option key={protocol.id} value={protocol.id}>{protocol.name}</option>)}</select></label>
        <label className="space-y-1 text-sm lg:col-span-2"><span className="font-medium">Item do protocolo</span><select aria-label="Selecionar item do protocolo" className="h-11 w-full rounded-xl border border-border bg-background px-3" value={itemId} disabled={!protocolId} onChange={(event) => setItemId(event.target.value)}><option value="">Selecione</option>{items.map((item) => <option key={item.id} value={item.id}>{formatSanitaryProtocolItemLabelV2(item.logicalItemKey)}</option>)}</select></label>
        <label className="space-y-1 text-sm"><span className="font-medium">Data de avaliação</span><Input aria-label="Data de avaliação" type="date" value={evaluatedAt} onChange={(event) => setEvaluatedAt(event.target.value)} /></label>
        <label className="space-y-1 text-sm"><span className="font-medium">Lote</span><select aria-label="Filtrar por lote" className="h-11 w-full rounded-xl border border-border bg-background px-3" value={filters.lotId} onChange={(event) => setFilters((current) => ({ ...current, lotId: event.target.value }))}><option value="todos">Todos</option>{source.lots.filter((lot) => !lot.deleted_at).map((lot) => <option key={lot.id} value={lot.id}>{lot.nome}</option>)}</select></label>
        <label className="space-y-1 text-sm"><span className="font-medium">Categoria</span><select aria-label="Filtrar por categoria" className="h-11 w-full rounded-xl border border-border bg-background px-3" value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}><option value="todas">Todas</option>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="space-y-1 text-sm"><span className="font-medium">Sexo</span><select aria-label="Filtrar por sexo" className="h-11 w-full rounded-xl border border-border bg-background px-3" value={filters.sex} onChange={(event) => setFilters((current) => ({ ...current, sex: event.target.value as SanitaryProtocolWindowFiltersV2["sex"] }))}><option value="todos">Todos</option><option value="F">Fêmeas</option><option value="M">Machos</option></select></label>
        <label className="space-y-1 text-sm"><span className="font-medium">Situação do animal</span><select aria-label="Filtrar por situação do animal" className="h-11 w-full rounded-xl border border-border bg-background px-3" value={filters.animalStatus} onChange={(event) => setFilters((current) => ({ ...current, animalStatus: event.target.value as SanitaryProtocolWindowFiltersV2["animalStatus"] }))}><option value="ativo">Ativos</option><option value="todos">Todos</option><option value="vendido">Vendidos</option><option value="morto">Mortos</option><option value="retirado">Retirados</option></select></label>
        <label className="space-y-1 text-sm"><span className="font-medium">Elegibilidade</span><select aria-label="Filtrar por elegibilidade" className="h-11 w-full rounded-xl border border-border bg-background px-3" value={filters.eligibilityStatus} onChange={(event) => setFilters((current) => ({ ...current, eligibilityStatus: event.target.value as SanitaryEligibilityStatus | "todos" }))}><option value="todos">Todas</option>{eligibilityOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </section>

      {!protocolId || !itemId ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Selecione um protocolo e um item para calcular as janelas do rebanho.</div>
      ) : result ? (
        <>
          <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7" aria-label="Resumo das janelas sanitárias">
            {summaryStatuses.map((summary) => <div key={summary.label} className="rounded-lg border border-border p-3"><div className="text-2xl font-semibold">{result.rows.filter(summary.match).length}</div><div className="text-xs text-muted-foreground">{summary.label}</div></div>)}
          </section>
          <SanitaryProtocolWindowTableV2 rows={result.rows} selectedIds={selectedIds} onSelectionChange={(animalId, checked) => setSelectedIds((current) => { const next = new Set(current); if (checked) next.add(animalId); else next.delete(animalId); return next; })} />
          <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-border p-4">
            <div className="space-y-3"><label className="block space-y-1 text-sm"><span className="font-medium">Data planejada</span><Input aria-label="Data planejada da agenda agrupada" type="date" value={plannedFor} onChange={(event) => setPlannedFor(event.target.value)} /></label><div className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">Contexto usado neste planejamento:</span> raiva {operationalContext.rabiesRiskArea === null ? "não informada" : operationalContext.rabiesRiskArea ? "em área de risco" : "fora de área de risco"}; cadência {operationalContext.sanitaryCadence === "annual" ? "anual" : operationalContext.sanitaryCadence === "semiannual" ? "semestral" : "não informada"}; reprodução {operationalContext.reproductiveContext === "prepartum" ? "pré-parto" : operationalContext.reproductiveContext === "peripartum" ? "periparto" : "não informada"}; manejo {operationalContext.management === "pre_weaning" ? "pré-desmama" : operationalContext.management === "rearing" ? "recria" : operationalContext.management === "pre_feedlot" ? "pré-confinamento" : operationalContext.management === "deferred_pasture" ? "pasto vedado" : "não informado"}.</div></div>
            <div className="flex items-center gap-3"><span className="text-sm text-muted-foreground">{selectedRows.length} selecionado(s)</span><Button type="button" disabled={selectedRows.length === 0 || !plannedFor || planning} onClick={planSelected}><CalendarPlus className="h-4 w-4" />Planejar agenda para selecionados</Button><Button type="button" disabled title="Execução não pertence ao planejamento"><ShieldX className="h-4 w-4" />Execução indisponível</Button></div>
          </div>
        </>
      ) : null}
    </div>
  );
}
