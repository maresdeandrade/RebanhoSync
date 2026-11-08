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

export function SanitaryProtocolWindowTableV2({
  catalog,
  rows,
  selectedIds,
  sortKey,
  sortDirection,
  visibleEligibleCount,
  allVisibleEligibleSelected,
  onSelectionChange,
  onSelectAllVisible,
  onSortChange,
}: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Nenhum animal corresponde aos filtros selecionados.
      </div>
    );
  }

  const groups = (catalog ? sanitaryOperationalGroupsV2 : groupOrder)
    .map((label) => ({ label, rows: rows.filter((row) => (catalog ? sanitaryOperationalGroupV2(row, catalog) : groupLabel(row)) === label) }))
    .filter((group) => group.rows.length > 0);
  const sortGlyph = (key: SanitaryWindowSortKeyV2) =>
    sortKey === key ? (sortDirection === "asc" ? " ↑" : " ↓") : "";
  const headerButton = (key: SanitaryWindowSortKeyV2, label: string) => (
    <button
      type="button"
      className="text-left font-semibold hover:text-foreground"
      onClick={() => onSortChange(key)}
    >
      {label}
      {sortGlyph(key)}
    </button>
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="block w-full text-left text-sm md:table md:min-w-[1080px]">
        <thead className="hidden bg-muted/50 text-xs uppercase text-muted-foreground md:table-header-group">
          <tr>
            <th className="w-12 px-3 py-3">
              <Checkbox
                aria-label="Selecionar todos os elegíveis visíveis"
                checked={visibleEligibleCount > 0 && allVisibleEligibleSelected}
                disabled={visibleEligibleCount === 0}
                onCheckedChange={(checked) => onSelectAllVisible(checked === true)}
              />
            </th>
            <th className="px-3 py-3">{headerButton("animal", "Animal")}</th>
            <th className="px-3 py-3">{headerButton("lote", "Lote")}</th>
            <th className="px-3 py-3">{headerButton("sexo", "Sexo / idade")}</th>
            <th className="px-3 py-3">{headerButton("categoria", "Categoria")}</th>
            <th className="px-3 py-3">Protocolo / item</th>
            <th className="px-3 py-3">{headerButton("status", "Status")}</th>
            <th className="px-3 py-3">{headerButton("motivo", "Motivo")}</th>
            <th className="px-3 py-3">{headerButton("agenda", "Agenda existente")}</th>
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.label} className="block divide-y divide-border md:table-row-group">
              <tr className="block bg-muted/30 md:table-row">
                <th colSpan={9} className="block px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:table-cell">
                  {group.label} ({group.rows.length})
                </th>
              </tr>
              {group.rows.map((row) => (
              <tr key={row.animalId} className="block align-top md:table-row">
              <td className="block px-3 py-2 md:table-cell md:py-4">
                <Checkbox
                  aria-label={`Selecionar ${row.identification}`}
                  checked={selectedIds.has(row.animalId)}
                  disabled={!row.canSelect}
                  onCheckedChange={(checked) =>
                    onSelectionChange(row.animalId, checked === true)
                  }
                />
              </td>
              <td className="block px-3 py-2 md:table-cell md:py-4 font-medium">
                <Link className="inline-flex items-center gap-1 text-primary hover:underline" to={row.animalHref}>
                  {row.identification}<ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </td>
              <td className="block px-3 py-2 md:table-cell md:py-4">
                {row.lotHref ? (
                  <Link className="inline-flex items-center gap-1 text-primary hover:underline" to={row.lotHref}>
                    {row.lotLabel}<ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                ) : row.lotLabel}
              </td>
              <td className="block px-3 py-2 md:table-cell md:py-4"><div>{row.sexLabel}</div><div className="text-muted-foreground">{row.ageLabel}</div></td>
              <td className="block px-3 py-2 md:table-cell md:py-4">{row.categoryLabel}</td>
              <td className="block px-3 py-2 md:table-cell md:py-4"><div>{row.protocolLabel}</div><div className="text-muted-foreground">{row.itemLabel}</div></td>
              <td className="block px-3 py-2 md:table-cell md:py-4">
                <Badge variant={row.canSelect ? "default" : "secondary"}>{statusLabel(row)}</Badge>
              </td>
              <td className="block px-3 py-2 md:table-cell md:max-w-sm md:py-4">
                <div>{row.blockers[0] ?? row.reason}</div>
                <div className="text-xs text-muted-foreground">Janela técnica: intervalo indeterminado nesta consulta.</div>
                <details><summary className="cursor-pointer text-xs">Justificativas e contexto</summary>
                  {[...new Set([row.reason, ...row.precheck.reasons, ...row.blockers, ...row.documentaryPendingReasons, ...row.warnings])].filter(reason => reason !== (row.blockers[0] ?? row.reason)).map(reason => <p key={reason}>{reason}</p>)}
                  <ContextResolutionDetailsV2 row={row} />
                </details>
              </td>
              <td className="block px-3 py-2 md:table-cell md:py-4 text-muted-foreground">
                {row.plannedFor ? row.plannedFor.split("-").reverse().join("/") : "Sem agenda aberta"}
              </td>
              </tr>
              ))}
          </tbody>
        ))}
      </table>
    </div>
  );
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
