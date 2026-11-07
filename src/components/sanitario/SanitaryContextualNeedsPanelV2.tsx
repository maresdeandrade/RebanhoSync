import { useEffect, useMemo, useState, useSyncExternalStore, type ComponentProps, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { buildSanitaryContextualNeedsV2 } from "@/lib/sanitario/windows/sanitaryProtocolWindowsV2";
import { SanitaryProtocolWindowPanelV2 } from "./SanitaryProtocolWindowPanelV2";
import { SanitaryNeedsDiscoveryV2, type SanitaryNeedsTargetV2 } from "./SanitaryNeedsDiscoveryV2";
import type { SanitaryNeedGroupV2 } from "./SanitaryNeedCardV2";

type Props = ComponentProps<typeof SanitaryProtocolWindowPanelV2> & {
  onTargetChange?: (animalId: string | null, lotId: string | null) => void;
};
type Mode = "needs" | "technical";
const modes = [{ value: "needs", label: "Ver necessidades" }, { value: "technical", label: "Consultar por protocolo" }] as const;

export function SanitaryContextualNeedsPanelV2(props: Props) {
  return <ContextualNeeds key={props.source?.fazendaId ?? "loading"} {...props} />;
}

function initialTarget(animalId?: string | null, lotId?: string | null): SanitaryNeedsTargetV2 {
  return { animalId: animalId ?? "", lotId: animalId ? "" : lotId ?? "" };
}

function ContextualNeeds(props: Props) {
  const { source, initialAnimalId, initialLotId, onTargetChange } = props;
  const [mode, setMode] = useState<Mode>("needs");
  const [target, setTarget] = useState(() => initialTarget(initialAnimalId, initialLotId));
  const [evaluatedAt, setEvaluatedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  useEffect(() => {
    setTarget(initialTarget(initialAnimalId, initialLotId));
    setSelectedItem(null);
  }, [initialAnimalId, initialLotId]);
  const rows = useMemo(() => source ? buildSanitaryContextualNeedsV2({ source, evaluatedAt, ...target }) : [], [source, evaluatedAt, target]);
  const groups = useMemo(() => Array.from(new Map(rows.map(row => [row.itemId, {
    itemId: row.itemId, protocolId: row.protocolId, protocolLabel: row.protocolLabel, itemLabel: row.itemLabel,
  }])).values()).map(group => ({ ...group, rows: rows.filter(row => row.itemId === group.itemId) })), [rows]);
  const changeTarget = (animalId: string, lotId: string) => {
    setTarget({ animalId, lotId }); setSelectedItem(null);
    onTargetChange?.(animalId || null, lotId || null);
  };
  const changeMode = (value: Mode) => { setMode(value); setSelectedItem(null); };
  if (!source) return <p role="status">Carregando catálogo, rebanho e histórico sanitário local...</p>;
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2" aria-label="Entrada das janelas sanitárias">
      {modes.map(entry => <Button key={entry.value} type="button" variant={mode === entry.value ? "default" : "outline"} aria-pressed={mode === entry.value} onClick={() => changeMode(entry.value)}>{entry.label}</Button>)}
    </div>
    <ConnectionStatus />
    <NeedsJourney props={props} mode={mode} target={target} evaluatedAt={evaluatedAt} selected={groups.find(group => group.itemId === selectedItem)} onBack={() => setSelectedItem(null)}>
      <SanitaryNeedsDiscoveryV2 source={source} target={target} evaluatedAt={evaluatedAt} groups={groups} initialLotContextId={props.initialLotContextId}
        onTargetChange={changeTarget} onDateChange={setEvaluatedAt} onChooseItem={setSelectedItem} onClearInitialFilter={props.onClearInitialFilter} />
    </NeedsJourney>
  </div>;
}

function NeedsJourney({ props, mode, target, evaluatedAt, selected, onBack, children }: {
  props: Props; mode: Mode; target: SanitaryNeedsTargetV2; evaluatedAt: string;
  selected?: SanitaryNeedGroupV2; onBack: () => void; children: ReactNode;
}) {
  const panelProps = { ...props, initialAnimalId: target.animalId || null, initialLotId: target.lotId || null };
  if (mode === "technical") return <SanitaryProtocolWindowPanelV2 {...panelProps} />;
  if (!selected) return children;
  return <>
    <Button type="button" variant="outline" onClick={onBack}>Voltar às necessidades</Button>
    <h3 className="font-semibold">{selected.protocolLabel} · {selected.itemLabel}</h3>
    <SanitaryProtocolWindowPanelV2 {...panelProps} key={selected.itemId} initialProtocolId={selected.protocolId} initialItemId={selected.itemId} initialEvaluatedAt={evaluatedAt} contextual />
  </>;
}

function subscribeToConnection(notify: () => void) {
  const events = ["online", "offline"];
  events.forEach(event => window.addEventListener(event, notify));
  return () => events.forEach(event => window.removeEventListener(event, notify));
}
const connectionSnapshot = () => navigator.onLine;

function ConnectionStatus() {
  const online = useSyncExternalStore(subscribeToConnection, connectionSnapshot);
  return <p role="status" className="text-sm text-muted-foreground">{online ? "Consulta pelos dados disponíveis neste dispositivo." : "Offline: consulta local disponível; dados podem estar desatualizados."} Conexão disponível não confirma sincronização.</p>;
}
