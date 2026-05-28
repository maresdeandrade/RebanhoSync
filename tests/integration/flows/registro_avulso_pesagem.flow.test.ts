import { describe, expect, it } from "vitest";

import { createRegistrarFinalizeController } from "@/pages/Registrar/createRegistrarFinalizeController";
import {
  createBaseFinalizeDeps,
  createBaseFinalizeInput,
} from "./finalizeFlowTestUtils";

describe("flow: registro avulso de pesagem", () => {
  it("executa pesagem avulsa sem tentar fechar agenda e navega para home", async () => {
    const deps = createBaseFinalizeDeps();

    const finalize = createRegistrarFinalizeController(deps);

    const input = createBaseFinalizeInput({
      context: {
        ...createBaseFinalizeInput().context,
        tipoManejo: "pesagem",
        sourceTaskId: undefined, // Sem agenda vinculada
      },
      operationData: {
        ...createBaseFinalizeInput().operationData,
        pesagemData: { "animal-1": "450" },
      },
    });

    await finalize(input);

    // Deve chamar resolveNonFinancialFinalizePlan com sourceTaskId null
    expect(deps.tracks.resolveNonFinancialFinalizePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        tipoManejo: "pesagem",
        sourceTaskId: null,
      }),
    );

    // Não deve adicionar operação de agenda_itens
    expect(deps.commit.buildAgendaCompletionOp).not.toHaveBeenCalled();

    // Deve commitar apenas o evento criado
    expect(deps.commit.runFinalizeGesture).toHaveBeenCalledWith(
      expect.objectContaining({
        fazendaId: "farm-1",
        ops: [
          expect.objectContaining({
            table: "eventos",
            action: "INSERT",
            record: expect.objectContaining({ id: "evt-1" }),
          }),
        ],
      }),
    );

    // Mensagem de sucesso
    expect(deps.feedback.showSuccess).toHaveBeenCalledWith("registro concluido");

    // Navega para /home pois é avulso
    expect(deps.feedback.navigate).toHaveBeenCalledWith("/home");
  });
});
