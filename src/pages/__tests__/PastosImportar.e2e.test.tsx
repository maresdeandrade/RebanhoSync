/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "@/hooks/useAuth";
import { createGesture } from "@/lib/offline/ops";
import { showSuccess } from "@/utils/toast";
import PastosImportar from "@/pages/PastosImportar";

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

describe("PastosImportar flow", () => {
  const mockedUseAuth = vi.mocked(useAuth);
  const mockedUseLiveQuery = vi.mocked(useLiveQuery);
  const mockedCreateGesture = vi.mocked(createGesture);

  beforeEach(() => {
    vi.clearAllMocks();

    mockedUseAuth.mockReturnValue({
      activeFarmId: "farm-1",
    } as ReturnType<typeof useAuth>);

    mockedUseLiveQuery.mockReturnValue([] as ReturnType<typeof useLiveQuery>);
    mockedCreateGesture.mockResolvedValue("tx-1");
  });

  it("importa uma planilha valida de pastos para a fila offline", async () => {
    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <PastosImportar />
      </MemoryRouter>,
    );

    fireEvent.change(
      screen.getByPlaceholderText(/nome;area_ha;capacidade_ua;tipo_pasto/i),
      {
        target: {
          value: [
            "nome;area_ha;capacidade_ua;tipo_pasto",
            "Piquete 1;12;18;cultivado",
          ].join("\n"),
        },
      },
    );

    const importButton = await screen.findByRole("button", {
      name: /Importar 1 pasto\(s\)/i,
    });

    expect(importButton).toBeEnabled();
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(mockedCreateGesture).toHaveBeenCalledTimes(1);
    });

    expect(mockedCreateGesture.mock.calls[0]?.[0]).toBe("farm-1");
    expect(mockedCreateGesture.mock.calls[0]?.[1]).toMatchObject([
      {
        table: "pastos",
        action: "INSERT",
        record: {
          nome: "Piquete 1",
          area_ha: 12,
          capacidade_ua: 18,
          tipo_pasto: "cultivado",
        },
      },
    ]);
    expect(showSuccess).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/pastos");
  });
});
