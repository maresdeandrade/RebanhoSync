import { describe, expect, it, vi } from "vitest";
import { previewPastosImportV2 } from "../importV2";
import { persistImportV2Preview } from "../importV2Persistence";

function buildPreview() {
  return previewPastosImportV2({
    entity: "pastos",
    fazendaId: "farm-1",
    importId: "import-fixed",
    rawText: [
      "nome;area_ha",
      "Pasto 1;10",
      "Pasto 2;10",
    ].join("\n"),
    existing: { pastos: [] },
  });
}

describe("persistImportV2Preview", () => {
  it("mantém sucesso parcial explícito quando um chunk falha", async () => {
    const preview = buildPreview();
    const createGestureFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"));

    const result = await persistImportV2Preview(preview, { createGestureFn });

    expect(result.summary.retryable).toBe(2);
    expect(result.summary.imported).toBe(0);
    expect(result.chunks[0]).toMatchObject({ status: "retryable" });
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ lineNumber: 2, status: "retryable" }),
        expect.objectContaining({ lineNumber: 3, status: "retryable" }),
      ]),
    );
  });

  it("reutiliza client_tx_id e client_op_ids determinísticos em retry", async () => {
    const preview = buildPreview();
    const createGestureFn = vi.fn().mockResolvedValue("tx");

    await persistImportV2Preview(preview, { createGestureFn });
    await persistImportV2Preview(preview, { createGestureFn });

    expect(createGestureFn).toHaveBeenCalledTimes(2);
    expect(createGestureFn.mock.calls[0]?.[2]).toEqual(
      createGestureFn.mock.calls[1]?.[2],
    );
  });
});
