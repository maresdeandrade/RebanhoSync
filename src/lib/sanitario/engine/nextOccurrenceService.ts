/**
 * Próxima Ocorrência — Serviço de Integração
 * Usa novo scheduler com feature flag (fallback para adapter interno)
 * Ready para uso em componentes e serviços
 */

import type { ProtocoloSanitarioItem, Animal } from "@/lib/offline/types";
import {
  tryComputeNextSanitaryOccurrence,
  isProtocolItemCompatibleWithNewScheduler,
  type ComputeNextOccurrenceContext,
  type NextSanitaryOccurrenceComputed,
} from "@/lib/sanitario/engine/schedulerIntegration";
import { shouldUseNewSanitaryScheduler } from "@/lib/sanitario/engine/featureFlags";
import {
  parseLegacyProtocolItemToDomain,
} from "@/lib/sanitario/models/adapters";
import {
  computeNextSanitaryOccurrence,
} from "@/lib/sanitario/engine/scheduler";
import type {
  SanitarySubjectContext,
  SanitaryExecutionRecord,
  SchedulerNowContext,
} from "@/lib/sanitario/models/domain";

/**
 * Output compatível com chamadas externas ao serviço legado
 */
export interface LegacyScheduleResult {
  materialize: boolean;
  dueDate: string | null;
  availableAt: string | null;
  dedupKey: string | null;
  reasonCode: string;
  reasonMessage: string;
  actionable: boolean;
  complianceLevel: string;
  blockedBy: string | null;
}

/**
 * Adapter interno para chamar scheduler novo com input legado
 * Este é o contrato mínimo do fallback - não altera regra sanitária
 */
function tryLegacyCompatibleCompute(
  protocolItem: ProtocoloSanitarioItem,
  context: ComputeNextOccurrenceContext,
): LegacyScheduleResult | null {
  if (!context.fazendaId) {
    return null;
  }

  const now = context.now ?? new Date();
  const animalId = context.animal?.id ?? context.animalId ?? "unknown";
  const protocolId =
    (protocolItem as Partial<ProtocoloSanitarioItem> & { protocol_id?: string })
      .protocolo_id ??
    (protocolItem as Partial<ProtocoloSanitarioItem> & { protocol_id?: string })
      .protocol_id ??
    "unknown_protocol";
  const itemId =
    protocolItem.item_code ??
    protocolItem.logical_item_key ??
    protocolItem.id ??
    "unknown_item";

  const domain = parseLegacyProtocolItemToDomain(protocolId, itemId, protocolItem.payload);
  if (!domain) {
    return null;
  }

  const subject: SanitarySubjectContext = {
    scopeType: "animal",
    scopeId: animalId,
    animal: context.animal
      ? {
          id: context.animal.id,
          birthDate: context.animal.data_nascimento,
          sex: context.animal.sexo === "M" ? "macho" : "femea",
          species: "bovino",
          categoryCode: context.animal.categoria_zootecnica ?? null,
        }
      : null,
    fazenda: {
      id: context.fazendaId,
      uf: null,
      municipio: null,
    },
    activeRisks: [],
    activeEvents: [],
  };

  const input = {
    item: domain,
    subject,
    history: [] as SanitaryExecutionRecord[],
    now: {
      nowIso: now.toISOString().split("T")[0] ?? now.toISOString(),
      timezone: "America/Sao_Paulo",
    } as SchedulerNowContext,
  };

  const result = computeNextSanitaryOccurrence(input);

  return {
    materialize: result.materialize,
    dueDate: result.dueDate,
    availableAt: result.availableAt,
    dedupKey: result.dedupKey,
    reasonCode: result.reasonCode,
    reasonMessage: result.reasonMessage,
    actionable: result.actionable,
    complianceLevel: result.complianceLevel,
    blockedBy: result.blockedBy,
  };
}

/**
 * Wrapper unificado para computar próxima ocorrência
 * Tenta novo scheduler (com feature flag), fallback para adapter interno
 */
