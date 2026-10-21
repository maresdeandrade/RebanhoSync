import { useMemo, useState } from "react";
import { assessSanitaryAutomationReadinessV2 } from "@/lib/sanitario/agenda/sanitaryAutomationReadinessV2";
import { formatSanitaryProtocolItemLabelV2 } from "@/lib/sanitario/catalog/sanitaryProtocolCatalogV2";
import { buildSanitaryProtocolWindowV2, type SanitaryProtocolWindowSourceV2 } from "@/lib/sanitario/windows/sanitaryProtocolWindowsV2";
import type { SanitaryAutomationDraftV2 } from "@/lib/sanitario/agenda/sanitaryAutomationPlanV2";

const labels = {
  BLOQUEIO_TECNICO_ESPECIFICO: "Bloqueio técnico específico",
  SUGESTAO_CONDICIONAL: "Sugestão condicional — automação restrita",
  AGUARDANDO_APROVACAO_VERSIONADA: "Aguardando aprovação versionada",
  AUTOMACAO_AUTORIZADA: "Automação autorizada na versão",
};

function coverageContext(draft: SanitaryAutomationDraftV2, itemId: string) {
  return draft.ruleContexts?.[itemId] ?? draft.context;
}

function coverageRow(source: SanitaryProtocolWindowSourceV2,
  item: SanitaryProtocolWindowSourceV2["catalog"]["items"][number],
  { draft, date }: { draft: SanitaryAutomationDraftV2; date: string }) {
  const protocol = source.catalog.protocols.find((entry) => entry.id === item.protocolId);
  if (!protocol) return [];
  const readiness = assessSanitaryAutomationReadinessV2(protocol, item);
  const window = buildSanitaryProtocolWindowV2({ source, protocolId: protocol.id, itemId: item.id, evaluatedAt: date,
    operationalContext: coverageContext(draft, item.id), generationMode: "automatic" });
  return [{ item, protocol, readiness, animals: window?.rows ?? [] }];
}

export function SanitaryAutomationCoveragePanelV2({ source, draft, date }: {
  source: SanitaryProtocolWindowSourceV2 | undefined; draft: SanitaryAutomationDraftV2; date: string;
}) {
  const [open, setOpen] = useState(false);
  const rows = useMemo(() => {
    if (!open || !source) return [];
    return source.catalog.items.flatMap((item) => coverageRow(source, item, { draft, date }));
  }, [source, draft, date, open]);
  return <details onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>Cobertura, sugestões e restrições de todos os itens</summary>
    <p className="text-sm text-muted-foreground">Regra normalizada e candidato técnico não equivalem a automação autorizada.</p>
    <ul className="space-y-3 pt-2 text-sm">
      {rows.map(({ item, protocol, readiness, animals }) => <li key={item.id}>
        <strong>{protocol.name} — {formatSanitaryProtocolItemLabelV2(item.logicalItemKey)} (v{item.version})</strong>
        <p>{labels[readiness.classification]}</p>
        <p>{[...readiness.conditions, ...readiness.blockers, ...readiness.sourceGaps].join(" ")}</p>
        <details><summary>Animais e motivos ({animals.length})</summary>
          <ul>{animals.map((animal) => <li key={animal.animalId}>{animal.identification}: {animal.reason} {animal.blockers.join(" ")}</li>)}</ul>
        </details>
      </li>)}
    </ul>
  </details>;
}
