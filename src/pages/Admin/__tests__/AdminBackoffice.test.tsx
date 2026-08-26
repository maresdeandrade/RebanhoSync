/** @vitest-environment jsdom */
import "@testing-library/jest-dom";
import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AdminBackoffice } from "../index";
import * as adminApi from "@/lib/admin/adminApi";
import { AdminApiError } from "@/lib/admin/adminTypes";

vi.mock("@/lib/admin/adminApi", () => ({
  fetchPlatformMetrics: vi.fn(),
  fetchPlatformUsers: vi.fn(),
  fetchPlatformUserDetail: vi.fn(),
  fetchPlatformFarms: vi.fn(),
  fetchPlatformInvites: vi.fn(),
  adminSetCanCreateFarm: vi.fn(),
  checkIsSuperAdmin: vi.fn(),
}));

const mockRefreshSettings = vi.fn().mockResolvedValue(undefined);
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    refreshSettings: mockRefreshSettings,
    isSuperAdmin: true,
    session: { user: { id: "admin-1" } },
  }),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("AdminBackoffice Page (A3.1 + A4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(adminApi, "fetchPlatformMetrics").mockResolvedValue({
      totalUsers: 150,
      newUsers30d: 45,
      totalFarms: 20,
      totalActiveAnimals: 5200,
      pendingValidInvites: 8,
    });

    vi.spyOn(adminApi, "fetchPlatformUsers").mockResolvedValue([
      {
        id: "usr-1",
        email: "carlos@rebanhosync.local",
        displayName: "Carlos Fazendeiro",
        canCreateFarm: true,
        createdAt: "2026-08-24T10:00:00Z",
        lastSignInAt: "2026-08-24T12:00:00Z",
        farmsCount: 2,
      },
    ]);

    vi.spyOn(adminApi, "fetchPlatformFarms").mockResolvedValue([
      {
        id: "farm-1",
        nome: "Fazenda Estrela",
        codigo: "FE-01",
        municipio: "Rio Verde",
        estado: "GO",
        areaTotalHa: 800,
        createdAt: "2026-08-24T10:00:00Z",
        ownerId: "usr-1",
        ownerName: "Carlos Fazendeiro",
        ownerEmail: "carlos@rebanhosync.local",
        activeAnimalsCount: 250,
        membersCount: 5,
      },
    ]);

    vi.spyOn(adminApi, "fetchPlatformInvites").mockResolvedValue([
      {
        id: "inv-1",
        fazendaId: "farm-1",
        fazendaNome: "Fazenda Estrela",
        invitedBy: "usr-1",
        inviterName: "Carlos Fazendeiro",
        inviterEmail: "carlos@rebanhosync.local",
        email: "peao@test.local",
        phone: null,
        role: "cowboy",
        status: "pending",
        isExpired: false,
        expiresAt: "2026-08-31T10:00:00Z",
        createdAt: "2026-08-24T10:00:00Z",
      },
    ]);
  });

  it("renderiza o cabeçalho e os cards de métricas factuais com terminologia correta", async () => {
    render(
      <MemoryRouter>
        <AdminBackoffice />
      </MemoryRouter>,
    );

    expect(screen.getByText("Painel Administrativo")).toBeInTheDocument();
    expect(screen.getByText("SuperAdmin")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Total de usuários")).toBeInTheDocument();
      expect(screen.getByText("150")).toBeInTheDocument();
      expect(screen.getByText("Novos usuários — 30 dias")).toBeInTheDocument();
      expect(screen.getByText("45")).toBeInTheDocument();
      expect(screen.getByText("Total de fazendas")).toBeInTheDocument();
      expect(screen.getByText("20")).toBeInTheDocument();
      expect(screen.getByText("Propriedades cadastradas na plataforma")).toBeInTheDocument();
      expect(screen.getByText("Animais ativos")).toBeInTheDocument();
      expect(screen.getByText("5.200")).toBeInTheDocument();
      expect(screen.getByText("Convites pendentes válidos")).toBeInTheDocument();
      expect(screen.getByText("8")).toBeInTheDocument();
    });
  });

  it("permite alternar entre as abas e carregar a listagem de usuários", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminBackoffice />
      </MemoryRouter>,
    );

    const usersTabTrigger = screen.getByRole("tab", { name: /Usuários/i });
    await user.click(usersTabTrigger);

    await waitFor(() => {
      expect(screen.getByText("Carlos Fazendeiro")).toBeInTheDocument();
      expect(screen.getByText("carlos@rebanhosync.local")).toBeInTheDocument();
      expect(screen.getByText("Permitido")).toBeInTheDocument();
    });
  });

  it("executa mutação A4 de can_create_farm com confirmação prévia e atualiza UI", async () => {
    const user = userEvent.setup();
    vi.spyOn(adminApi, "adminSetCanCreateFarm").mockResolvedValue({
      userId: "usr-1",
      previousCanCreateFarm: true,
      canCreateFarm: false,
      changed: true,
    });

    render(
      <MemoryRouter>
        <AdminBackoffice />
      </MemoryRouter>,
    );

    const usersTabTrigger = screen.getByRole("tab", { name: /Usuários/i });
    await user.click(usersTabTrigger);

    await waitFor(() => {
      expect(screen.getByText("Carlos Fazendeiro")).toBeInTheDocument();
    });

    // Clica no controle de status can_create_farm
    const toggleButton = screen.getByTitle("Clique para bloquear criação de fazenda");
    await user.click(toggleButton);

    // Diálogo de confirmação deve abrir
    await waitFor(() => {
      expect(screen.getByText("Bloquear Criação de Fazendas")).toBeInTheDocument();
      expect(screen.getByText(/Deseja revogar a permissão do usuário/i)).toBeInTheDocument();
    });

    // Clica em confirmar
    const confirmButton = screen.getByRole("button", { name: /Confirmar Alteração/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(adminApi.adminSetCanCreateFarm).toHaveBeenCalledWith("usr-1", false);
      expect(screen.getByText("Bloqueado")).toBeInTheDocument();
    });
  });

  it("trata erro FORBIDDEN (revogação em sessão ativa) redirecionando para /home sem loop", async () => {
    vi.spyOn(adminApi, "fetchPlatformMetrics").mockRejectedValue(
      new AdminApiError("FORBIDDEN", "Forbidden: Access denied"),
    );

    render(
      <MemoryRouter>
        <AdminBackoffice />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/home", { replace: true });
    });
  });
});
