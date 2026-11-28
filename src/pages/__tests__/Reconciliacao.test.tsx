/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLiveQuery } from "dexie-react-hooks";

import { useAuth } from "@/hooks/useAuth";
import Reconciliacao from "@/pages/Reconciliacao";
import { getRejectionStats, listRejections } from "@/lib/offline/rejections";
import { retryRejectedOperation } from "@/lib/offline/ops";
import { db } from "@/lib/offline/db";
import type { Gesture } from "@/lib/offline/types";

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
  retryRejectedOperation: vi.fn(),
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
    queue_gestures: {
      bulkGet: vi.fn().mockResolvedValue([]),
    },
  },
}));

describe("Reconciliacao page", () => {
  const mockedUseAuth = vi.mocked(useAuth);
  const mockedUseLiveQuery = vi.mocked(useLiveQuery);
  const mockedListRejections = vi.mocked(listRejections);
  const mockedGetRejectionStats = vi.mocked(getRejectionStats);
  const mockedRetryRejectedOperation = vi.mocked(retryRejectedOperation);

  beforeEach(() => {
    vi.clearAllMocks();

    mockedUseAuth.mockReturnValue({
      activeFarmId: "farm-1",
    } as ReturnType<typeof useAuth>);

    mockedUseLiveQuery.mockImplementation((() => {
      const responses = [1, [{ id: "lote-a", nome: "Lote A" }]];
      let callCount = 0;
      return () => {
        const response = responses[callCount % responses.length];
        callCount += 1;
        return response as ReturnType<typeof useLiveQuery>;
      };
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

  it(
    "direciona rejeicoes previsiveis para o fluxo de correcao em vez de reenfileirar",
    { retry: 2 },
    async () => {
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
    },
  );

  it("rearma a operação rejeitada preservando identidade e evidência", async () => {
    mockedListRejections.mockResolvedValue({
      items: [
        {
          id: "rej-retry",
          fazenda_id: "farm-1",
          client_tx_id: "tx-1",
          client_op_id: "op-1",
          table: "animais",
          action: "UPDATE",
          reason_code: "DB_TIMEOUT",
          reason_message: "Falha transitória.",
          created_at: "2026-04-07T10:00:00.000Z",
        },
      ],
      nextCursor: undefined,
    });
    mockedRetryRejectedOperation.mockResolvedValue({
      clientTxId: "tx-1",
      clientOpId: "op-1",
    });

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Reconciliacao />
      </MemoryRouter>,
    );

    await screen.findByText("Falha transitória.");
    fireEvent.click(screen.getByRole("button", { name: "Re-enfileirar" }));

    await waitFor(() =>
      expect(mockedRetryRejectedOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "rej-retry",
          client_tx_id: "tx-1",
          client_op_id: "op-1",
        }),
      ),
    );
    expect(mockedListRejections).toHaveBeenCalled();
  });

  it("marca a rejeição como histórica quando a mesma operação foi aplicada depois", async () => {
    mockedListRejections.mockResolvedValue({
      items: [
        {
          id: "rej-applied",
          fazenda_id: "farm-1",
          client_tx_id: "tx-1",
          client_op_id: "op-1",
          table: "animais",
          action: "INSERT",
          reason_code: "FOREIGN_KEY_VIOLATION",
          reason_message: "Referência pai ainda não sincronizada.",
          created_at: "2026-04-07T10:00:00.000Z",
        },
      ],
      nextCursor: undefined,
    });
    vi.mocked(db.queue_ops.where).mockReturnValueOnce({
      anyOf: () => ({ toArray: async () => [] }),
    } as never);
    vi.mocked(db.queue_gestures.bulkGet).mockResolvedValueOnce([
      {
        client_tx_id: "tx-1",
        fazenda_id: "farm-1",
        client_id: "client-1",
        status: "DONE",
        sync_result: "APPLIED",
        created_at: "2026-04-07T10:01:00.000Z",
        operation_results: [
          {
            op_id: "op-1",
            status: "APPLIED",
            matched: true,
            recorded_at: "2026-04-07T10:01:00.000Z",
          },
        ],
      } satisfies Gesture,
    ]);

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Reconciliacao />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Aplicada após reenvio"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Operação aplicada em uma sincronização posterior; a rejeição original permanece apenas como histórico.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("1 resolvida(s) após sincronização"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Re-enfileirar" }),
    ).not.toBeInTheDocument();
  });

  it("não resolve rejeição quando outra operação do gesto foi aplicada", async () => {
    mockedListRejections.mockResolvedValue({
      items: [
        {
          id: "rej-other-op",
          fazenda_id: "farm-1",
          client_tx_id: "tx-1",
          client_op_id: "op-1",
          table: "animais",
          action: "INSERT",
          reason_code: "FOREIGN_KEY_VIOLATION",
          reason_message: "Referência pai ainda não sincronizada.",
          created_at: "2026-04-07T10:00:00.000Z",
        },
      ],
      nextCursor: undefined,
    });
    vi.mocked(db.queue_gestures.bulkGet).mockResolvedValueOnce([
      {
        client_tx_id: "tx-1",
        fazenda_id: "farm-1",
        client_id: "client-1",
        status: "DONE",
        sync_result: "APPLIED",
        created_at: "2026-04-07T10:01:00.000Z",
        operation_results: [
          {
            op_id: "op-1",
            client_op_id: "op-other",
            status: "APPLIED",
            matched: false,
            recorded_at: "2026-04-07T10:01:00.000Z",
          },
          {
            op_id: "op-2",
            client_op_id: "op-2",
            status: "APPLIED",
            matched: true,
            recorded_at: "2026-04-07T10:01:00.000Z",
          },
        ],
      } satisfies Gesture,
    ]);

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Reconciliacao />
      </MemoryRouter>,
    );

    await screen.findByText("Referência pai ainda não sincronizada.");
    expect(screen.queryByText("Aplicada após reenvio")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Re-enfileirar" }),
    ).toBeInTheDocument();
  });

  it("informa preservação factual sanitária e oferece o retry público", async () => {
    vi.mocked(db.queue_ops.where).mockReturnValueOnce({
      anyOf: () => ({
        toArray: async () => [
          {
            client_op_id: "op-fact",
            client_tx_id: "tx-fact",
            table: "sanitario_v2",
            action: "INSERT",
            sync_state: "REJECTED",
            record: { domain: "sanitario_v2", command: "apply_factual_core" },
          },
        ],
      }),
    } as never);
    mockedListRejections.mockResolvedValue({
      items: [
        {
          id: 2,
          fazenda_id: "farm-1",
          client_tx_id: "tx-fact",
          client_op_id: "op-fact",
          table: "sanitario_v2",
          action: "INSERT",
          reason_code: "SANITARIO_PRODUCT_CATALOG_VERSION_MISMATCH",
          reason_message: "Revisar identidade do catálogo",
          created_at: "2026-10-15T00:00:00Z",
        },
      ],
      nextCursor: undefined,
    });
    render(
      <MemoryRouter>
        <Reconciliacao />
      </MemoryRouter>,
    );
    await screen.findByText("Revisar identidade do catálogo");
    fireEvent.click(screen.getByRole("button", { name: "Ver detalhes" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/Fato sanitário preservado neste aparelho/),
    ).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Re-enfileirar" }),
    );
    await waitFor(() =>
      expect(mockedRetryRejectedOperation).toHaveBeenCalledWith(
        expect.objectContaining({ client_op_id: "op-fact" }),
      ),
    );
  });
});
