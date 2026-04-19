import { describe, expect, it } from "vitest";

import { createRegistrarFinalizeController } from "@/pages/Registrar/createRegistrarFinalizeController";
import {
  createBaseFinalizeDeps,
  createBaseFinalizeInput,
} from "./finalizeFlowTestUtils";

describe("flow: registro financeiro completo", () => {
  it("executa trilho financeiro ate commit e navegacao", async () => {
    const deps = createBaseFinalizeDeps();
    deps.tracks.isFinancialFlow = deps.tracks.isFinancialFlow.mockReturnValue(true);

    const finalize = createRegistrarFinalizeController(deps);

    await finalize(
      createBaseFinalizeInput({
        context: {
          ...createBaseFinalizeInput().context,
          tipoManejo: "financeiro",
          sourceTaskId: "agenda-fin-1",
        },
        finance: {
          ...createBaseFinalizeInput().finance,
          data: {
            ...createBaseFinalizeInput().finance.data,
            natureza: "compra",
            modoPeso: "lote",
          },
          summary: {
            ...createBaseFinalizeInput().finance.summary,
            tipo: "compra",
            pesoLote: 1200,
            quantidadeAnimais: 3,
          },
        },
      }),
    );

    expect(deps.tracks.resolveFinancialFinalizePlan).toHaveBeenCalled();
    expect(deps.tracks.resolveNonFinancialFinalizePlan).not.toHaveBeenCalled();
    expect(deps.commit.runFinalizeGesture).toHaveBeenCalled();
    expect(deps.feedback.showSuccess).toHaveBeenCalledWith("registro concluido");
    expect(deps.feedback.navigate).toHaveBeenCalledWith("/agenda");
  });
});
