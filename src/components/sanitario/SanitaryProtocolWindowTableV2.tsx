import "./SanitaryProtocolWindowTableV2.css";
import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { SanitaryProtocolWindowRowV2 } from "@/lib/sanitario/windows/sanitaryProtocolWindowsV2";
import type { SanitaryProtocolCatalogReadModelV2 } from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";
import { sanitaryOperationalGroupV2, sanitaryOperationalGroupsV2 } from "@/lib/sanitario/windows/sanitaryOperationalProjectionV2";

const SANITARY_WINDOW_STATUS_LABELS = {
  not_applicable: "Não aplicável",
  insufficient_data: "Dados insuficientes",
  not_yet_eligible: "Próximo da janela",
  eligible_soon: "Próximo da janela",
  in_action_window: "Em janela",
  near_deadline: "Próximo do limite",
  overdue: "Atrasado",
  completed: "Já executado",
} as const;

export function SanitaryWindowStatusLabelV2({ status }: Pick<SanitaryProtocolWindowRowV2, "status">) {
  return <>{SANITARY_WINDOW_STATUS_LABELS[status]}</>;
}

type Props = {
  catalog?: SanitaryProtocolCatalogReadModelV2;
  rows: SanitaryProtocolWindowRowV2[];
  selectedIds: Set<string>;
  sortKey: SanitaryWindowSortKeyV2;
  sortDirection: "asc" | "desc";
  visibleEligibleCount: number;
  allVisibleEligibleSelected: boolean;
  onSelectionChange: (animalId: string, checked: boolean) => void;
  onSelectAllVisible: (checked: boolean) => void;
  onSortChange: (key: SanitaryWindowSortKeyV2) => void;
};

export type SanitaryWindowSortKeyV2 =
  | "animal"
  | "lote"
  | "sexo"
  | "idade"
  | "categoria"
  | "status"
  | "motivo"
  | "agenda";

function statusLabel(row: SanitaryProtocolWindowRowV2) {
  if (row.alreadyPlanned) return "Já planejado";
  if (row.documentaryPending) return "Pendência documental";
  if (row.blockers.length > 0) return "Bloqueado";
  return SANITARY_WINDOW_STATUS_LABELS[row.status];
}

const groupOrder = [
  "Em janela",
  "Próximos da janela",
  "Atrasados",
  "Pendências documentais",
  "Dados insuficientes",
  "Bloqueados",
  "Não aplicáveis",
  "Já executados",
  "Já planejados",
] as const;

function groupLabel(row: SanitaryProtocolWindowRowV2) {
  if (row.alreadyPlanned) return "Já planejados";
  if (row.documentaryPending) return "Pendências documentais";
  if (row.blockers.length > 0) return "Bloqueados";
  if (row.status === "in_action_window") return "Em janela";
  if (["eligible_soon", "not_yet_eligible", "near_deadline"].includes(row.status)) {
    return "Próximos da janela";
  }
  if (row.status === "overdue") return "Atrasados";
  if (row.status === "insufficient_data") return "Dados insuficientes";
  if (row.status === "completed") return "Já executados";
  return "Não aplicáveis";
}

const sortOptions: Array<[SanitaryWindowSortKeyV2, string]> = [
  ["animal", "Animal"], ["lote", "Lote"], ["sexo", "Sexo / idade"], ["idade", "Idade"],
  ["categoria", "Categoria"], ["status", "Situação"], ["motivo", "Motivo"], ["agenda", "Agenda existente"],
];

