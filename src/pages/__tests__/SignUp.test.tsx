/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import SignUp from "@/pages/SignUp";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
    },
  },
}));

describe("SignUp", () => {
  const mockedUseAuth = vi.mocked(useAuth);
  const mockedSignUp = vi.mocked(supabase.auth.signUp);

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue({
      session: null,
      user: null,
      loading: false,
      activeFarmId: null,
      role: null,
      farmExperienceMode: "essential",
      farmLifecycleConfig: null,
      farmMeasurementConfig: null,
      notificationPreferences: null,
      setActiveFarm: vi.fn(),
      loadRoleForFarm: vi.fn(),
      refreshSettings: vi.fn(),
      signOut: vi.fn(),
    } as ReturnType<typeof useAuth>);
    mockedSignUp.mockResolvedValue({
      data: {
        user: { id: "user-1" },
        session: null,
      },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.signUp>>);
  });

  it("aceita telefone formatado e envia metadata normalizada", async () => {
    render(
      <MemoryRouter
        initialEntries={["/signup"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/signup" element={<SignUp />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/Nome/i), {
      target: { value: "Maria Silva" },
    });
    fireEvent.change(screen.getByLabelText(/E-mail/i), {
      target: { value: "maria@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/Telefone/i), {
      target: { value: "+55 11 98765-4321" },
    });
    fireEvent.change(screen.getByLabelText(/^Senha$/i), {
      target: { value: "senha123" },
    });
    fireEvent.change(screen.getByLabelText(/Confirmar Senha/i), {
      target: { value: "senha123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Criar Conta/i }));

    await waitFor(() => {
      expect(mockedSignUp).toHaveBeenCalledWith({
        email: "maria@example.com",
        password: "senha123",
        options: {
          data: {
            display_name: "Maria Silva",
            phone: "+5511987654321",
          },
        },
      });
    });
  });

  it("redireciona sessao sem fazenda ativa para selecao de fazenda", () => {
    mockedUseAuth.mockReturnValue({
      session: { user: { id: "user-1" } },
      user: { id: "user-1" },
      loading: false,
      activeFarmId: null,
      role: null,
      farmExperienceMode: "essential",
      farmLifecycleConfig: null,
      farmMeasurementConfig: null,
      notificationPreferences: null,
      setActiveFarm: vi.fn(),
      loadRoleForFarm: vi.fn(),
      refreshSettings: vi.fn(),
      signOut: vi.fn(),
    } as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter
        initialEntries={["/signup"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/signup" element={<SignUp />} />
          <Route path="/select-fazenda" element={<div>Selecionar fazenda</div>} />
          <Route path="/home" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Selecionar fazenda")).toBeInTheDocument();
  });
});
