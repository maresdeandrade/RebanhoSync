/**
 * Integração — Novo Scheduler no Fluxo de Leitura
 *
 * Wrapper que conecta computeNextSanitaryOccurrence ao fluxo existente.
 * Usado em regulatoryReadModel e componentes que leem agenda.
 */

import type { AgendaItem, ProtocoloSanitarioItem, Animal } from "@/lib/offline/types";
import {
  computeNextSanitaryOccurrence,
  type ComputeNextSanitaryOccurrenceInput,
  type ComputeNextSanitaryOccurrenceResult,
} from "@/lib/sanitario/scheduler";
import {
  parseLegacyProtocolItemToDomain,
  type SanitaryProtocolItemDomain,
} from "@/lib/sanitario/domain";
import { shouldUseNewSanitaryScheduler } from "@/lib/sanitario/featureFlags";

/**
 * Contexto de Subject para próximo cálculo de ocorrência
 *
 * Usado para passar informações do animal/lote ao scheduler.
 */
export interface ComputeNextOccurrenceContext {
  animal?: Animal | null;
  animalId?: string;
  loteId?: string;
  fazendaId: string;
  now?: Date;
}

/**
 * Resultado estruturado de computação de próxima ocorrência
 */
export interface NextSanitaryOccurrenceComputed {
  materialize: boolean;
  dueDate: string | null;
  availableAt: string | null;
  dedupKey: string | null;
  reasonCode: string;
  reasonMessage: string;
  actionable: boolean;
  blockedBy: string | null;
}

/**
 * Computa próxima ocorrência de protocolo usando novo scheduler
 *
 * @param protocolItem - Item de protocolo legado
 * @param context - Contexto de subject (animal, lote, fazenda)
 * @param history - Histórico de executados (eventos)
 * @returns Próxima ocorrência ou null se erro
 */
export function computeNextSanitaryOccurrenceForItem(
  protocolItem: ProtocoloSanitarioItem,
  context: ComputeNextOccurrenceContext,
  history: unknown[] = [], // SanitaryExecutionRecord[]
): NextSanitaryOccurrenceComputed | null {
  // Feature flag: não usar novo scheduler se desabilitado
  if (!shouldUseNewSanitaryScheduler()) {
    return null;
  }

  try {
    // 1. Parsear item legado para domínio novo
    const domain = parseLegacyProtocolItemToDomain(protocolItem.payload);
    if (!domain) {
      console.warn("Failed to parse protocol item to domain", protocolItem.id);
      return null;
    }

    // 2. Construir input para scheduler
    const now = context.now || new Date();
    const input: ComputeNextSanitaryOccurrenceInput = {
      item: domain,
      subject: {
        animalId: context.animalId,
        loteId: context.loteId,
        fazendaId: context.fazendaId,
        animal: context.animal || undefined,
      },
      history: history, // Pode ser vazio em primeira execução
      now: {
        date: now.toISOString().split("T")[0],
        timestamp: now.getTime(),
      },
    };

    // 3. Chamar novo scheduler
    const result = computeNextSanitaryOccurrence(input);

    // 4. Mapear resultado para estrutura consolidada
    return {
      materialize: result.materialize,
      dueDate: result.dueDate,
      availableAt: result.availableAt,
      dedupKey: result.dedupKey,
      reasonCode: result.reasonCode,
      reasonMessage: result.reasonMessage,
      actionable: result.actionable,
      blockedBy: result.blockedBy,
    };
  } catch (error) {
    console.error("Error computing next occurrence:", error);
    return null;
  }
}

/**
 * Wrapper para uso em read models
 *
 * Retorna null se feature flag está off, permitindo fallback para legacy.
 */
export function tryComputeNextSanitaryOccurrence(
  protocolItem: ProtocoloSanitarioItem,
  context: ComputeNextOccurrenceContext,
  history?: unknown[],
): NextSanitaryOccurrenceComputed | null {
  if (!shouldUseNewSanitaryScheduler()) {
    return null; // Fallback para legacy calendarEngine
  }

  return computeNextSanitaryOccurrenceForItem(protocolItem, context, history);
}

/**
 * Valida se domínio é "bem-formado" para novo scheduler
 *
 * Útil para logs e debug.
 */
export function isProtocolItemCompatibleWithNewScheduler(
  protocolItem: ProtocoloSanitarioItem
): boolean {
  try {
    const domain = parseLegacyProtocolItemToDomain(protocolItem.payload);
    return domain !== null;
  } catch {
    return false;
  }
}
