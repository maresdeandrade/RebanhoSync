import { describe, expect, it, vi } from "vitest";
import { runRegistrarFinalizeGestureEffect } from "@/pages/Registrar/effects/finalizeGesture";

describe("finalizeGesture effect", () => {
  it("delegates createGesture with fazenda_id and ops", async () => {
    const createGestureFn = vi.fn(async () => "tx-999");
    const ops = [];
    const txId = await runRegistrarFinalizeGestureEffect({
      fazendaId: "farm-1",
      ops,
      createGestureFn,
    });

    expect(createGestureFn).toHaveBeenCalledTimes(1);
    expect(createGestureFn).toHaveBeenCalledWith("farm-1", ops);
    expect(txId).toBe("tx-999");
  });
});
