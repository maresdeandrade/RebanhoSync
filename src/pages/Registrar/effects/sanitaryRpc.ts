import { pullDataForFarm } from "@/lib/offline/pull";
import { concluirPendenciaSanitaria } from "@/lib/sanitario/service";
import type { SanitarioTipoEnum } from "@/lib/offline/types";

type ConcluirPendenciaSanitariaFn = typeof concluirPendenciaSanitaria;
type PullDataForFarmFn = typeof pullDataForFarm;

export async function tryRegistrarSanitaryRpcFinalizeEffect(input: {
  tipoManejo: string;
  sourceTaskId: string;
  fazendaId: string;
  occurredAt: string;
  tipo: SanitarioTipoEnum;
  sanitaryProductName: string;
  sanitaryProductMetadata: Record<string, unknown>;
  concluirPendenciaSanitariaFn?: ConcluirPendenciaSanitariaFn;
  pullDataForFarmFn?: PullDataForFarmFn;
  onFallbackLog?: (error: unknown) => void;
}): Promise<
  | { status: "skip" }
  | { status: "handled"; eventoId: string }
  | { status: "fallback"; error: unknown }
> {
  if (input.tipoManejo !== "sanitario" || !input.sourceTaskId) {
    return { status: "skip" };
  }

  const concluirFn =
    input.concluirPendenciaSanitariaFn ?? concluirPendenciaSanitaria;
  const pullFn = input.pullDataForFarmFn ?? pullDataForFarm;

  try {
    const eventoId = await concluirFn({
      agendaItemId: input.sourceTaskId,
      occurredAt: input.occurredAt,
      tipo: input.tipo,
      produto: input.sanitaryProductName,
      payload: {
        origem: "registrar_manejo",
        ...input.sanitaryProductMetadata,
      },
    });

    await pullFn(input.fazendaId, ["agenda_itens", "eventos", "eventos_sanitario"]);

    return {
      status: "handled",
      eventoId,
    };
  } catch (error) {
    if (input.onFallbackLog) {
      input.onFallbackLog(error);
    } else {
      console.warn(
        "[registrar] rpc sanitario falhou, fallback para fluxo offline",
        error,
      );
    }
    return {
      status: "fallback",
      error,
    };
  }
}
