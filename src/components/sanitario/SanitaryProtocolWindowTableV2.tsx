import { Fragment } from "react";
import { ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { SanitaryProtocolWindowRowV2 } from "@/lib/sanitario/windows/sanitaryProtocolWindowsV2";

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

type Props = {
  rows: SanitaryProtocolWindowRowV2[];
  selectedIds: Set<string>;
  onSelectionChange: (animalId: string, checked: boolean) => void;
};

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
  rows,
  selectedIds,
  onSelectionChange,
}: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Nenhum animal corresponde aos filtros selecionados.
      </div>
    );
  }

  const groups = groupOrder
    .map((label) => ({ label, rows: rows.filter((row) => groupLabel(row) === label) }))
    .filter((group) => group.rows.length > 0);

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[1080px] text-left text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="w-12 px-3 py-3"><span className="sr-only">Selecionar</span></th>
            <th className="px-3 py-3">Animal</th>
            <th className="px-3 py-3">Lote</th>
            <th className="px-3 py-3">Sexo / idade</th>
            <th className="px-3 py-3">Categoria</th>
            <th className="px-3 py-3">Protocolo / item</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3">Motivo e pendências</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {groups.map((group) => (
            <Fragment key={group.label}>
              <tr className="bg-muted/30">
                <th colSpan={8} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label} ({group.rows.length})
                </th>
              </tr>
              {group.rows.map((row) => (
              <tr key={row.animalId} className="align-top">
              <td className="px-3 py-4">
                <Checkbox
                  aria-label={`Selecionar ${row.identification}`}
                  checked={selectedIds.has(row.animalId)}
                  disabled={!row.canSelect}
                  onCheckedChange={(checked) =>
                    onSelectionChange(row.animalId, checked === true)
                  }
                />
              </td>
              <td className="px-3 py-4 font-medium">
                <Link className="inline-flex items-center gap-1 text-primary hover:underline" to={row.animalHref}>
                  {row.identification}<ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </td>
              <td className="px-3 py-4">
                {row.lotHref ? (
                  <Link className="inline-flex items-center gap-1 text-primary hover:underline" to={row.lotHref}>
                    {row.lotLabel}<ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                ) : row.lotLabel}
              </td>
              <td className="px-3 py-4"><div>{row.sexLabel}</div><div className="text-muted-foreground">{row.ageLabel}</div></td>
              <td className="px-3 py-4">{row.categoryLabel}</td>
              <td className="px-3 py-4"><div>{row.protocolLabel}</div><div className="text-muted-foreground">{row.itemLabel}</div></td>
              <td className="px-3 py-4">
                <Badge variant={row.canSelect ? "default" : "secondary"}>{statusLabel(row)}</Badge>
                {row.plannedFor ? <div className="mt-1 text-xs text-muted-foreground">Planejada para {row.plannedFor.split("-").reverse().join("/")}</div> : null}
              </td>
              <td className="max-w-sm px-3 py-4">
                <div>{row.reason}</div>
                {row.blockers[0] ? <div className="mt-1 text-xs text-destructive">{row.blockers[0]}</div> : null}
                {row.documentaryPendingReasons[0] ? <div className="mt-1 text-xs text-amber-700">{row.documentaryPendingReasons[0]}</div> : null}
                {row.warnings[0] ? <div className="mt-1 text-xs text-muted-foreground">{row.warnings[0]}</div> : null}
              </td>
              </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
