import { pullDataForFarm } from "@/lib/offline/pull";
import type { SanitarioTipoEnum } from "@/lib/offline/types";
import {
  concluirPendenciaSanitaria,
  type ConcluirPendenciaSanitariaInput,
} from "@/lib/sanitario/infrastructure/service";

const SANITARY_COMPLETION_REFRESH_TABLES = [
  "agenda_itens",
  "eventos",
  "eventos_sanitario",
];

export type CompleteSanitaryAgendaWithEventFn = (
  input: ConcluirPendenciaSanitariaInput,
) => Promise<string>;

export type RefreshSanitaryExecutionStateFn = (
  fazendaId: string,
  tables: string[],
) => Promise<unknown>;

export type SanitaryExecutionBoundaryResult =
  | { status: "skip" }
  | { status: "handled"; eventoId: string }
  | { status: "handled_refresh_failed"; eventoId: string; error: unknown }
  | { status: "ambiguous"; error: unknown }
  | { status: "fallback"; error: unknown }
  | { status: "error"; error: unknown; message: string };

export type ExecuteSanitaryCompletionInput = {
  tipoManejo: string;
  sourceTaskId: string;
  fazendaId: string;
  occurredAt: string;
  tipo: SanitarioTipoEnum;
  sanitaryProductName: string;
  sanitaryProductMetadata: Record<string, unknown>;
  completeAgendaWithEvent?: CompleteSanitaryAgendaWithEventFn;
  refreshStateAfterCompletion?: RefreshSanitaryExecutionStateFn;
  shouldFallbackOnError?: (error: unknown) => boolean;
  onFallbackLog?: (error: unknown) => void;
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export function isLikelyCommittedTimeout(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();

  return (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("aborted") ||
    message.includes("network") ||
    message.includes("failed to fetch") ||
    message.includes("load failed")
  );
}

export async function executeSanitaryCompletion(
  input: ExecuteSanitaryCompletionInput,
): Promise<SanitaryExecutionBoundaryResult> {
  if (input.tipoManejo !== "sanitario" || !input.sourceTaskId) {
    return { status: "skip" };
  }

  const completeAgendaWithEvent =
    input.completeAgendaWithEvent ?? concluirPendenciaSanitaria;
  const refreshStateAfterCompletion =
    input.refreshStateAfterCompletion ?? pullDataForFarm;

  try {
    const eventoId = await completeAgendaWithEvent({
      agendaItemId: input.sourceTaskId,
      occurredAt: input.occurredAt,
      tipo: input.tipo,
      produto: input.sanitaryProductName,
      payload: {
        origem: "registrar_manejo",
        ...input.sanitaryProductMetadata,
      },
    });

    try {
      await refreshStateAfterCompletion(
        input.fazendaId,
        SANITARY_COMPLETION_REFRESH_TABLES,
      );

      return {
        status: "handled",
        eventoId,
      };
    } catch (refreshError) {
      return {
        status: "handled_refresh_failed",
        eventoId,
        error: refreshError,
      };
    }
  } catch (error) {
    if (isLikelyCommittedTimeout(error)) {
      return {
        status: "ambiguous",
        error,
      };
    }

    const shouldFallback = input.shouldFallbackOnError?.(error) ?? true;

    if (!shouldFallback) {
      return {
        status: "error",
        error,
        message: getErrorMessage(error),
      };
    }

    input.onFallbackLog?.(error);

    return {
      status: "fallback",
      error,
    };
  }
}
