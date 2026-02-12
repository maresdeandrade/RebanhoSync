import { describe, expect, it } from "vitest";
import type { Operation } from "@/lib/offline/types";
import { sortOpsForSync } from "@/lib/offline/syncOrder";

function buildOp(partial: Partial<Operation>): Operation {
  return {
    client_op_id: partial.client_op_id ?? "op-default",
    client_tx_id: partial.client_tx_id ?? "tx-1",
    table: partial.table ?? "eventos",
    action: partial.action ?? "INSERT",
    record: partial.record ?? {},
    created_at: partial.created_at ?? "2026-02-11T00:00:00.000Z",
    op_order: partial.op_order,
  };
}

describe("syncOrder", () => {
  it("prioriza op_order quando presente em ambas ops", () => {
    const ops = [
      buildOp({ client_op_id: "b", table: "eventos_pesagem", op_order: 1 }),
      buildOp({ client_op_id: "a", table: "eventos", op_order: 0 }),
    ];

    const sorted = sortOpsForSync(ops);
    expect(sorted.map((o) => o.client_op_id)).toEqual(["a", "b"]);
  });

  it("coloca ops com op_order antes de ops sem op_order", () => {
    const ops = [
      buildOp({ client_op_id: "sem-ordem", table: "eventos_pesagem" }),
      buildOp({ client_op_id: "com-ordem", table: "eventos", op_order: 0 }),
    ];

    const sorted = sortOpsForSync(ops);
    expect(sorted.map((o) => o.client_op_id)).toEqual(["com-ordem", "sem-ordem"]);
  });

  it("fallback garante evento base antes do detalhe quando sem op_order", () => {
    const ops = [
      buildOp({ client_op_id: "detalhe", table: "eventos_pesagem" }),
      buildOp({ client_op_id: "base", table: "eventos" }),
    ];

    const sorted = sortOpsForSync(ops);
    expect(sorted.map((o) => o.client_op_id)).toEqual(["base", "detalhe"]);
  });

  it("fallback ordena INSERT antes de UPDATE", () => {
    const ops = [
      buildOp({
        client_op_id: "upd-animal",
        table: "animais",
        action: "UPDATE",
        record: { id: "ani-1", lote_id: "lote-2" },
      }),
      buildOp({
        client_op_id: "ins-evt",
        table: "eventos",
        action: "INSERT",
        record: { id: "evt-1", dominio: "movimentacao", animal_id: "ani-1" },
      }),
    ];

    const sorted = sortOpsForSync(ops);
    expect(sorted.map((o) => o.client_op_id)).toEqual(["ins-evt", "upd-animal"]);
  });

  it("fallback em DELETE remove detalhe antes de base", () => {
    const ops = [
      buildOp({
        client_op_id: "del-base",
        table: "eventos",
        action: "DELETE",
        record: { id: "evt-1" },
      }),
      buildOp({
        client_op_id: "del-detalhe",
        table: "eventos_pesagem",
        action: "DELETE",
        record: { evento_id: "evt-1" },
      }),
    ];

    const sorted = sortOpsForSync(ops);
    expect(sorted.map((o) => o.client_op_id)).toEqual(["del-detalhe", "del-base"]);
  });
});