export function SanitaryProtocolWindowTableV2(props: Props) {
  const { catalog, rows, selectedIds, sortKey, sortDirection, visibleEligibleCount,
    allVisibleEligibleSelected, onSelectionChange, onSelectAllVisible, onSortChange } = props;
  if (!rows.length) return <p role="status" className="rounded-lg border border-dashed border-border p-4 text-sm">Nenhum animal corresponde aos filtros selecionados. Isso não comprova ausência de necessidade sanitária.</p>;
  const groups = (catalog ? sanitaryOperationalGroupsV2 : groupOrder)
    .map(label => ({ label, rows: rows.filter(row => (catalog ? sanitaryOperationalGroupV2(row, catalog) : groupLabel(row)) === label) }))
    .filter(group => group.rows.length);
  const heading = (key: SanitaryWindowSortKeyV2, label: string) => <button type="button" className="min-h-11 text-left font-semibold" onClick={() => onSortChange(key)}>{label}{sortKey === key ? (sortDirection === "asc" ? " ↑" : " ↓") : ""}</button>;
  return <div className="sanitary-window-results space-y-3" aria-label="Resultados por animal">
    <p className="text-sm font-semibold">{rows[0].protocolLabel} · {rows[0].itemLabel}</p>
    <div className="flex flex-wrap items-end gap-3 text-sm">
      <label className="min-w-0 space-y-1"><span className="block">Ordenar resultados por</span><select aria-label="Ordenar resultados por" className="h-11 max-w-full rounded-lg border border-border bg-background px-3" value={sortKey} onChange={event => onSortChange(event.target.value as SanitaryWindowSortKeyV2)}>{sortOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <button type="button" className="min-h-11 rounded-lg border border-border px-3" onClick={() => onSortChange(sortKey)} aria-label="Inverter ordem">{sortDirection === "asc" ? "Crescente ↑" : "Decrescente ↓"}</button>
      <label className="flex min-h-11 items-center gap-2"><Checkbox aria-label="Selecionar todos os elegíveis visíveis" className="h-6 w-6" checked={visibleEligibleCount > 0 && allVisibleEligibleSelected} disabled={!visibleEligibleCount} onCheckedChange={checked => onSelectAllVisible(checked === true)} />Elegíveis visíveis</label>
    </div>
    <table className="sanitary-window-table text-left text-sm">
      <caption className="sr-only">Avaliações individuais, seleção e Agendas existentes</caption>
      <thead className="bg-muted/50"><tr><th scope="col" className="sanitary-column-select">Seleção</th><th scope="col" className="sanitary-column-animal" aria-sort={sortKey === "animal" ? (sortDirection === "asc" ? "ascending" : "descending") : undefined}><div className="flex flex-wrap gap-x-3">{heading("animal", "Animal")}{heading("lote", "Lote")}</div></th><th scope="col" className="sanitary-column-status">{heading("status", "Situação")}</th><th scope="col" className="sanitary-column-reason">{heading("motivo", "Impedimento ou motivo")}</th><th scope="col" className="sanitary-column-agenda">{heading("agenda", "Agenda existente")}</th></tr></thead>
      {groups.map(group => <tbody key={group.label}>
        <tr className="sanitary-group-heading bg-muted/30"><th scope="colgroup" colSpan={5} className="sanitary-group-title text-xs font-semibold uppercase text-muted-foreground">{group.label} ({group.rows.length})</th></tr>
        {group.rows.map(row => <tr key={row.animalId} className="sanitary-animal-row border-t border-border">
          <td className="sanitary-selection"><Checkbox aria-label={`Selecionar ${row.identification}`} className="h-11 w-11" checked={selectedIds.has(row.animalId)} disabled={!row.canSelect} onCheckedChange={checked => onSelectionChange(row.animalId, checked === true)} /></td>
          <td><Link className="inline-flex min-h-11 items-center gap-1 font-semibold text-primary hover:underline" to={row.animalHref}>{row.identification}<ExternalLink className="h-3.5 w-3.5" /></Link><p className="text-muted-foreground">{row.lotHref ? <Link className="inline-flex min-h-11 items-center text-primary hover:underline" to={row.lotHref}>{row.lotLabel}</Link> : row.lotLabel}</p></td>
          <td><Badge variant={row.canSelect ? "default" : "secondary"}>{statusLabel(row)}</Badge></td>
          <td><p>{row.blockers[0] ?? row.reason}</p><details><summary className="min-h-11 cursor-pointer py-3">Justificativas e contexto</summary>
            <p>{row.sexLabel} · {row.ageLabel} · {row.categoryLabel}</p>
            <p>Janela técnica: intervalo indeterminado nesta consulta.</p>
            {[...new Set([row.reason, ...row.precheck.reasons, ...row.blockers, ...row.documentaryPendingReasons, ...row.warnings])].filter(reason => reason !== (row.blockers[0] ?? row.reason)).map(reason => <p key={reason}>{reason}</p>)}
            <ContextResolutionDetailsV2 row={row} />
          </details></td>
          <td>{row.plannedFor ? <span>Agenda: {row.plannedFor.split("-").reverse().join("/")}</span> : <span className="sanitary-no-agenda">Sem Agenda aberta</span>}</td>
        </tr>)}
      </tbody>)}
    </table>
  </div>;
}

export function ContextResolutionDetailsV2({ row }: { row: SanitaryProtocolWindowRowV2 }) {
  const resolution = row.contextResolution;
  if (!resolution) return null;
  const facts = [["Idade em dias", resolution.ageDays], ["Sexo", resolution.sex], ["Lote", resolution.lotId],
    ["Gestação", resolution.pregnancy], ["Previsão de parto", resolution.expectedBirth], ["Peso observado (kg)", resolution.weight],
    ["Histórico sanitário", resolution.history], ["Desmama", resolution.weaning], ["Reprodução", resolution.reproduction], ["Manejo", resolution.management],
    ["Risco", resolution.risk], ["Cadência", resolution.cadence]] as const;
  return <details className="mt-2 text-xs"><summary>Contexto individual e fontes</summary><dl className="space-y-2 py-2">
    {facts.map(([label, fact]) => <div key={label}><dt className="font-medium">{label}: {fact.status === "known" ? "Conhecido" : fact.status === "contradictory" ? "Contraditório" : "Desconhecido"}</dt>
      <dd>{fact.reason} {fact.sources.length ? `Fontes: ${[...new Set(fact.sources.map(contextSourceLabel))].join(", ")}` : ""}</dd></div>)}
  </dl></details>;
}

function contextSourceLabel(reference: string) {
  const kind = reference.split(":")[0];
  const labels: Record<string, string> = {
    animais: "Cadastro do animal", lotes: "Cadastro do lote", eventos: "Histórico de eventos",
    event: "Evento documentado", item: "Versão técnica do item", agenda: "Agenda de manejo",
    contexto_declarado: "Contexto declarado", contexto_programado: "Manejo programado",
  };
  return labels[kind] ?? "Registro local referenciado";
}
