import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildSanitaryContextualNeedsV2 } from "@/lib/sanitario/windows/sanitaryProtocolWindowsV2";
import { SanitaryProtocolWindowPanelV2 } from "./SanitaryProtocolWindowPanelV2";
import { ContextResolutionDetailsV2, SanitaryWindowStatusLabelV2 } from "./SanitaryProtocolWindowTableV2";

type Props = ComponentProps<typeof SanitaryProtocolWindowPanelV2> & {
  onTargetChange?: (animalId: string | null, lotId: string | null) => void;
};

export function SanitaryContextualNeedsPanelV2(props: Props) {
  return <ContextualNeeds key={props.source?.fazendaId ?? "loading"} {...props} />;
}

function ContextualNeeds(props: Props) {
  const { source, initialAnimalId, initialLotId, onTargetChange } = props;
  const [mode, setMode] = useState<"needs" | "technical">("needs");
  const [animalId, setAnimalId] = useState(initialAnimalId ?? "");
  const [lotId, setLotId] = useState(initialAnimalId ? "" : initialLotId ?? "");
  const [evaluatedAt, setEvaluatedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  useEffect(() => {
    setAnimalId(initialAnimalId ?? "");
    setLotId(initialAnimalId ? "" : initialLotId ?? "");
    setSelectedItem(null);
  }, [initialAnimalId, initialLotId]);
  const rows = useMemo(() => source ? buildSanitaryContextualNeedsV2({
    source, evaluatedAt, animalId, lotId,
  }) : [], [source, evaluatedAt, animalId, lotId]);
  const groups = useMemo(() => Array.from(new Map(rows.map(row => [row.itemId, {
    itemId: row.itemId, protocolId: row.protocolId, protocolLabel: row.protocolLabel, itemLabel: row.itemLabel,
  }])).values()).map(group => ({ ...group, rows: rows.filter(row => row.itemId === group.itemId) })), [rows]);
  const selected = groups.find(group => group.itemId === selectedItem);
  const changeTarget = (animal: string, lot: string) => {
    setAnimalId(animal); setLotId(lot); setSelectedItem(null);
    onTargetChange?.(animal || null, lot || null);
  };
  if (!source) return <p role="status">Carregando catálogo, rebanho e histórico sanitário local...</p>;
  const animals = source.animals.filter(animal => !animal.deleted_at && animal.status === "ativo" && (!source.fazendaId || animal.fazenda_id === source.fazendaId));
  const lots = source.lots.filter(lot => !lot.deleted_at && (!source.fazendaId || lot.fazenda_id === source.fazendaId));
  const animal = animals.find(entry => entry.id === animalId);
  const lot = lots.find(entry => entry.id === lotId);
  const auxiliaryLot = animal && lots.find(entry => entry.id === props.initialLotContextId);
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2" aria-label="Entrada das janelas sanitárias">
      <Button type="button" variant={mode === "needs" ? "default" : "outline"} aria-pressed={mode === "needs"} onClick={() => { setMode("needs"); setSelectedItem(null); }}>Ver necessidades</Button>
      <Button type="button" variant={mode === "technical" ? "default" : "outline"} aria-pressed={mode === "technical"} onClick={() => { setMode("technical"); setSelectedItem(null); }}>Consultar por protocolo</Button>
    </div>
    <p role="status" className="text-sm text-muted-foreground">{online ? "Consulta pelos dados disponíveis neste dispositivo." : "Offline: consulta local disponível; dados podem estar desatualizados."} Conexão disponível não confirma sincronização.</p>
    {mode === "technical" ? <SanitaryProtocolWindowPanelV2 {...props} initialAnimalId={animalId || null} initialLotId={lotId || null} /> : selected ? <>
      <Button type="button" variant="outline" onClick={() => setSelectedItem(null)}>Voltar às necessidades</Button>
      <h3 className="font-semibold">{selected.protocolLabel} · {selected.itemLabel}</h3>
      <SanitaryProtocolWindowPanelV2 {...props} key={selected.itemId} initialAnimalId={animalId || null} initialLotId={lotId || null}
        initialProtocolId={selected.protocolId} initialItemId={selected.itemId} initialEvaluatedAt={evaluatedAt} contextual />
    </> : <>
      <p className="text-sm text-muted-foreground">Isso cria agenda futura, não execução. Produto real, dose, via, estoque e carência permanecem exclusivos do registro executado.</p>
      <section aria-label="Alvo das necessidades sanitárias" className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm">Animal<select aria-label="Animal das necessidades" className="h-11 w-full rounded-xl border border-border bg-background px-3" value={animalId} onChange={event => changeTarget(event.target.value, "")}>
          <option value="">Escolha um animal</option>{animals.map(entry => <option key={entry.id} value={entry.id}>{entry.nome || entry.identificacao}</option>)}
        </select></label>
        <label className="space-y-1 text-sm">Lote<select aria-label="Lote das necessidades" className="h-11 w-full rounded-xl border border-border bg-background px-3" value={lotId} onChange={event => changeTarget("", event.target.value)}>
          <option value="">Escolha um lote</option>{lots.map(entry => <option key={entry.id} value={entry.id}>{entry.nome}</option>)}
        </select></label>
        <label className="space-y-1 text-sm">Data de avaliação<Input aria-label="Data de avaliação das necessidades" type="date" value={evaluatedAt} onChange={event => setEvaluatedAt(event.target.value)} /></label>
      </section>
      {animal || lot ? <div className="space-y-2 text-sm">
        <p>Filtro ativo: {animal ? `animal ${animal.nome || animal.identificacao}` : `lote ${lot?.nome}`}</p>
        {auxiliaryLot ? <p>Lote usado apenas como contexto auxiliar: {auxiliaryLot.nome}.</p> : null}
        <Button type="button" variant="outline" onClick={() => { changeTarget("", ""); props.onClearInitialFilter?.(); }}>Limpar filtro</Button>
      </div> : null}
      {!source.catalog.protocols.length ? <p role="status">Nenhum protocolo disponível no catálogo local. Use Atualizar catálogo quando houver conexão.</p> : null}
      {!animalId && !lotId ? <p role="status">Escolha um animal ou lote para ver necessidades e limitações.</p> : !rows.length ? <p role="status">Nenhuma necessidade encontrada nos dados locais para este alvo. Isso não comprova conformidade sanitária.</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map(group => <article key={group.itemId} aria-label={`${group.protocolLabel} · ${group.itemLabel}`} className="min-w-0 space-y-3 rounded-lg border border-border p-4">
          <h3 className="font-semibold">{group.protocolLabel} · {group.itemLabel}</h3>
          <p className="text-sm text-muted-foreground">Referência técnica do catálogo, sujeita ao contexto individual. Não comprova execução ou obrigatoriedade.</p>
          <ul className="space-y-3 text-sm">{group.rows.map(row => <li key={row.animalId} className="space-y-1 border-t border-border pt-2">
            <p className="font-medium">{row.identification} · {row.lotLabel}</p>
            <p>{row.alreadyPlanned ? "Agenda existente" : row.status === "insufficient_data" ? "Informação insuficiente" : row.blockers.length ? "Item não autorizado para planejamento" : row.canSelect ? row.planningKind === "avaliacao_manejo_generica" ? "Necessidade identificada · avaliação/manejo genérico" : "Necessidade identificada" : "Consulta técnica"} · <SanitaryWindowStatusLabelV2 status={row.status} /></p>
            <p>{row.reason}</p>
            {[...new Set([...row.precheck.reasons.filter(reason => reason !== row.reason), ...row.blockers, ...row.documentaryPendingReasons, ...row.warnings])].map(reason => <p key={reason} className="text-muted-foreground">{reason}</p>)}
            <p>{row.plannedFor ? `Agenda prevista: ${row.plannedFor.split("-").reverse().join("/")}` : row.canSelect ? "Planejamento disponível" : "Planejamento indisponível neste contexto"}</p>
            <ContextResolutionDetailsV2 row={row} />
          </li>)}</ul>
          <Button type="button" variant={group.rows.some(row => row.canSelect) ? "default" : "outline"} onClick={() => setSelectedItem(group.itemId)}>
            {group.rows.some(row => row.canSelect) ? "Planejar manejo" : "Consultar limitações e complementos"}
          </Button>
        </article>)}
      </div>
    </>}
  </div>;
}
