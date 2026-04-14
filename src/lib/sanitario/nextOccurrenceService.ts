/**
 * Próxima Ocorrência — Serviço de Integração
 * Usa novo scheduler com feature flag (fallback para legado)
 * Ready para uso em componentes e serviços
 */

import type { ProtocoloSanitarioItem, Animal } from "@/lib/offline/types";
import {
  tryComputeNextSanitaryOccurrence,
  isProtocolItemCompatibleWithNewScheduler,
  type ComputeNextOccurrenceContext,
  type ComputedOccurrence,
} from "@/lib/sanitario/schedulerIntegration";
import { shouldUseNewSanitaryScheduler } from "@/lib/sanitario/featureFlags";
import {
  computeNextSanitaryOccurrence as legacyScheduler,
  type ScheduleResult,
} from "@/lib/sanitario/scheduler";

/**
 * Wrapper unificado para computar próxima ocorrência
 * Tenta novo scheduler (com feature flag), fallback para legado
 */
export function computeNextOccurrence(
  protocolItem: ProtocoloSanitarioItem,
  context: ComputeNextOccurrenceContext,
): ComputedOccurrence | ScheduleResult | null {
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

  // Fallback: tentar legado scheduler
  // (Legado espera estrutura diferente, adaptar conforme necessário)
  const animalId = "animalId" in context ? context.animalId : context.animal?.id;
  if (!animalId) {
    return null;
  }

  try {
    const legacyResult = legacyScheduler({
      item: protocolItem,
      animalId,
      asOfDate: context.now ?? new Date(),
    });

    return legacyResult;
  } catch (e: unknown) {
    // Log error (pode ser implementado com observability)
    console.warn(
      "Legacy scheduler error for item:",
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
  result: ComputedOccurrence | ScheduleResult | null;
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
  result: ComputedOccurrence | ScheduleResult | null;
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

  // Fallback
  const animalId = "animalId" in context ? context.animalId : context.animal?.id;
  try {
    const legacyResult = legacyScheduler({
      item,
      animalId: animalId ?? "unknown",
      asOfDate: context.now ?? new Date(),
    });

    return {
      sourceScheduler: "legacy",
      computedAt: new Date(),
      context,
      item,
      result: legacyResult,
    };
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    return {
      sourceScheduler: "legacy",
      computedAt: new Date(),
      context,
      item,
      result: null,
      error: errorMsg,
    };
  }
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
