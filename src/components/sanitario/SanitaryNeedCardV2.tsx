import { Button } from "@/components/ui/button";
import type { SanitaryProtocolWindowRowV2 } from "@/lib/sanitario/windows/sanitaryProtocolWindowsV2";
import { ContextResolutionDetailsV2, SanitaryWindowStatusLabelV2 } from "./SanitaryProtocolWindowTableV2";

export type SanitaryNeedGroupV2 = Pick<SanitaryProtocolWindowRowV2, "itemId" | "itemLabel" | "protocolId" | "protocolLabel"> & {
  rows: SanitaryProtocolWindowRowV2[];
};

export function SanitaryNeedCardV2({ group, onChoose }: { group: SanitaryNeedGroupV2; onChoose: (itemId: string) => void }) {
  const canPlan = group.rows.some(row => row.canSelect);
  return <article aria-label={`${group.protocolLabel} · ${group.itemLabel}`} className="min-w-0 space-y-3 rounded-lg border border-border p-4">
    <h3 className="font-semibold">{group.protocolLabel} · {group.itemLabel}</h3>
    <p className="text-sm text-muted-foreground">Referência técnica do catálogo, sujeita ao contexto individual. Não comprova execução ou obrigatoriedade.</p>
    <ul className="space-y-3 text-sm">{group.rows.map(row => <NeedAnimal key={row.animalId} row={row} />)}</ul>
    <Button type="button" variant={canPlan ? "default" : "outline"} onClick={() => onChoose(group.itemId)}>
      {canPlan ? "Planejar manejo" : "Consultar limitações e complementos"}
    </Button>
  </article>;
}

function needSituation(row: SanitaryProtocolWindowRowV2) {
  if (row.alreadyPlanned) return "Agenda existente";
  if (row.status === "insufficient_data") return "Informação insuficiente";
  if (row.blockers.length) return "Item não autorizado para planejamento";
  if (!row.canSelect) return "Consulta técnica";
  if (row.planningKind === "avaliacao_manejo_generica") return "Necessidade identificada · avaliação/manejo genérico";
  return "Necessidade identificada";
}

function NeedAnimal({ row }: { row: SanitaryProtocolWindowRowV2 }) {
  const reasons = [...new Set([...row.precheck.reasons.filter(reason => reason !== row.reason), ...row.blockers, ...row.documentaryPendingReasons, ...row.warnings])];
  return <li className="space-y-1 border-t border-border pt-2">
    <p className="font-medium">{row.identification} · {row.lotLabel}</p>
    <p>{needSituation(row)} · <SanitaryWindowStatusLabelV2 status={row.status} /></p>
    <p>{row.reason}</p>
    {reasons.map(reason => <p key={reason} className="text-muted-foreground">{reason}</p>)}
    <p>{row.plannedFor ? `Agenda prevista: ${row.plannedFor.split("-").reverse().join("/")}` : row.canSelect ? "Planejamento disponível" : "Planejamento indisponível neste contexto"}</p>
    <ContextResolutionDetailsV2 row={row} />
  </li>;
}
