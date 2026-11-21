/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import AcceptInvite from "@/pages/AcceptInvite";

const setActiveFarm = vi.fn();
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ setActiveFarm }) }));

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
  fazenda_id: "22222222-2222-4222-8222-222222222222",
  fazenda_nome: "Fazenda Horizonte",
  role: "manager",
  inviter_nome: "Maria",
  expires_at: "2099-04-20T00:00:00.000Z",
  status: "pending",
  is_valid: true,
};

describe("AcceptInvite", () => {
  const mockedUseToast = vi.mocked(useToast);
  const mockedSupabaseRpc = vi.mocked(supabase.rpc);
  const mockedGetUser = vi.mocked(supabase.auth.getUser);
  const toast = vi.fn();
  const renderInvite = () => render(
    <MemoryRouter initialEntries={["/invites/11111111-1111-4111-8111-111111111111"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes><Route path="/invites/:token" element={<AcceptInvite />} /></Routes>
    </MemoryRouter>,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseToast.mockReturnValue({
      toast,
      dismiss: vi.fn(),
      toasts: [],
    });
  });

  it("aceita e seleciona a fazenda do convite antes de navegar", async () => {
    mockedSupabaseRpc.mockResolvedValueOnce({ data: [invitePreview], error: null }).mockResolvedValueOnce({ data: null, error: null });
    mockedGetUser.mockResolvedValue({ data: { user: { id: "recipient" } }, error: null } as Awaited<ReturnType<typeof supabase.auth.getUser>>);
    let finishSelection: () => void;
    setActiveFarm.mockImplementationOnce(() => new Promise<void>(resolve => { finishSelection = resolve; }));
    renderInvite();
    fireEvent.click(await screen.findByRole("button", { name: /Aceitar convite/i }));
    await waitFor(() => expect(setActiveFarm).toHaveBeenCalledWith(invitePreview.fazenda_id));
    expect(mockNavigate).not.toHaveBeenCalled();
    finishSelection!();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/home"));
  });

  it.each([
    ["accepted", "Convite ja utilizado"],
    ["cancelled", "Convite cancelado"],
    ["rejected", "Convite recusado"],
    ["pending", "Convite expirado"],
  ])("distingue estado indisponível %s sem permitir aceitação", async (status, title) => {
    mockedSupabaseRpc.mockResolvedValue({ data: [{ ...invitePreview, status, is_valid: false }], error: null });
    renderInvite();
    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Aceitar convite/i })).not.toBeInTheDocument();
  });

  it("exibe erro PostgREST compreensível e permite tentar novamente", async () => {
    mockedSupabaseRpc.mockResolvedValueOnce({ data: null, error: { message: "JWT cryptographic verification failed" } }).mockResolvedValueOnce({ data: [invitePreview], error: null });
    renderInvite();
    expect(await screen.findByText(/Não foi possível validar o acesso/)).toBeInTheDocument();
    expect(screen.queryByText("[object Object]")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("button", { name: /Aceitar convite/i })).toBeInTheDocument();
  });

  it("mantém o convite e permite recuperar de recusa do servidor por identidade diferente", async () => {
    mockedSupabaseRpc.mockResolvedValueOnce({ data: [invitePreview], error: null }).mockResolvedValueOnce({ data: null, error: { message: "Email does not match" } });
    mockedGetUser.mockResolvedValue({ data: { user: { id: "other-user" } }, error: null } as Awaited<ReturnType<typeof supabase.auth.getUser>>);
    renderInvite();
    fireEvent.click(await screen.findByRole("button", { name: /Aceitar convite/i }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringMatching(/outro e-mail/) })));
    expect(setActiveFarm).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Aceitar convite/i })).toBeEnabled();
  });

  it("renderiza um convite valido com CTA claro em portugues", async () => {
    mockedSupabaseRpc.mockImplementation(async (fn) => {
      if (fn === "get_invite_preview") {
        return { data: [invitePreview], error: null };
      }

      return { data: null, error: null };
    });
    mockedGetUser.mockResolvedValue({
      data: { user: null },
      error: null,
    } as Awaited<ReturnType<typeof supabase.auth.getUser>>);

    render(
      <MemoryRouter
        initialEntries={["/invites/11111111-1111-4111-8111-111111111111"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/invites/:token" element={<AcceptInvite />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Entrar na fazenda/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Aceitar convite/i }),
    ).toBeInTheDocument();
  });

  it("redireciona para login ao tentar aceitar sem autenticacao", async () => {
    mockedSupabaseRpc.mockImplementation(async (fn) => {
      if (fn === "get_invite_preview") {
        return { data: [invitePreview], error: null };
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
        initialEntries={["/invites/11111111-1111-4111-8111-111111111111"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route path="/invites/:token" element={<AcceptInvite />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: /Aceitar convite/i }),
    );

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Autenticacao necessaria",
        }),
      );
    });
    expect(mockNavigate).toHaveBeenCalledWith(
      "/login?redirect=%2Finvites%2F11111111-1111-4111-8111-111111111111",
    );
  });
});
