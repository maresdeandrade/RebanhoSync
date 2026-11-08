import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Animal, Lote } from "@/lib/offline/types";
import type { SanitaryProtocolWindowSourceV2 } from "@/lib/sanitario/windows/sanitaryProtocolWindowsV2";
import { SanitaryNeedCardV2, type SanitaryNeedGroupV2, type SanitaryNeedsSectionV2 } from "./SanitaryNeedCardV2";
import { sanitaryOperationalGroupsV2, sanitaryOperationalGroupV2 } from "@/lib/sanitario/windows/sanitaryOperationalProjectionV2";

export type SanitaryNeedsTargetV2 = { animalId: string; lotId: string };

type Props = {
  source: SanitaryProtocolWindowSourceV2;
  target: SanitaryNeedsTargetV2;
  evaluatedAt: string;
  groups: SanitaryNeedGroupV2[];
  initialLotContextId?: string | null;
  onTargetChange: (animalId: string, lotId: string) => void;
  onDateChange: (date: string) => void;
  onChooseItem: (itemId: string) => void;
  onOpenSection?: (section: SanitaryNeedsSectionV2) => void;
  onClearInitialFilter?: () => void;
};

export function SanitaryNeedsDiscoveryV2({ source, target, evaluatedAt, groups, initialLotContextId, onTargetChange, onDateChange, onChooseItem, onOpenSection, onClearInitialFilter }: Props) {
  const animals = source.animals.filter(animal => !animal.deleted_at && animal.status === "ativo" && (!source.fazendaId || animal.fazenda_id === source.fazendaId));
  const lots = source.lots.filter(lot => !lot.deleted_at && (!source.fazendaId || lot.fazenda_id === source.fazendaId));
  const animal = animals.find(entry => entry.id === target.animalId);
  const lot = lots.find(entry => entry.id === target.lotId);
  const auxiliaryLot = lots.find(entry => entry.id === initialLotContextId);
  const clearTarget = () => { onTargetChange("", ""); onClearInitialFilter?.(); };
  return <>
    <p className="text-sm text-muted-foreground">Isso cria agenda futura, não execução. Produto real, dose, via, estoque e carência permanecem exclusivos do registro executado.</p>
    <p className="text-sm text-muted-foreground">Planejamento manual possível não comprova necessidade de aplicação. Intervalos técnicos completos permanecem indeterminados nesta consulta.</p>
    <section aria-label="Alvo das necessidades sanitárias" className="grid gap-3 sm:grid-cols-3">
      <label className="space-y-1 text-sm">Animal<select aria-label="Animal das necessidades" className="h-11 w-full rounded-xl border border-border bg-background px-3" value={target.animalId} onChange={event => onTargetChange(event.target.value, "")}>
        <option value="">Escolha um animal</option>{animals.map(entry => <option key={entry.id} value={entry.id}>{entry.nome || entry.identificacao}</option>)}
      </select></label>
      <label className="space-y-1 text-sm">Lote<select aria-label="Lote das necessidades" className="h-11 w-full rounded-xl border border-border bg-background px-3" value={target.lotId} onChange={event => onTargetChange("", event.target.value)}>
        <option value="">Escolha um lote</option>{lots.map(entry => <option key={entry.id} value={entry.id}>{entry.nome}</option>)}
      </select></label>
      <label className="space-y-1 text-sm">Data de avaliação<Input aria-label="Data de avaliação das necessidades" type="date" value={evaluatedAt} onChange={event => onDateChange(event.target.value)} /></label>
    </section>
    <TargetSummary animal={animal} lot={lot} auxiliaryLot={auxiliaryLot} onClear={clearTarget} />
    {animal ? <h3 className="font-semibold">Consulta individual: {animal.nome || animal.identificacao} · {lots.find(entry => entry.id === animal.lote_id)?.nome ?? "Sem lote"}</h3> : lot ? <h3 className="font-semibold">Consulta coletiva · lote {lot.nome}</h3> : null}
    <EmptyNeedsState hasCatalog={source.catalog.protocols.length > 0} target={target} hasRows={groups.length > 0} />
    <p className="text-sm text-muted-foreground">{new Set(groups.flatMap(group => group.rows.map(row => row.animalId))).size} animal(is) com linhas retornadas · {groups.reduce((count, group) => count + group.rows.length, 0)} avaliações individuais. Ausência de linha não comprova avaliação ou conformidade.</p>
    {sanitaryOperationalGroupsV2.map(label => {
      const projected = groups.map(group => ({ ...group,
        version: source.catalog.items.find(item => item.id === group.itemId)?.version,
        currentVersionId: currentVersionId(source, group.itemId),
        technical: label === "Restrições e consulta técnica",
        rows: group.rows.filter(row => sanitaryOperationalGroupV2(row, source.catalog) === label),
      })).filter(group => group.rows.length);
      if (!projected.length) return null;
      const count = projected.reduce((count, group) => count + group.rows.length, 0);
      const cards = <div className="grid gap-3">{projected.map(group => <SanitaryNeedCardV2 key={group.itemId} group={group} hideAnimalIdentity={Boolean(animal)} onChoose={onChooseItem} onOpenSection={onOpenSection} />)}</div>;
      return label === "Restrições e consulta técnica" || label === "Informações insuficientes"
        ? <details key={label} className="space-y-3"><summary className="min-h-11 cursor-pointer py-3 font-semibold">{label} · {count} avaliações</summary>{cards}</details>
        : <section key={label} aria-label={label} className="space-y-3"><h3 className="font-semibold">{label} · {count} avaliações</h3>{cards}</section>;
    })}
  </>;
}

function currentVersionId(source: SanitaryProtocolWindowSourceV2, itemId: string) {
  const item = source.catalog.items.find(entry => entry.id === itemId);
  if (!item) return undefined;
  return source.catalog.items.filter(entry => entry.protocolId === item.protocolId && entry.logicalItemKey === item.logicalItemKey && entry.status === "active" && entry.version > item.version)
    .sort((left, right) => right.version - left.version)[0]?.id;
}

function TargetSummary({ animal, lot, auxiliaryLot, onClear }: { animal?: Animal; lot?: Lote; auxiliaryLot?: Lote; onClear: () => void }) {
  if (!animal && !lot) return null;
  return <div className="space-y-2 text-sm">
    <p>Filtro ativo: {animal ? `animal ${animal.nome || animal.identificacao}` : `lote ${lot?.nome}`}</p>
    {animal && auxiliaryLot ? <p>Lote usado apenas como contexto auxiliar: {auxiliaryLot.nome}.</p> : null}
    <Button type="button" variant="outline" onClick={onClear}>Limpar filtro</Button>
  </div>;
}

function EmptyNeedsState({ hasCatalog, target, hasRows }: { hasCatalog: boolean; target: SanitaryNeedsTargetV2; hasRows: boolean }) {
  const messages: string[] = [];
  if (!hasCatalog) messages.push("Nenhum protocolo disponível no catálogo local. Use Atualizar catálogo quando houver conexão.");
  if (!target.animalId && !target.lotId) messages.push("Escolha um animal ou lote para ver necessidades e limitações.");
  else if (!hasRows) messages.push("Nenhuma avaliação retornada nos dados locais para este alvo. Isso não comprova ausência de necessidade ou conformidade sanitária.");
  return <>{messages.map(message => <p key={message} role="status">{message}</p>)}</>;
}
