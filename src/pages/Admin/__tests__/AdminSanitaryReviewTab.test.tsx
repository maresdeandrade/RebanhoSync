// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminSanitaryReviewTab } from "../components/AdminSanitaryReviewTab";
import { listPendingCatalogReviewsV2, savePendingCatalogReviewV2 } from "@/lib/sanitario/catalog/sanitaryCatalogReviewV2";

const api = vi.hoisted(() => ({ list: vi.fn(), preview: vi.fn(), submit: vi.fn() }));
vi.mock("@/lib/sanitario/catalog/sanitaryCatalogReviewV2", async importOriginal => ({
  ...await importOriginal<object>(), listCatalogReviewsV2: api.list, previewCatalogReviewV2: api.preview, submitCatalogReviewV2: api.submit,
}));
const protocol = "20000000-0000-4000-8000-000000000001", item = "30000000-0000-4000-8000-000000000001";
const preview = { protocol_id: protocol, expected_version: 2, item_ids: [item], reviewed_content_digest: "a".repeat(64), blockers: [], content: { items: [{ id: item, version: 2 }] } };
async function review() {
  render(<AdminSanitaryReviewTab userId="reviewer" />);
  await screen.findByRole("option", { name: /B19/ });
  fireEvent.change(screen.getByLabelText("Protocolo"), { target: { value: protocol } });
  fireEvent.click(screen.getByRole("checkbox", { name: /b19_femeas/ }));
  fireEvent.click(screen.getByRole("button", { name: "Revisar conteúdo e fontes" }));
  await screen.findByText(/Hash do conteúdo/);
}
function confirm() {
  fireEvent.change(screen.getByLabelText("Justificativa da decisão"), { target: { value: "Conferi as fontes e versões apresentadas." } });
  fireEvent.click(screen.getByRole("checkbox", { name: /Confirmo a decisão/ }));
}
describe("ação explícita do revisor global", () => {
  afterEach(() => vi.restoreAllMocks());
  beforeEach(() => {
    localStorage.clear(); vi.clearAllMocks();
    api.list.mockResolvedValue([{ id: protocol, version: 2, name: "B19", items: [{ id: item, logical_item_key: "b19_femeas_3_8_meses", version: 2 }] }]);
    api.preview.mockResolvedValue(preview);
    api.submit.mockResolvedValue({ result: "approved", decision_reference: "sanitary-v2:receipt" });
  });
  it("exige revisar, justificar e confirmar, sem solicitar fazenda ou CRMV", async () => {
    await review();
    const button = screen.getByRole("button", { name: "Aprovar e publicar versão" });
    expect(button).toBeDisabled(); expect(api.submit).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/CRMV|Fazenda|Veterinário/i)).not.toBeInTheDocument();
    confirm(); fireEvent.click(button);
    await screen.findByText(/aprovada e publicada/);
    expect(api.submit).toHaveBeenCalledTimes(1);
    expect(api.submit.mock.calls[0][0]).toMatchObject({ protocolId: protocol, itemIds: [item], digest: preview.reviewed_content_digest, result: "approved" });
    expect(listPendingCatalogReviewsV2("reviewer")).toEqual([]);
  });
  it("bloqueio de evidência impede aprovação e permite registrar rejeição justificada", async () => {
    api.preview.mockResolvedValue({ ...preview, blockers: ["COMMERCIAL_EVIDENCE_REQUIRED"] });
    await review(); confirm();
    expect(screen.getByRole("button", { name: "Aprovar e publicar versão" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Registrar rejeição" }));
    await waitFor(() => expect(api.submit).toHaveBeenCalledWith(expect.objectContaining({ result: "rejected" })));
  });
  it("reconexão reabilita a confirmação sem reenviar decisão automaticamente", async () => {
    await review(); confirm();
    const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    fireEvent(window, new Event("offline"));
    expect(screen.getByRole("button", { name: "Aprovar e publicar versão" })).toBeDisabled();
    online.mockReturnValue(true); fireEvent(window, new Event("online"));
    expect(screen.getByRole("button", { name: "Aprovar e publicar versão" })).toBeEnabled();
    expect(api.submit).not.toHaveBeenCalled();
  });
  it("falha de transporte conserva request_id e retoma exatamente o comando após reabrir", async () => {
    api.submit.mockRejectedValueOnce(new Error("Conexão interrompida"));
    await review(); confirm(); fireEvent.click(screen.getByRole("button", { name: "Aprovar e publicar versão" }));
    await screen.findByText("Conexão interrompida");
    const command = listPendingCatalogReviewsV2("reviewer")[0];
    expect(command).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Retomar decisão" }));
    await screen.findByText(/aprovada e publicada/);
    expect(api.submit.mock.calls[1][0]).toEqual(command);
    expect(listPendingCatalogReviewsV2("reviewer")).toEqual([]);
  });
  it("recupera intenção de sessão anterior e apresenta negativa do servidor sem publicar localmente", async () => {
    const command = { requestId: "10000000-0000-4000-8000-000000000001", protocolId: protocol, expectedVersion: 2, itemIds: [item], digest: preview.reviewed_content_digest, result: "approved" as const, justification: "Decisão explícita anterior, sem confirmação de recebimento." };
    savePendingCatalogReviewV2("reviewer", command);
    api.submit.mockRejectedValueOnce({ code: "42501" });
    render(<AdminSanitaryReviewTab userId="reviewer" />);
    fireEvent.click(await screen.findByRole("button", { name: "Retomar decisão" }));
    await screen.findByText(/Sem permissão para revisão global/);
    expect(listPendingCatalogReviewsV2("reviewer")).toEqual([command]);
    expect(api.submit).toHaveBeenCalledWith(command);
  });
});
