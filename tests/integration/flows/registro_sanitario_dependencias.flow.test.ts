import { describe, expect, it, vi } from "vitest";

import { createRegistrarFinalizeController } from "@/pages/Registrar/createRegistrarFinalizeController";
import {
  createBaseFinalizeDeps,
  createBaseFinalizeInput,
} from "./finalizeFlowTestUtils";

describe("flow: registro sanitario com dependencias", () => {
  it("usa caminho de RPC sanitario quando servidor conclui evento", async () => {
    const deps = createBaseFinalizeDeps();
    deps.sanitary.trySanitaryRpcFinalize = deps.sanitary.trySanitaryRpcFinalize.mockResolvedValue({
      status: "handled",
      eventoId: "evt-srv-1234",
    });

    const finalize = createRegistrarFinalizeController(deps);

    await finalize(createBaseFinalizeInput());

    expect(deps.sanitary.trySanitaryRpcFinalize).toHaveBeenCalledWith(
      expect.objectContaining({
        tipoManejo: "sanitario",
        sourceTaskId: "agenda-1",
        tipo: "vacinacao",
      }),
    );
    expect(deps.commit.runFinalizeGesture).not.toHaveBeenCalled();
    expect(deps.feedback.navigate).toHaveBeenCalledWith("/home");
  });

  it("quando RPC nao trata, propaga dependencias para o plano nao financeiro", async () => {
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
