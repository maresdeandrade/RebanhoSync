import { describe, expect, it, vi } from "vitest";

import { createRegistrarFinalizeController } from "@/pages/Registrar/createRegistrarFinalizeController";
import {
  createBaseFinalizeDeps,
  createBaseFinalizeInput,
} from "./finalizeFlowTestUtils";

describe("flow: registro sanitario com dependencias", () => {
  it("registra o evento sem concluir a agenda sanitaria legada", async () => {
    const deps = createBaseFinalizeDeps();

    const finalize = createRegistrarFinalizeController(deps);

    await finalize(createBaseFinalizeInput());

    expect(deps.sanitary.trySanitaryRpcFinalize).not.toHaveBeenCalled();
    expect(deps.commit.buildAgendaCompletionOp).not.toHaveBeenCalled();
    expect(deps.commit.runFinalizeGesture).toHaveBeenCalledWith(
      expect.objectContaining({
        fazendaId: "farm-1",
        ops: [
          {
            table: "eventos",
            action: "INSERT",
            record: { id: "evt-1" },
          },
        ],
      }),
    );
    expect(deps.feedback.navigate).toHaveBeenCalledTimes(1);
    expect(deps.feedback.navigate).toHaveBeenCalledWith("/agenda");
  });

  it("propaga dependencias para o plano nao financeiro", async () => {
    const deps = createBaseFinalizeDeps();
    const finalize = createRegistrarFinalizeController(deps);

    await finalize(createBaseFinalizeInput());

    expect(deps.tracks.resolveNonFinancialFinalizePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        tipoManejo: "sanitario",
        protocoloItem: expect.objectContaining({
          id: "protocol-item-1",
          protocolo_id: "protocol-1",
        }),
        sanitaryProductName: "Vacina X",
        sanitaryProductMetadata: expect.objectContaining({ produto_id: "prod-1" }),
      }),
    );
  });

  it("retorna erro deterministico quando finalize falha", async () => {
    const deps = createBaseFinalizeDeps();
    deps.commit.runFinalizeGesture = vi.fn(async () => {
      throw new Error("falha de IO");
    });

    const finalize = createRegistrarFinalizeController(deps);

    await finalize(createBaseFinalizeInput());

    expect(deps.feedback.resolveFinalizeCatchIssue).toHaveBeenCalled();
    expect(deps.feedback.showError).toHaveBeenCalledWith("erro ao finalizar");
  });
});
