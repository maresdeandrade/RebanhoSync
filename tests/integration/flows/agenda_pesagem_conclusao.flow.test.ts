import { describe, expect, it } from "vitest";

import { createRegistrarFinalizeController } from "@/pages/Registrar/createRegistrarFinalizeController";
import {
  createBaseFinalizeDeps,
  createBaseFinalizeInput,
} from "./finalizeFlowTestUtils";

describe("flow: agenda de pesagem conclusao", () => {
  it("conclui agenda de pesagem ao finalizar o registro", async () => {
    const deps = createBaseFinalizeDeps();

    const finalize = createRegistrarFinalizeController(deps);

    const input = createBaseFinalizeInput({
      context: {
        ...createBaseFinalizeInput().context,
        tipoManejo: "pesagem",
        sourceTaskId: "agenda-pesa-123",
      },
      operationData: {
        ...createBaseFinalizeInput().operationData,
        pesagemData: { "animal-1": "460" },
      },
    });

    await finalize(input);

    // Deve chamar resolveNonFinancialFinalizePlan com sourceTaskId preenchido
    expect(deps.tracks.resolveNonFinancialFinalizePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        tipoManejo: "pesagem",
        sourceTaskId: "agenda-pesa-123",
      }),
    );

    // Deve construir o update de conclusao da agenda
    expect(deps.commit.buildAgendaCompletionOp).toHaveBeenCalledWith({
      sourceTaskId: "agenda-pesa-123",
      linkedEventId: "evt-1",
    });

    // Deve commitar o evento e o update da agenda
    expect(deps.commit.runFinalizeGesture).toHaveBeenCalledWith(
      expect.objectContaining({
        fazendaId: "farm-1",
        ops: expect.arrayContaining([
          expect.objectContaining({
            table: "eventos",
            action: "INSERT",
            record: expect.objectContaining({ id: "evt-1" }),
          }),
          expect.objectContaining({
            table: "agenda_itens",
            action: "UPDATE",
            record: expect.objectContaining({
              id: "agenda-pesa-123",
              status: "concluido",
              source_evento_id: "evt-1",
            }),
          }),
        ]),
      }),
    );

    // Deve navegar para agenda
    expect(deps.feedback.navigate).toHaveBeenCalledWith("/agenda");
  });
});
