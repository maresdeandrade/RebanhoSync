import { describe, expect, it } from "vitest";

import { createRegistrarFinalizeController } from "@/pages/Registrar/createRegistrarFinalizeController";
import {
  createBaseFinalizeDeps,
  createBaseFinalizeInput,
} from "./finalizeFlowTestUtils";

describe("flow: agenda falha de evento", () => {
  it("abortar finalização se planejamento de evento falhar e manter agenda aberta", async () => {
    const deps = createBaseFinalizeDeps();

    // Simula falha/impedimento no plano não financeiro (ex: compliance, erro de validação)
    deps.tracks.resolveNonFinancialFinalizePlan = deps.tracks.resolveNonFinancialFinalizePlan.mockResolvedValue({
      issue: "Animal bloqueado por carência ativa",
      linkedEventId: null,
      postPartoRedirect: null,
      ops: [],
    });

    const finalize = createRegistrarFinalizeController(deps);

    const input = createBaseFinalizeInput({
      context: {
        ...createBaseFinalizeInput().context,
        tipoManejo: "sanitario",
        sourceTaskId: "agenda-san-error",
      },
    });

    await finalize(input);

    // Deve mostrar o erro do plano
    expect(deps.feedback.showError).toHaveBeenCalledWith("Animal bloqueado por carência ativa");

    // NÃO deve tentar construir a finalização da agenda nem commitar operações
    expect(deps.commit.buildAgendaCompletionOp).not.toHaveBeenCalled();
    expect(deps.commit.runFinalizeGesture).not.toHaveBeenCalled();

    // NÃO deve navegar
    expect(deps.feedback.navigate).not.toHaveBeenCalled();
  });
});
