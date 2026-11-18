import type { SanitaryProtocolWindowSourceV2 } from "@/lib/sanitario/windows/sanitaryProtocolWindowsV2";
import type { SanitaryTriageResultV2 } from "@/lib/sanitario/triage/sanitaryTriageV2";
import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/offline/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatSanitaryProtocolItemLabelV2 } from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";
import { SANITARY_PROTOCOL_PACKAGES, countProtocolStageAnimalsV1, defaultProtocolFamiliesV1, isProtocolMonitoringEnabledV1, readProtocolAdoptionV1 } from "@/lib/sanitario/adoption/protocolAdoptionV1";
import { saveProtocolAdoptionV1 } from "@/lib/sanitario/adoption/saveProtocolAdoptionV1";

type Props = {
  source: SanitaryProtocolWindowSourceV2;
  result: SanitaryTriageResultV2 | null;
  canManage: boolean;
  onOpenAgenda: () => void;
  onOpenTriage: (protocolId?: string, itemId?: string) => void;
};

export function SanitaryFarmProtocolsV1(props: Props) {
  return <FarmProtocols key={props.source.fazendaId ?? "no-farm"} {...props} />;
}

function FarmProtocols({ source, result, canManage, onOpenAgenda, onOpenTriage }: Props) {
  const farmId = source.fazendaId ?? "";
  const confirmed = readProtocolAdoptionV1(source.farmConfig, farmId);
  const revision = confirmed?.revision ?? 0;
  const [draft, setDraft] = useState(() => ({
    revision,
    families: structuredClone(confirmed?.families ?? defaultProtocolFamiliesV1()),
  }));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submittedRevision, setSubmittedRevision] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const operations = useLiveQuery(async () => {
    return db.queue_ops.filter(op => op.record?.fazenda_id === farmId && op.record?.domain === "sanitary_protocol_adoption_v1").toArray();
  }, [farmId]);
  const pending = operations?.some(op => op.sync_state !== "REJECTED") ?? false;
  const rejected = operations?.find(op => op.sync_state === "REJECTED" && Number(op.record?.expected_revision) >= revision);
  const conflict = rejected?.blocked_reason === "PROTOCOL_ADOPTION_STALE_REVISION";
  const stale = revision !== draft.revision;
  const waiting = pending || (submittedRevision !== null && submittedRevision === revision && !rejected);

  async function save() {
    if (!canManage || !farmId || operations === undefined || saving || waiting || stale || Boolean(rejected)) return;
    setSaving(true);
    setError(null);
    try {
      await saveProtocolAdoptionV1(farmId, draft.revision, structuredClone(draft.families));
      if (alive.current) { setSubmittedRevision(draft.revision); setDirty(false); }
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error && cause.message === "PROTOCOL_ADOPTION_STALE_REVISION"
        ? "Conflito de revisão. Recarregue a configuração antes de salvar novamente."
        : "Não foi possível salvar os protocolos. Recarregue a configuração e tente novamente.");
    } finally {
      if (alive.current) setSaving(false);
    }
  }

  function reload() {
    setDraft({ revision, families: structuredClone(confirmed?.families ?? defaultProtocolFamiliesV1()) });
    setDirty(false);
    setSubmittedRevision(null);
    setError(null);
  }

  return <div className="space-y-4">
    <div className="space-y-1">
      <h2 className="text-lg font-semibold">Protocolos da Fazenda</h2>
      <p className="text-sm text-muted-foreground">Configure o monitoramento. As etapas e os contadores usam o catálogo e a Triagem da fazenda.</p>
      {!confirmed && <p className="text-sm text-muted-foreground">Ainda não configurada: a consulta legada permanece ativa. A primeira gravação inicia os protocolos exibidos, com pré-confinamento desligado.</p>}
      <p className="text-sm text-muted-foreground">Os switches editam um rascunho. Os contadores só mudam após confirmação da sincronização.</p>
    </div>
    {waiting && <p role="status" className="text-sm">Aguardando sincronização. O monitoramento confirmado permanece em vigor.</p>}
    {(stale || conflict) && <p role="alert" className="text-sm text-destructive">{conflict ? "Conflito de revisão." : "A configuração confirmada mudou."} Recarregue a configuração e revise suas escolhas antes de salvar.</p>}
    {rejected && !conflict && <p role="alert" className="text-sm text-destructive">A alteração foi rejeitada. O monitoramento confirmado permanece em vigor. Revise a pendência de sincronização antes de tentar novamente.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Tabs defaultValue="legal">
      <TabsList className="h-auto w-full flex-wrap justify-start" aria-label="Pacotes de protocolos">
        {SANITARY_PROTOCOL_PACKAGES.map(pack => <TabsTrigger key={pack.id} value={pack.id}>{pack.label}</TabsTrigger>)}
      </TabsList>
      {SANITARY_PROTOCOL_PACKAGES.map(pack => <TabsContent key={pack.id} value={pack.id} className="space-y-3">
        {pack.families.map(family => {
          const protocols = source.catalog.protocols.filter(protocol => protocol.familyCode === family.code);
          const ids = new Set(protocols.map(protocol => protocol.id));
          const items = source.catalog.items.filter(item => ids.has(item.protocolId));
          const enabled = isProtocolMonitoringEnabledV1(source.farmConfig, farmId, family.code);
          const aftosa = family.code === "febre_aftosa";
          const agendas = source.agendas.filter(agenda => agenda.fazenda_id === farmId && agenda.status === "programada" && agenda.protocolo_id && ids.has(agenda.protocolo_id));
          return <section key={family.code} aria-label={family.label} className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2"><h3 className="font-medium">{family.label}</h3><Badge variant="secondary">{family.badge}</Badge></div>
              {!aftosa && <label className="flex items-center gap-2 text-sm">
                <span>Monitorar</span>
                <Switch aria-label={`Monitorar ${family.label}`} checked={draft.families[family.code]?.monitoringEnabled ?? false}
                  disabled={!canManage || !farmId || saving || waiting || stale || Boolean(rejected)}
                  onCheckedChange={checked => { setDraft(current => ({ ...current, families: { ...current.families, [family.code]: { monitoringEnabled: checked } } })); setDirty(true); }} />
              </label>}
            </div>
            <p className="text-xs text-muted-foreground">Monitoramento confirmado: {enabled ? "ON" : "OFF"}</p>
            {!enabled && agendas.length > 0 && <div className="text-sm"><p>{agendas.length} Agenda(s) programada(s) preservada(s). Desligar o monitoramento não cancela Agendas.</p><Button variant="link" className="h-auto px-0" onClick={onOpenAgenda}>Abrir Agendas</Button></div>}
            {items.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma etapa disponível no catálogo local.</p>}
            <ul className="space-y-3">
              {items.map(item => {
                const protocol = protocols.find(candidate => candidate.id === item.protocolId);
                const unavailable = aftosa || protocol?.status === "retired" || protocol?.legalStatus === "bloqueado" || item.itemStatus === "bloqueado" || item.status === "retired" || item.status === "blocked";
                const counts = countProtocolStageAnimalsV1(result?.evaluations.filter(row => row.protocolId === item.protocolId && row.itemId === item.id) ?? []);
                return <li key={item.id} className="border-t pt-3 text-sm space-y-1">
                  <div className="flex flex-wrap items-center gap-2"><span>{formatSanitaryProtocolItemLabelV2(item)}</span>{unavailable && <Badge variant="outline">Indisponível{item.status === "retired" ? " · retirado" : ""}</Badge>}</div>
                  <p className="text-xs text-muted-foreground">Versão {item.version}</p>
                  {enabled && !unavailable && (result ? <>
                    <p>{counts.eligible} elegíveis · {counts.future} futuros · {counts.overdue} atrasados · {counts.insufficient} dados insuficientes</p>
                    <p className="text-muted-foreground">{counts.completed} concluídos · {counts.restricted} restritos · {counts.scheduled} agendados</p>
                    <Button variant="link" className="h-auto px-0" onClick={() => onOpenTriage(item.protocolId, item.id)} aria-label={`Abrir lista de ${family.label} — ${formatSanitaryProtocolItemLabelV2(item)}`}>Abrir lista na Triagem</Button>
                  </> : <p className="text-muted-foreground">Aguardando avaliação da Triagem.</p>)}
                </li>;
              })}
            </ul>
          </section>;
        })}
      </TabsContent>)}
    </Tabs>
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={() => void save()} disabled={!canManage || !farmId || operations === undefined || saving || waiting || stale || Boolean(rejected) || (Boolean(confirmed) && !dirty)}>Salvar protocolos</Button>
      {(stale || conflict || error) && <Button variant="outline" onClick={reload} disabled={saving || pending}>Recarregar configuração</Button>}
      {!canManage && <p className="text-sm text-muted-foreground">Somente gestores podem alterar o monitoramento.</p>}
    </div>
  </div>;
}
