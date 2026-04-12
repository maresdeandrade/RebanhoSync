import { describe, expect, it } from "vitest";

import { normalizeTableMutationRecord } from "../mutationRecord";

describe("normalizeTableMutationRecord", () => {
  it("drops legacy id alias for fazenda_sanidade_config updates", () => {
    const normalized = normalizeTableMutationRecord(
      "fazenda_sanidade_config",
      {
        id: "farm-1",
        payload: { overlay_runtime: { feed_ban: { status: "conforme" } } },
      },
      "farm-1",
    );

    expect(normalized).toEqual({
      fazenda_id: "farm-1",
      payload: { overlay_runtime: { feed_ban: { status: "conforme" } } },
    });
  });

  it("keeps unrelated tables untouched", () => {
    const normalized = normalizeTableMutationRecord("animais", {
      id: "animal-1",
      lote_id: "lote-2",
    });

    expect(normalized).toEqual({
      id: "animal-1",
      lote_id: "lote-2",
    });
  });
});
