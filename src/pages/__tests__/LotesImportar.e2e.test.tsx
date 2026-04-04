/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "@/hooks/useAuth";
import { createGesture } from "@/lib/offline/ops";
import { showSuccess } from "@/utils/toast";
import LotesImportar from "@/pages/LotesImportar";

vi.mock("@/hooks/useAuth");
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: vi.fn(),
}));
vi.mock("@/lib/offline/ops", () => ({
  createGesture: vi.fn(),
}));
vi.mock("@/utils/toast", () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("LotesImportar flow", () => {
  const mockedUseAuth = vi.mocked(useAuth);
  const mockedUseLiveQuery = vi.mocked(useLiveQuery);
  const mockedCreateGesture = vi.mocked(createGesture);

  beforeEach(() => {
    vi.clearAllMocks();

    mockedUseAuth.mockReturnValue({
      activeFarmId: "farm-1",
    } as ReturnType<typeof useAuth>);

    mockedCreateGesture.mockResolvedValue("tx-1");
  });

  it("importa lotes validos vinculando o pasto existente", async () => {
    mockedUseLiveQuery.mockImplementation((() => {
      let callCount = 0;

      return () => {
        callCount += 1;

        if (callCount % 2 === 1) {
          return [] as ReturnType<typeof useLiveQuery>;
        }

        return [
          {
            id: "pasto-1",
            nome: "Piquete 1",
            fazenda_id: "farm-1",
            deleted_at: null,
          },
        ] as ReturnType<typeof useLiveQuery>;
      };
    })());

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <LotesImportar />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText(/nome;status;pasto;observacoes/i), {
      target: {
        value: [
          "nome;status;pasto",
          "Matrizes;ativo;Piquete 1",
        ].join("\n"),
      },
    });

    const importButton = await screen.findByRole("button", {
      name: /Importar 1 lote\(s\)/i,
    });

    expect(importButton).toBeEnabled();
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(mockedCreateGesture).toHaveBeenCalledTimes(1);
    });

    expect(mockedCreateGesture.mock.calls[0]?.[1]).toMatchObject([
      {
        table: "lotes",
        action: "INSERT",
        record: {
          nome: "Matrizes",
          status: "ativo",
          pasto_id: "pasto-1",
        },
      },
    ]);
    expect(showSuccess).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/lotes");
  });

  it("bloqueia a importacao quando o pasto informado nao existe", async () => {
    mockedUseLiveQuery.mockReturnValue([] as ReturnType<typeof useLiveQuery>);

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <LotesImportar />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText(/nome;status;pasto;observacoes/i), {
      target: {
        value: [
          "nome;status;pasto",
          "Matrizes;ativo;Pasto Fantasma",
        ].join("\n"),
      },
    });

    const importButton = await screen.findByRole("button", {
      name: /Importar 1 lote\(s\)/i,
    });

    expect(importButton).toBeDisabled();
    expect(
      screen.getByText(/Pasto "Pasto Fantasma" nao encontrado na fazenda ativa\./i),
    ).toBeInTheDocument();
  });
});
