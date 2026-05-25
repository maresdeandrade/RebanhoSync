import { describe, expect, it } from "vitest";

import {
  buildInventoryResupplyPayload,
  evaluateInventoryResupply,
  parseInventoryResupplyPolicy,
} from "@/lib/inventory/resupplyPolicy";

describe("inventory resupply policy", () => {
  it("reads configured minimum stock and reorder point from payload", () => {
    expect(
      parseInventoryResupplyPolicy({
        inventory_policy: {
          estoque_minimo_base: 10,
          ponto_ressuprimento_base: 25,
        },
      }),
    ).toEqual({
      minimumStockBase: 10,
      reorderPointBase: 25,
    });
  });

  it("classifies stock below minimum as critical", () => {
    expect(
      evaluateInventoryResupply(8, {
        minimumStockBase: 10,
        reorderPointBase: 25,
      }),
    ).toMatchObject({
      status: "critical",
      gapToMinimum: 2,
      gapToReorderPoint: 17,
    });
  });

  it("classifies stock below reorder point as warning", () => {
    expect(
      evaluateInventoryResupply(18, {
        minimumStockBase: 10,
        reorderPointBase: 25,
      }),
    ).toMatchObject({
      status: "warning",
      gapToMinimum: 0,
      gapToReorderPoint: 7,
    });
  });

  it("removes policy when both thresholds are blank", () => {
    expect(
      buildInventoryResupplyPayload(
        {
          origem: "test",
          inventory_policy: {
            estoque_minimo_base: 10,
            ponto_ressuprimento_base: 25,
          },
        },
        { minimumStockBase: null, reorderPointBase: null },
      ),
    ).toEqual({ origem: "test" });
  });
});
