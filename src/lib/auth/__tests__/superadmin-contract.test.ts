import { describe, expect, it, vi } from "vitest";
import {
  checkIsSuperAdmin,
  evaluateSuperAdminAccess,
  fetchPlatformMetrics,
} from "../superadminContract";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("SuperAdmin Security & Access Contracts (A1.1 + A2)", () => {
  const superAdminId = "usr-superadmin-001";
  const regularUserId = "usr-regular-002";
  const farmOwnerId = "usr-owner-003";
  const farmManagerId = "usr-manager-004";

  const superAdminRegistry = new Set<string>([superAdminId]);

  it("1. Usuário não autenticado não adquire privilégio administrativo", async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
      rpc: vi.fn(),
    } as unknown as Pick<SupabaseClient, "rpc" | "auth">;

    const isAdmin = await checkIsSuperAdmin(mockClient);
    expect(isAdmin).toBe(false);
    expect(mockClient.rpc).not.toHaveBeenCalled();

    const evaluated = evaluateSuperAdminAccess({
      userId: null,
      superAdminUserIds: superAdminRegistry,
    });
    expect(evaluated).toBe(false);
  });

  it("2. Usuário autenticado comum não é reconhecido como SuperAdmin", async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: regularUserId, email: "user@fazenda.com" } },
          error: null,
        }),
      },
      rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    } as unknown as Pick<SupabaseClient, "rpc" | "auth">;

    const isAdmin = await checkIsSuperAdmin(mockClient);
    expect(isAdmin).toBe(false);
    expect(mockClient.rpc).toHaveBeenCalledWith("is_app_admin");

    const evaluated = evaluateSuperAdminAccess({
      userId: regularUserId,
      superAdminUserIds: superAdminRegistry,
    });
    expect(evaluated).toBe(false);
  });

  it("3. Owner e Manager de fazenda NÃO se tornam automaticamente SuperAdmin global", () => {
    // Owner de fazenda
    const ownerEvaluated = evaluateSuperAdminAccess({
      userId: farmOwnerId,
      superAdminUserIds: superAdminRegistry,
      farmRoles: [{ farmId: "fazenda-alpha", role: "owner" }],
    });
    expect(ownerEvaluated).toBe(false);

    // Manager de fazenda
    const managerEvaluated = evaluateSuperAdminAccess({
      userId: farmManagerId,
      superAdminUserIds: superAdminRegistry,
      farmRoles: [{ farmId: "fazenda-alpha", role: "manager" }],
    });
    expect(managerEvaluated).toBe(false);
  });

  it("4. Usuário presente explicitamente em app_superadmins é reconhecido", async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: superAdminId, email: "admin@rebanhosync.com" } },
          error: null,
        }),
      },
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    } as unknown as Pick<SupabaseClient, "rpc" | "auth">;

    const isAdmin = await checkIsSuperAdmin(mockClient);
    expect(isAdmin).toBe(true);
    expect(mockClient.rpc).toHaveBeenCalledWith("is_app_admin");

    const evaluated = evaluateSuperAdminAccess({
      userId: superAdminId,
      superAdminUserIds: superAdminRegistry,
    });
    expect(evaluated).toBe(true);
  });

  it("5. Remoção do registro em app_superadmins elimina o privilégio imediatamente", () => {
    const dynamicRegistry = new Set<string>([superAdminId]);
    expect(
      evaluateSuperAdminAccess({
        userId: superAdminId,
        superAdminUserIds: dynamicRegistry,
      }),
    ).toBe(true);

    // Revoga SuperAdmin
    dynamicRegistry.delete(superAdminId);

    expect(
      evaluateSuperAdminAccess({
        userId: superAdminId,
        superAdminUserIds: dynamicRegistry,
      }),
    ).toBe(false);
  });

  it("6. RPC retorna false defensivamente em caso de erro de rede ou RPC rejeitada", async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: superAdminId } },
          error: null,
        }),
      },
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "RPC failed" },
      }),
    } as unknown as Pick<SupabaseClient, "rpc" | "auth">;

    const isAdmin = await checkIsSuperAdmin(mockClient);
    expect(isAdmin).toBe(false);
  });

  it("7. fetchPlatformMetrics mapeia corretamente os dados da RPC read-only", async () => {
    const mockClient = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            total_users: "42",
            new_users_30d: "15",
            total_farms: "8",
            total_active_animals: "1250",
            pending_valid_invites: "3",
          },
        ],
        error: null,
      }),
    } as unknown as Pick<SupabaseClient, "rpc">;

    const metrics = await fetchPlatformMetrics(mockClient);
    expect(metrics).toEqual({
      totalUsers: 42,
      newUsers30d: 15,
      totalFarms: 8,
      totalActiveAnimals: 1250,
      pendingValidInvites: 3,
    });
    expect(mockClient.rpc).toHaveBeenCalledWith("admin_get_platform_metrics");
  });

  it("8. fetchPlatformMetrics lança AdminApiError FORBIDDEN se acesso for negado", async () => {
    const mockClient = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "42501", message: "Forbidden: Access denied" },
      }),
    } as unknown as Pick<SupabaseClient, "rpc">;

    await expect(fetchPlatformMetrics(mockClient)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
