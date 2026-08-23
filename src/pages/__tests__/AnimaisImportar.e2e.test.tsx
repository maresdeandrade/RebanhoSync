/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "@/hooks/useAuth";
import { useLotes } from "@/hooks/useLotes";
import { createGesture } from "@/lib/offline/ops";
import { DEFAULT_FARM_LIFECYCLE_CONFIG } from "@/lib/farms/lifecycleConfig";
import { showError, showSuccess } from "@/utils/toast";
import AnimaisImportar from "@/pages/AnimaisImportar";

vi.mock("@/hooks/useAuth");
vi.mock("@/hooks/useLotes", () => ({ useLotes: vi.fn() }));
vi.mock("dexie-react-hooks", () => ({ useLiveQuery: vi.fn() }));
vi.mock("@/lib/offline/ops", () => ({ createGesture: vi.fn() }));
vi.mock("@/utils/toast", () => ({ showError: vi.fn(), showSuccess: vi.fn() }));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

describe("AnimaisImportar flow", () => {
  const mockedUseAuth = vi.mocked(useAuth);
  const mockedUseLotes = vi.mocked(useLotes);
  const mockedUseLiveQuery = vi.mocked(useLiveQuery);
  const mockedCreateGesture = vi.mocked(createGesture);

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      activeFarmId: "farm-1",
      farmLifecycleConfig: DEFAULT_FARM_LIFECYCLE_CONFIG,
    } as ReturnType<typeof useAuth>);
    mockedUseLotes.mockReturnValue([] as ReturnType<typeof useLotes>);
    mockedUseLiveQuery.mockReturnValue([] as ReturnType<typeof useLiveQuery>);
    mockedCreateGesture.mockResolvedValue("tx-1");
  });

  it("usa o preview V2 e o writer canônico antes de enfileirar o animal", async () => {
    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AnimaisImportar />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText(/identificacao;sexo/i), {
      target: {
        value: [
          "identificacao;sexo;especie;lote;data_nascimento;data_entrada;origem;raca;nome;rfid;schema_version;template_version",
          "A-001;F;bovino;;2024-01-10;;nascimento;nelore;Estrela;;2;import-v2",
        ].join("\n"),
      },
    });

    const importButton = await screen.findByRole("button", {
      name: /Importar 1 animal\(is\)/i,
    });
    expect(importButton).toBeEnabled();
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(mockedCreateGesture).toHaveBeenCalledTimes(1);
    });

    expect(mockedCreateGesture.mock.calls[0]?.[0]).toBe("farm-1");
    expect(mockedCreateGesture.mock.calls[0]?.[1]).toMatchObject([
      {
        table: "animais",
        action: "INSERT",
        record: {
          identificacao: "A-001",
          sexo: "F",
          fazenda_id: "farm-1",
          pai_id: null,
          mae_id: null,
        },
      },
    ]);
    expect(showSuccess).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/animais");
  });

  it("exibe coluna inválida e não oferece enqueue nem retry para cabeçalho malformado", async () => {
    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <AnimaisImportar />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByPlaceholderText(/identificacao;sexo/i), {
      target: {
        value: "identificacao;sexo;data\\_nascimento\nA-001;F;2024-01-10",
      },
    });

    expect(
      await screen.findByText(/Coluna inválida "data\\_nascimento"/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Importar 0 animal\(is\)/i }),
    ).toBeDisabled();
    expect(mockedCreateGesture).not.toHaveBeenCalled();
    expect(showError).not.toHaveBeenCalledWith(
      expect.stringMatching(/aguardam retry/i),
    );
  });
});