export function computeNextOccurrence(
  protocolItem: ProtocoloSanitarioItem,
  context: ComputeNextOccurrenceContext,
): NextSanitaryOccurrenceComputed | LegacyScheduleResult | null {
  // Tentar novo scheduler (se feature flag ativado)
  if (shouldUseNewSanitaryScheduler()) {
    const newSchedulerResult = tryComputeNextSanitaryOccurrence(
      protocolItem,
      context,
    );

    // Se novo scheduler executou com sucesso, retornar resultado
    if (newSchedulerResult !== null) {
      return newSchedulerResult;
    }
  }

  // Fallback interno: usar adapter compatível
  const animalId = "animalId" in context ? context.animalId : context.animal?.id;
  if (!animalId) {
    return null;
  }

  try {
    const legacyResult = tryLegacyCompatibleCompute(protocolItem, context);
    return legacyResult;
  } catch (e: unknown) {
    console.warn(
      "Legacy fallback error for item:",
      protocolItem.id,
      "animal:",
      animalId,
      e,
    );
    return null;
  }
}

/**
 * Batch compute próximas ocorrências para múltiplos items
 * Útil para agendamento em bulk
 */
export function computeNextOccurrencesForAnimal(
  protocolItems: ProtocoloSanitarioItem[],
  animal: Animal,
  context?: Partial<ComputeNextOccurrenceContext>,
): Array<{
  item: ProtocoloSanitarioItem;
  result: NextSanitaryOccurrenceComputed | LegacyScheduleResult | null;
}> {
  const now = context?.now ?? new Date();
  const fullContext: ComputeNextOccurrenceContext = {
    fazendaId: context?.fazendaId ?? "unknown",
    animal,
    now,
    ...context,
  };

  return protocolItems.map((item) => ({
    item,
    result: computeNextOccurrence(item, fullContext),
  }));
}

/**
 * Validar compatibilidade de protocol item com novo scheduler
 */
export function isItemCompatibleWithNewScheduler(
  item: ProtocoloSanitarioItem,
): boolean {
  // Se feature flag está desativado, não executar validação
  if (!shouldUseNewSanitaryScheduler()) {
    return false;
  }

  return isProtocolItemCompatibleWithNewScheduler(item);
}

/**
 * Status de Health Check — Novo Scheduler
 */
export interface SchedulerHealthStatus {
  featureFlagEnabled: boolean;
  newSchedulerReady: boolean;
  lastCheckedAt: Date;
}

export function getSchedulerHealthStatus(): SchedulerHealthStatus {
  return {
    featureFlagEnabled: shouldUseNewSanitaryScheduler(),
    newSchedulerReady: true, // Sempre true se feature flag foi criado
    lastCheckedAt: new Date(),
  };
}

/**
 * Metadados de integração para observability e debugging
 */
export interface NextOccurrenceMetadata {
  sourceScheduler: "new" | "legacy";
  computedAt: Date;
  context: ComputeNextOccurrenceContext;
  item: ProtocoloSanitarioItem;
  result: NextSanitaryOccurrenceComputed | LegacyScheduleResult | null;
  error?: string;
}

export function computeWithMetadata(
  item: ProtocoloSanitarioItem,
  context: ComputeNextOccurrenceContext,
): NextOccurrenceMetadata {
  const featureFlagEnabled = shouldUseNewSanitaryScheduler();

  if (featureFlagEnabled) {
    const newResult = tryComputeNextSanitaryOccurrence(item, context);
    if (newResult !== null) {
      return {
        sourceScheduler: "new",
        computedAt: new Date(),
        context,
        item,
        result: newResult,
      };
    }
  }

  // Fallback interno
  const result = computeNextOccurrence(item, context);

  return {
    sourceScheduler: result === null ? "legacy" : "legacy",
    computedAt: new Date(),
    context,
    item,
    result: result,
    error: result === null ? "No valid result computed" : undefined,
  };
}

/**
 * Diagnóstico — Qual scheduler foi usado e porquê
 */
export function diagnosticWhichSchedulerWasUsed(
  item: ProtocoloSanitarioItem,
  context: ComputeNextOccurrenceContext,
  result: NextOccurrenceMetadata,
): string {
  const lines: string[] = [];

  lines.push(`◆ Diagnostic Report`);
  lines.push(`  Clock: ${result.computedAt.toISOString()}`);
  lines.push(`  Scheduler: ${result.sourceScheduler.toUpperCase()}`);

  if (result.sourceScheduler === "new") {
    lines.push(
      `  Mode: Feature flag enabled, new scheduler used successfully`,
    );
  } else {
    lines.push(`  Mode: Legacy scheduler (feature flag disabled or new failed)`);
    if (result.error) {
      lines.push(`  Error: ${result.error}`);
    }
  }

  lines.push(`  Item: ${item.id}`);
  lines.push(
    `  Result: ${result.result ? "Computed successfully" : "NULL (no occurrence)"}`,
  );

  return lines.join("\n");
}
