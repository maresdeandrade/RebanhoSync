/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLiveQuery } from "dexie-react-hooks";

import { useAuth } from "@/hooks/useAuth";
import Reconciliacao from "@/pages/Reconciliacao";
import { getRejectionStats, listRejections } from "@/lib/offline/rejections";

vi.mock("@/hooks/useAuth");
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: vi.fn(),
}));
vi.mock("@/lib/offline/rejections", () => ({
  exportRejections: vi.fn(),
  getRejectionStats: vi.fn(),
  listRejections: vi.fn(),
  purgeRejections: vi.fn(),
  triggerDownload: vi.fn(),
}));
vi.mock("@/lib/offline/ops", () => ({
  createGesture: vi.fn(),
}));
vi.mock("@/lib/offline/reset", () => ({
  resetOfflineFarmData: vi.fn(),
}));
vi.mock("@/utils/toast", () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));
vi.mock("@/lib/offline/db", () => ({
  db: {
    queue_ops: {
      where: vi.fn(() => ({
        anyOf: vi.fn(() => ({
          toArray: vi.fn().mockResolvedValue([
            {
              client_op_id: "op-1",
              client_tx_id: "tx-1",
              table: "animais",
              action: "UPDATE",
              record: {
                id: "animal-1",
                identificacao: "Animal 241",
                lote_id: "lote-a",
              },
              before_snapshot: {
                id: "animal-1",
                identificacao: "Animal 241",
                lote_id: "lote-a",
              },
            },
          ]),
        })),
      })),
    },
  },
}));

describe("Reconciliacao page", () => {
  const mockedUseAuth = vi.mocked(useAuth);
  const mockedUseLiveQuery = vi.mocked(useLiveQuery);
  const mockedListRejections = vi.mocked(listRejections);
  const mockedGetRejectionStats = vi.mocked(getRejectionStats);

  beforeEach(() => {
    vi.clearAllMocks();

    mockedUseAuth.mockReturnValue({
      activeFarmId: "farm-1",
    } as ReturnType<typeof useAuth>);

    mockedUseLiveQuery.mockImplementation((() => {
      const responses = [1, [{ id: "lote-a", nome: "Lote A" }]];
      let callCount = 0;
      return () => responses[callCount++] as ReturnType<typeof useLiveQuery>;
    })());

    mockedListRejections.mockResolvedValue({
      items: [
        {
          id: "rej-1",
          fazenda_id: "farm-1",
          client_tx_id: "tx-1",
          client_op_id: "op-1",
          table: "animais",
          action: "UPDATE",
          reason_code: "ANTI_TELEPORTE",
          reason_message: "Origem e destino devem ser diferentes.",
          created_at: "2026-04-07T10:00:00.000Z",
        },
      ],
      nextCursor: undefined,
    });

    mockedGetRejectionStats.mockResolvedValue({
      count: 1,
      newestAt: "2026-04-07T10:00:00.000Z",
      oldestAt: "2026-04-07T10:00:00.000Z",
    });
  });

  it("direciona rejeicoes previsiveis para o fluxo de correcao em vez de reenfileirar", async () => {
    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Reconciliacao />
      </MemoryRouter>,
    );

    await screen.findByText("Origem e destino devem ser diferentes.");

    expect(
      screen.getByRole("link", { name: "Abrir movimentacao" }),
    ).toHaveAttribute("href", "/registrar?quick=movimentacao");
    expect(
      screen.queryByRole("button", { name: "Re-enfileirar" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver detalhes" }));

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("link", { name: "Abrir movimentacao" }),
    ).toHaveAttribute("href", "/registrar?quick=movimentacao");
    expect(
      within(dialog).queryByRole("button", { name: "Re-enfileirar" }),
    ).not.toBeInTheDocument();
  });
});
