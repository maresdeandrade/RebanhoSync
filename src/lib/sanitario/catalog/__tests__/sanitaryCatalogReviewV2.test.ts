// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearPendingCatalogReviewV2, listPendingCatalogReviewsV2, previewCatalogReviewV2, savePendingCatalogReviewV2, submitCatalogReviewV2, type CatalogReviewCommandV2 } from "../sanitaryCatalogReviewV2";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { rpc } }));
const command: CatalogReviewCommandV2 = { requestId: "10000000-0000-4000-8000-000000000001", protocolId: "20000000-0000-4000-8000-000000000001", expectedVersion: 2,
  itemIds: ["30000000-0000-4000-8000-000000000001"], digest: "a".repeat(64), result: "approved", justification: "Revisão explícita das evidências por campo." };

describe("comando curatorial autenticado e intenção recuperável", () => {
  beforeEach(() => { localStorage.clear(); rpc.mockReset(); });
  it("envia somente conteúdo, hash e decisão; identidade e timestamp são exclusivos do servidor", async () => {
    rpc.mockResolvedValue({ data: { actor_id: "server-user", approved_at: "server-time" }, error: null });
    expect(await submitCatalogReviewV2(command)).toMatchObject({ actor_id: "server-user", approved_at: "server-time" });
    expect(rpc).toHaveBeenCalledWith("sanitario_catalog_decide_v2", { _protocol_id: command.protocolId, _expected_version: 2,
      _item_ids: command.itemIds, _reviewed_content_digest: command.digest, _result: "approved", _justification: command.justification, _request_id: command.requestId });
  });
  it("preview exige versão exata e não transmite ator informado pelo cliente", async () => {
    rpc.mockResolvedValue({ data: { blockers: [] }, error: null });
    await previewCatalogReviewV2({ id: command.protocolId, version: 2, name: "B19", items: [] }, command.itemIds);
    expect(rpc).toHaveBeenCalledWith("sanitario_catalog_review_preview_v2", { _protocol_id: command.protocolId, _expected_version: 2, _item_ids: command.itemIds });
  });
  it.each(["42501", "40001", "NETWORK"])("mantém a mesma intenção após falha %s, sem aprovação local", async (code) => {
    savePendingCatalogReviewV2("reviewer", command);
    rpc.mockResolvedValue({ error: { code, message: "failure" } });
    await expect(submitCatalogReviewV2(command)).rejects.toMatchObject({ code });
    expect(listPendingCatalogReviewsV2("reviewer")).toEqual([command]);
    clearPendingCatalogReviewV2("reviewer", command.requestId);
    expect(listPendingCatalogReviewsV2("reviewer")).toEqual([]);
  });
  it("isola usuário, mantém múltiplas intenções e ignora payload adulterado", () => {
    const another = { ...command, requestId: "10000000-0000-4000-8000-000000000002" };
    savePendingCatalogReviewV2("one", command); savePendingCatalogReviewV2("one", another); savePendingCatalogReviewV2("two", command);
    localStorage.setItem("sanitary-catalog-review-v1:one:bad", JSON.stringify(command));
    localStorage.setItem("sanitary-catalog-review-v1:one:broken", "{");
    expect(listPendingCatalogReviewsV2("one")).toEqual([command, another]);
    clearPendingCatalogReviewV2("one", command.requestId);
    expect(listPendingCatalogReviewsV2("one")).toEqual([another]);
    expect(listPendingCatalogReviewsV2("two")).toEqual([command]);
  });
  it("recusa comando sem justificativa ou com hash inválido antes da RPC", async () => {
    await expect(submitCatalogReviewV2({ ...command, justification: "" })).rejects.toThrow();
    await expect(submitCatalogReviewV2({ ...command, digest: "invalid" })).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
});
