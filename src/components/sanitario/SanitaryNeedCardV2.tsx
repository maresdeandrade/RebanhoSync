import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import type { SanitaryProtocolWindowRowV2 } from "@/lib/sanitario/windows/sanitaryProtocolWindowsV2";
import { ContextResolutionDetailsV2, SanitaryWindowStatusLabelV2 } from "./SanitaryProtocolWindowTableV2";

export type SanitaryNeedGroupV2 = Pick<SanitaryProtocolWindowRowV2, "itemId" | "itemLabel" | "protocolId" | "protocolLabel"> & {
  rows: SanitaryProtocolWindowRowV2[];
  version?: number;
  technical?: boolean;
  currentVersionId?: string;
};

export type SanitaryNeedsSectionV2 = "agenda" | "historico";

type Props = {
  group: SanitaryNeedGroupV2;
  hideAnimalIdentity?: boolean;
  onChoose: (itemId: string) => void;
  onOpenSection?: (section: SanitaryNeedsSectionV2) => void;
};

function cardAction(group: SanitaryNeedGroupV2, canNavigate: boolean): { label: string; section?: SanitaryNeedsSectionV2; itemId?: string } {
  if (group.currentVersionId) return { label: "Consultar versão vigente", itemId: group.currentVersionId };
  if (canNavigate && group.rows.every(row => row.alreadyPlanned)) return { label: "Abrir Agenda sanitária", section: "agenda" };
  if (!group.technical && group.rows.some(row => row.canSelect)) return { label: "Planejar manejo" };
  if (group.rows.some(row => row.blockers.length)) return { label: "Ver restrição técnica" };
  if (canNavigate && group.rows.some(row => row.precheck.missingExecutedHistory || row.documentaryPending)) return { label: "Consultar histórico", section: "historico" };
  return { label: "Ver detalhes técnicos" };
}

export function SanitaryNeedCardV2({ group, hideAnimalIdentity, onChoose, onOpenSection }: Props) {
  const action = cardAction(group, Boolean(onOpenSection));
  return <article aria-label={`${group.protocolLabel} · ${group.itemLabel}`} className="min-w-0 space-y-2 break-words rounded-lg border border-border p-3">
    <h4 className="font-semibold">{group.protocolLabel} · {group.itemLabel}</h4>
    <ul className="space-y-2 text-sm">{group.rows.map(row => <NeedAnimal key={row.animalId} row={row} hideIdentity={hideAnimalIdentity} />)}</ul>
    <details className="space-y-2 text-sm"><summary className="min-h-11 cursor-pointer py-3">Detalhes técnicos, versão e documentos</summary>
      <p>Versão {group.version} · item {group.itemId} · protocolo {group.protocolId}</p>
      {group.rows.map(row => <NeedAnimalDetails key={row.animalId} row={row} hideIdentity={hideAnimalIdentity} />)}
      <Link className="text-primary underline" to="/protocolos-sanitarios/catalogo-v2">Consultar fontes, versões e documentos no Catálogo</Link>
    </details>
    <Button type="button" variant={action.label === "Planejar manejo" ? "default" : "outline"} onClick={() => {
      if (action.section && onOpenSection) onOpenSection(action.section);
      else onChoose(action.itemId ?? group.itemId);
    }}>{action.label}</Button>
  </article>;
}

function NeedAnimal({ row, hideIdentity }: { row: SanitaryProtocolWindowRowV2; hideIdentity?: boolean }) {
  return <li className="space-y-1" data-evaluation-key={`${row.protocolId}:${row.itemId}:${row.animalId}`}>
    {!hideIdentity ? <p className="font-medium">{row.identification} · {row.lotLabel}</p> : null}
    {!row.alreadyPlanned ? <><p><SanitaryWindowStatusLabelV2 status={row.status} /></p><p>{row.blockers[0] ?? row.reason}</p></> : null}
    {row.plannedFor ? <p>Agenda existente · {row.plannedFor.split("-").reverse().join("/")}</p> : null}
  </li>;
}

function NeedAnimalDetails({ row, hideIdentity }: { row: SanitaryProtocolWindowRowV2; hideIdentity?: boolean }) {
  const decisiveReason = !row.alreadyPlanned ? row.blockers[0] ?? row.reason : null;
  const reasons = [...new Set([row.reason, ...row.precheck.reasons, ...row.blockers, ...row.documentaryPendingReasons, ...row.warnings])];
  return <div className="space-y-1">
      {!hideIdentity ? <p className="font-medium">{row.identification}</p> : null}
      {reasons.filter(reason => reason !== decisiveReason).map(reason => <p key={reason} className="text-muted-foreground">{reason}</p>)}
      <p>Janela técnica: intervalo indeterminado nesta consulta.</p>
      <ContextResolutionDetailsV2 row={row} />
  </div>;
}
