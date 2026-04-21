/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import SelectFazenda from "@/pages/SelectFazenda";

vi.mock("@/hooks/useAuth");
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("SelectFazenda", () => {
  const mockedUseAuth = vi.mocked(useAuth);
  const mockedUseLiveQuery = vi.mocked(useLiveQuery);
  const mockedSupabaseRpc = vi.mocked(supabase.rpc);
  const setActiveFarm = vi.fn();
  const signOut = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockedUseAuth.mockReturnValue({
      user: {
        id: "user-1",
        email: "operador@fazenda.test",
      },
      signOut,
      setActiveFarm,
    } as ReturnType<typeof useAuth>);
  });

  it("mostra o estado vazio com copy limpa e sinaliza criacao permitida", async () => {
    mockedUseLiveQuery.mockReturnValue([] as ReturnType<typeof useLiveQuery>);
    mockedSupabaseRpc.mockResolvedValue({
      data: true,
      error: null,
    } as Awaited<ReturnType<typeof supabase.rpc>>);

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <SelectFazenda />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/Voce ainda nao esta vinculado a nenhuma fazenda/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Criacao permitida/i)).toBeInTheDocument();
    expect(screen.getByText(/^Sim$/i)).toBeInTheDocument();
  });

  it("seleciona a fazenda e navega para a rotina quando houver membership", async () => {
    mockedUseLiveQuery.mockReturnValue(
      [
        {
          role: "manager",
          fazendas: {
            id: "farm-1",
            nome: "Fazenda Boa Vista",
          },
        },
      ] as ReturnType<typeof useLiveQuery>,
    );
    mockedSupabaseRpc.mockResolvedValue({
      data: false,
      error: null,
    } as Awaited<ReturnType<typeof supabase.rpc>>);
    setActiveFarm.mockResolvedValue(undefined);

    render(
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <SelectFazenda />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Fazenda Boa Vista/i }));

    await waitFor(() => {
      expect(setActiveFarm).toHaveBeenCalledWith("farm-1");
    });
    expect(mockNavigate).toHaveBeenCalledWith("/home", { replace: true });
  });
});
