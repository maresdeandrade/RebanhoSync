/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import AcceptInvite from "@/pages/AcceptInvite";

vi.mock("@/hooks/use-toast", () => ({
  useToast: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
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

const invitePreview = {
  fazenda_nome: "Fazenda Horizonte",
  role: "manager",
  inviter_nome: "Maria",
  expires_at: "2026-04-20T00:00:00.000Z",
  status: "pending",
  is_valid: true,
};

describe("AcceptInvite", () => {
  const mockedUseToast = vi.mocked(useToast);
  const mockedSupabaseRpc = vi.mocked(supabase.rpc);
  const mockedGetUser = vi.mocked(supabase.auth.getUser);
  const toast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseToast.mockReturnValue({
      toast,
      dismiss: vi.fn(),
      toasts: [],
    });
  });

  it("renderiza um convite valido com CTA claro em portugues", async () => {
    mockedSupabaseRpc.mockImplementation(async (fn) => {
      if (fn === "get_invite_preview") {
        return { data: invitePreview, error: null };
      }

      return { data: null, error: null };
    });
    mockedGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.getUser>>);

    render(
      <MemoryRouter
        initialEntries={["/invites/token-123"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/invites/:token" element={<AcceptInvite />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/Voce foi convidado para entrar em uma fazenda/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Aceitar convite/i }),
    ).toBeInTheDocument();
  });

  it("redireciona para login ao tentar aceitar sem autenticacao", async () => {
    mockedSupabaseRpc.mockImplementation(async (fn) => {
      if (fn === "get_invite_preview") {
        return { data: invitePreview, error: null };
      }

      if (fn === "accept_invite") {
        return { data: "farm-1", error: null };
      }

      return { data: null, error: null };
    });
    mockedGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.getUser>>);

    render(
      <MemoryRouter
        initialEntries={["/invites/token-123"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/invites/:token" element={<AcceptInvite />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Aceitar convite/i }));

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Autenticacao necessaria",
        }),
      );
    });
    expect(mockNavigate).toHaveBeenCalledWith("/login?redirect=/invites/token-123");
  });
});
