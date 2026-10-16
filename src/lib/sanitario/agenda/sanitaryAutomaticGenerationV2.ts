import {
  buildSanitaryProtocolWindowV2,
  createGroupedManualSanitaryAgendasV2,
  loadSanitaryProtocolWindowSourceV2,
  sanitaryPlanningApplicationExclusionV2,
  type SanitaryProtocolWindowSourceV2,
  type SanitaryProtocolWindowRowV2,
} from "../windows/sanitaryProtocolWindowsV2";
import {
  readSanitaryAutomationPlanV2,
  resolveSanitaryAutomationRuleV2,
  type SanitaryAutomationDraftV2,
  type SanitaryAutomationRuleV2,
} from "./sanitaryAutomationPlanV2";
import {
  sanitaryAutomaticIdentityV2,
  suppressedSanitaryAutomaticIntentV2,
} from "./sanitaryAutomaticIdentityV2";

export type SanitaryAutomaticPreviewEntryV2 = {
  animalId: string;
  animalLabel: string;
  itemId: string;
  eligible: boolean;
  reason: string;
  row?: SanitaryProtocolWindowRowV2;
};

function rowExclusion(
  source: SanitaryProtocolWindowSourceV2,
  row: SanitaryProtocolWindowRowV2,
  date: string,
  draft: SanitaryAutomationDraftV2,
) {
  const identity = sanitaryAutomaticIdentityV2(source, row, date);
  if (identity.completed) return "Etapa já comprovada por histórico factual.";
  if (suppressedSanitaryAutomaticIntentV2(source, row, identity.key))
    return "Intenção já gerada ou cancelamento explícito preservado.";
  if (row.alreadyPlanned)
    return "Agenda existente preservada, incluindo reagendamento.";
  if (!row.canSelect || row.status === "eligible_soon")
    return [...row.blockers, row.reason].join(" ");
  return sanitaryPlanningApplicationExclusionV2(
    source,
    row,
    date,
    draft.context,
  );
}

function previewRule(
  source: SanitaryProtocolWindowSourceV2,
  draft: SanitaryAutomationDraftV2,
  rule: SanitaryAutomationRuleV2,
  date: string,
): SanitaryAutomaticPreviewEntryV2[] {
  if (!resolveSanitaryAutomationRuleV2(source.catalog, rule)) {
    return source.animals
      .filter((animal) => animal.status === "ativo" && !animal.deleted_at)
      .map((animal) => ({
        animalId: animal.id,
        animalLabel: animal.identificacao,
        itemId: rule.itemId,
        eligible: false,
        reason: "Versão selecionada indisponível ou alterada. Revise o plano.",
      }));
  }
  const window = buildSanitaryProtocolWindowV2({
    source,
    protocolId: rule.protocolId,
    itemId: rule.itemId,
    evaluatedAt: date,
    operationalContext: draft.context,
    generationMode: "automatic",
  });
  return (window?.rows ?? []).map((row) => {
    const reason = rowExclusion(source, row, date, draft);
    return {
      animalId: row.animalId,
      animalLabel: row.identification,
      itemId: row.itemId,
      eligible: !reason,
      reason: reason ?? row.reason,
      row,
    };
  });
}

export function previewSanitaryAutomaticPlanV2(
  source: SanitaryProtocolWindowSourceV2,
  draft: SanitaryAutomationDraftV2,
  referenceDate: string,
) {
  const rules = [
    ...new Map(draft.rules.map((rule) => [rule.itemId, rule])).values(),
  ];
  const entries = rules.flatMap((rule) =>
    previewRule(source, draft, rule, referenceDate),
  );
  return {
    entries,
    toCreate: entries.filter((entry) => entry.eligible).length,
  };
}

export async function generateSanitaryAutomaticAgendasV2(input: {
  fazendaId: string;
  referenceDate: string;
  signal?: AbortSignal;
}) {
  const source = await loadSanitaryProtocolWindowSourceV2(input.fazendaId);
  const plan = readSanitaryAutomationPlanV2(source.farmConfig);
  if (!plan?.enabled)
    return { created: 0, failures: [] as string[], enabled: false };
  const preview = previewSanitaryAutomaticPlanV2(
    source,
    plan,
    input.referenceDate,
  );
  let created = 0;
  const failures: string[] = [];
  for (const rule of plan.rules) {
    if (input.signal?.aborted) break;
    const rows = preview.entries
      .filter((entry) => entry.itemId === rule.itemId && entry.eligible)
      .map((entry) => entry.row!);
    if (!rows.length) continue;
    try {
      const results = await createGroupedManualSanitaryAgendasV2({
        fazendaId: input.fazendaId,
        rows,
        plannedFor: input.referenceDate,
        planRevision: plan.revision,
      });
      created += results.filter((result) => result.created).length;
    } catch (error) {
      failures.push(
        error instanceof Error
          ? error.message
          : "Falha ao gerar intenções. Reavalie o plano.",
      );
    }
  }
  return { created, failures, enabled: true };
}
