import type { SanitarioTipoEnum } from "@/lib/offline/types";
import {
  executeSanitaryCompletion,
  type CompleteSanitaryAgendaWithEventFn,
  type RefreshSanitaryExecutionStateFn,
} from "@/lib/sanitario/infrastructure/executionBoundary";

export async function tryRegistrarSanitaryRpcFinalizeEffect(input: {
  tipoManejo: string;
  sourceTaskId: string;
  fazendaId: string;
  occurredAt: string;
  tipo: SanitarioTipoEnum;
  sanitaryProductName: string;
  sanitaryProductMetadata: Record<string, unknown>;
  concluirPendenciaSanitariaFn?: CompleteSanitaryAgendaWithEventFn;
  pullDataForFarmFn?: RefreshSanitaryExecutionStateFn;
  onFallbackLog?: (error: unknown) => void;
}): Promise<
  | { status: "skip" }
  | { status: "handled"; eventoId: string }
  | { status: "fallback"; error: unknown }
> {
  const result = await executeSanitaryCompletion({
    ...input,
    completeAgendaWithEvent: input.concluirPendenciaSanitariaFn,
    refreshStateAfterCompletion: input.pullDataForFarmFn,
    onFallbackLog:
      input.onFallbackLog ??
      ((error) => {
        console.warn(
          "[registrar] rpc sanitario falhou, fallback para fluxo offline",
          error,
        );
      }),
  });

  if (result.status === "error") {
    return {
      status: "fallback",
      error: result.error,
    };
  }

  return result;
}
