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

    await refreshStateAfterCompletion(
      input.fazendaId,
      SANITARY_COMPLETION_REFRESH_TABLES,
    );

    return {
      status: "handled",
      eventoId,
    };
  } catch (error) {
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
