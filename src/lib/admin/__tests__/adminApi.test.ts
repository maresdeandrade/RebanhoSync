import { describe, expect, it, vi } from "vitest";
import {
  adminSetCanCreateFarm,
  checkIsSuperAdmin,
  fetchPlatformFarms,
  fetchPlatformInvites,
  fetchPlatformMetrics,
  fetchPlatformUserDetail,
  fetchPlatformUsers,
  parseAdminError,
} from "../adminApi";
import { AdminApiError } from "../adminTypes";
import type { SupabaseClient } from "@supabase/supabase-js";

function withNavigatorOnlineStatus<T>(onLine: boolean, run: () => T): T {
  const hadNavigator = typeof globalThis.navigator !== "undefined";

  if (!hadNavigator) {
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      configurable: true,
    });
  }

  const testNavigator = globalThis.navigator;
  const originalOnLine = Object.getOwnPropertyDescriptor(testNavigator, "onLine");
  Object.defineProperty(testNavigator, "onLine", { value: onLine, configurable: true });

  try {
    return run();
  } finally {
    if (originalOnLine) {
      Object.defineProperty(testNavigator, "onLine", originalOnLine);
    } else {
      delete (testNavigator as { onLine?: boolean }).onLine;
    }

    if (!hadNavigator) {
      delete (globalThis as { navigator?: Navigator }).navigator;
    }
  }
}

describe("adminApi (A3.1 + A4 + A5 Hardening)", () => {
  describe("parseAdminError (A3.1 + A5 — ordem de precedência)", () => {
    it("identifica erro FORBIDDEN quando code = 42501 ou mensagem contém 'Forbidden'", () => {
      const err1 = parseAdminError({ code: "42501", message: "permission denied" });
      expect(err1).toBeInstanceOf(AdminApiError);
      expect(err1.code).toBe("FORBIDDEN");

      const err2 = parseAdminError(new Error("Forbidden: Access denied"));
      expect(err2.code).toBe("FORBIDDEN");
    });

    it("identifica erro NETWORK quando há falha de comunicação ou status 503", () => {
      const err1 = parseAdminError(new TypeError("Failed to fetch"));
      expect(err1.code).toBe("NETWORK");

      const err2 = parseAdminError({ status: 503, message: "Service Unavailable" });
      expect(err2.code).toBe("NETWORK");
    });

    it("retorna o próprio AdminApiError se já for instância", () => {
      const original = new AdminApiError("OFFLINE", "Sem conexão");
      expect(parseAdminError(original)).toBe(original);
    });

    it("classifica erros gerais como UNKNOWN", () => {
      const err = parseAdminError(new Error("Erro de constraint no banco"));
      expect(err.code).toBe("UNKNOWN");
      expect(err.message).toBe("Erro de constraint no banco");
    });

    // ────────────────────────────────────────────────────────────────────────
    // A5 — HARDENING CRÍTICO: 42501 + navigator.onLine = false → FORBIDDEN
    // O erro explícito do backend tem PRIORIDADE sobre o estado de conectividade
    // ────────────────────────────────────────────────────────────────────────
    it("A5: 42501 recebido com navigator.onLine=false ainda resulta em FORBIDDEN (não OFFLINE)", () => {
      withNavigatorOnlineStatus(false, () => {
        const err = parseAdminError({ code: "42501", message: "Forbidden: Access denied" });
        expect(err.code).toBe("FORBIDDEN");
        expect(err.code).not.toBe("OFFLINE");
      });
    });

    it("A5: mensagem 'Forbidden' recebida com navigator.onLine=false ainda resulta em FORBIDDEN", () => {
      withNavigatorOnlineStatus(false, () => {
        const err = parseAdminError(new Error("Forbidden: Access denied"));
        expect(err.code).toBe("FORBIDDEN");
      });
    });

    it("A5: OFFLINE é retornado como fallback somente quando não há código explícito", () => {
      withNavigatorOnlineStatus(false, () => {
        // Erro genérico sem código de autorização → OFFLINE (fallback correto)
        const err = parseAdminError(new Error("Algum erro inesperado sem código"));
        expect(err.code).toBe("OFFLINE");
      });
    });

    it("A5: EMPTY (array vazio sem erro) é semanticamente distinto de ERROR/OFFLINE/FORBIDDEN", async () => {
      // Valida que array vazio é um resultado legítimo, não um erro
      const mockClient = {
        rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as unknown as Pick<SupabaseClient, "rpc">;

      const { fetchPlatformUsers } = await import("../adminApi");
      const users = await fetchPlatformUsers({ limit: 10, offset: 0 }, mockClient);
      // EMPTY = resultado válido, não lança exceção
      expect(users).toEqual([]);
      expect(Array.isArray(users)).toBe(true);
    });

    it("A5: 504 resulta em NETWORK, nunca em FORBIDDEN ou OFFLINE", () => {
      const err = parseAdminError({ status: 504, message: "Gateway Timeout" });
      expect(err.code).toBe("NETWORK");
      expect(err.code).not.toBe("FORBIDDEN");
      expect(err.code).not.toBe("OFFLINE");
    });
  });

  describe("checkIsSuperAdmin", () => {
    it("retorna true para superadmin e false para não-superadmin", async () => {
      const adminClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "admin-1" } },
            error: null,
          }),
        },
        rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
      } as unknown as Pick<SupabaseClient, "rpc" | "auth">;

      expect(await checkIsSuperAdmin(adminClient)).toBe(true);
      expect(adminClient.rpc).toHaveBeenCalledWith("is_app_admin");

      const nonAdminClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: "user-2" } },
            error: null,
          }),
        },
        rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
      } as unknown as Pick<SupabaseClient, "rpc" | "auth">;

      expect(await checkIsSuperAdmin(nonAdminClient)).toBe(false);
    });
  });

  describe("fetchPlatformMetrics", () => {
    it("mapeia corretamente os dados agregados", async () => {
      const mockClient = {
        rpc: vi.fn().mockResolvedValue({
          data: [
            {
              total_users: "100",
              new_users_30d: "25",
              total_farms: "12",
              total_active_animals: "3400",
              pending_valid_invites: "5",
            },
          ],
          error: null,
        }),
      } as unknown as Pick<SupabaseClient, "rpc">;

      const metrics = await fetchPlatformMetrics(mockClient);
      expect(metrics).toEqual({
        totalUsers: 100,
        newUsers30d: 25,
        totalFarms: 12,
        totalActiveAnimals: 3400,
        pendingValidInvites: 5,
      });
    });

    it("lança AdminApiError FORBIDDEN quando Supabase retorna 42501", async () => {
      const mockClient = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "42501", message: "permission denied for function admin_get_platform_metrics" },
        }),
      } as unknown as Pick<SupabaseClient, "rpc">;

      await expect(fetchPlatformMetrics(mockClient)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });
  });

  describe("fetchPlatformUsers", () => {
    it("sanitiza parâmetros e formata a listagem leve", async () => {
      const mockClient = {
        rpc: vi.fn().mockResolvedValue({
          data: [
            {
              id: "u-1",
              email: "teste@rebanhosync.local",
              display_name: "Usuario Teste",
              can_create_farm: true,
              created_at: "2026-08-24T10:00:00Z",
              last_sign_in_at: "2026-08-24T12:00:00Z",
              farms_count: "2",
            },
          ],
          error: null,
        }),
      } as unknown as Pick<SupabaseClient, "rpc">;

      const users = await fetchPlatformUsers(
        { search: "  teste  ", limit: 25, offset: 0 },
        mockClient,
      );

      expect(mockClient.rpc).toHaveBeenCalledWith("admin_list_platform_users", {
        search: "teste",
        limit_count: 25,
        offset_count: 0,
      });

      expect(users).toHaveLength(1);
      expect(users[0]).toEqual({
        id: "u-1",
        email: "teste@rebanhosync.local",
        displayName: "Usuario Teste",
        canCreateFarm: true,
        createdAt: "2026-08-24T10:00:00Z",
        lastSignInAt: "2026-08-24T12:00:00Z",
        farmsCount: 2,
      });
    });

    it("retorna array vazio quando data é vazio legítimo (não é erro)", async () => {
      const mockClient = {
        rpc: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      } as unknown as Pick<SupabaseClient, "rpc">;

      const users = await fetchPlatformUsers({ limit: 10, offset: 0 }, mockClient);
      expect(users).toEqual([]);
    });
  });

  describe("fetchPlatformUserDetail", () => {
    it("busca detalhe e memberships do usuário sob demanda", async () => {
      const mockClient = {
        rpc: vi.fn().mockResolvedValue({
          data: [
            {
              id: "u-1",
              email: "teste@rebanhosync.local",
              display_name: "Usuario Teste",
              phone: "+5562988880001",
              can_create_farm: true,
              is_superadmin: true,
              created_at: "2026-08-24T10:00:00Z",
              last_sign_in_at: null,
              farms: [
                {
                  fazenda_id: "f-1",
                  fazenda_nome: "Fazenda Sol",
                  role: "owner",
                  is_primary: true,
                  accepted_at: "2026-08-24T10:00:00Z",
                },
              ],
            },
          ],
          error: null,
        }),
      } as unknown as Pick<SupabaseClient, "rpc">;

      const detail = await fetchPlatformUserDetail("u-1", mockClient);
      expect(mockClient.rpc).toHaveBeenCalledWith("admin_get_platform_user", {
        _user_id: "u-1",
      });

      expect(detail).toEqual({
        id: "u-1",
        email: "teste@rebanhosync.local",
        displayName: "Usuario Teste",
        phone: "+5562988880001",
        canCreateFarm: true,
        isSuperAdmin: true,
        createdAt: "2026-08-24T10:00:00Z",
        lastSignInAt: null,
        farms: [
          {
            fazenda_id: "f-1",
            fazenda_nome: "Fazenda Sol",
            role: "owner",
            is_primary: true,
            accepted_at: "2026-08-24T10:00:00Z",
          },
        ],
      });
    });
  });

  describe("fetchPlatformFarms", () => {
    it("mapeia propriedades e métricas de fazenda", async () => {
      const mockClient = {
        rpc: vi.fn().mockResolvedValue({
          data: [
            {
              id: "f-1",
              nome: "Fazenda Ouro",
              codigo: "FO-01",
              municipio: "Goiania",
              estado: "GO",
              area_total_ha: "450.5",
              created_at: "2026-08-24T10:00:00Z",
              owner_id: "u-1",
              owner_name: "Carlos",
              owner_email: "carlos@ouro.com",
              active_animals_count: "150",
              members_count: "4",
            },
          ],
          error: null,
        }),
      } as unknown as Pick<SupabaseClient, "rpc">;

      const farms = await fetchPlatformFarms({ limit: 10, offset: 0 }, mockClient);
      expect(farms).toHaveLength(1);
      expect(farms[0]).toEqual({
        id: "f-1",
        nome: "Fazenda Ouro",
        codigo: "FO-01",
        municipio: "Goiania",
        estado: "GO",
        areaTotalHa: 450.5,
        createdAt: "2026-08-24T10:00:00Z",
        ownerId: "u-1",
        ownerName: "Carlos",
        ownerEmail: "carlos@ouro.com",
        activeAnimalsCount: 150,
        membersCount: 4,
      });
    });
  });

  describe("fetchPlatformInvites (A2.1)", () => {
    it("mapeia convites sem expor token", async () => {
      const mockClient = {
        rpc: vi.fn().mockResolvedValue({
          data: [
            {
              id: "inv-1",
              fazenda_id: "f-1",
              fazenda_nome: "Fazenda Ouro",
              invited_by: "u-1",
              inviter_name: "Carlos",
              inviter_email: "carlos@ouro.com",
              email: "convidado@test.local",
              phone: "+5562988880009",
              role: "cowboy",
              status: "pending",
              is_expired: false,
              expires_at: "2026-08-31T10:00:00Z",
              created_at: "2026-08-24T10:00:00Z",
            },
          ],
          error: null,
        }),
      } as unknown as Pick<SupabaseClient, "rpc">;

      const invites = await fetchPlatformInvites(
        { statusFilter: "pending", limit: 10, offset: 0 },
        mockClient,
      );

      expect(mockClient.rpc).toHaveBeenCalledWith("admin_list_platform_invites", {
        status_filter: "pending",
        search: null,
        limit_count: 10,
        offset_count: 0,
      });

      expect(invites).toHaveLength(1);
      expect(invites[0]).toEqual({
        id: "inv-1",
        fazendaId: "f-1",
        fazendaNome: "Fazenda Ouro",
        invitedBy: "u-1",
        inviterName: "Carlos",
        inviterEmail: "carlos@ouro.com",
        email: "convidado@test.local",
        phone: "+5562988880009",
        role: "cowboy",
        status: "pending",
        isExpired: false,
        expiresAt: "2026-08-31T10:00:00Z",
        createdAt: "2026-08-24T10:00:00Z",
      });
      // Garantir que token não existe
      expect("token" in invites[0]).toBe(false);
    });
  });

  describe("adminSetCanCreateFarm (A4)", () => {
    it("chama a RPC de mutação com parâmetros corretos e retorna resultado estruturado", async () => {
      const mockClient = {
        rpc: vi.fn().mockResolvedValue({
          data: [
            {
              user_id: "u-99",
              previous_can_create_farm: true,
              can_create_farm: false,
              changed: true,
            },
          ],
          error: null,
        }),
      } as unknown as Pick<SupabaseClient, "rpc">;

      const res = await adminSetCanCreateFarm("u-99", false, mockClient);

      expect(mockClient.rpc).toHaveBeenCalledWith("admin_set_can_create_farm", {
        _target_user_id: "u-99",
        _can_create: false,
      });

      expect(res).toEqual({
        userId: "u-99",
        previousCanCreateFarm: true,
        canCreateFarm: false,
        changed: true,
      });
    });

    it("lança AdminApiError FORBIDDEN quando acesso é negado", async () => {
      const mockClient = {
        rpc: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "42501", message: "Forbidden: Access denied" },
        }),
      } as unknown as Pick<SupabaseClient, "rpc">;

      await expect(adminSetCanCreateFarm("u-99", true, mockClient)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // A5 — PAGINAÇÃO: limite+1 sentinela (sem COUNT(*) pesado)
  // Prova que hasNextPage nunca produz falso positivo na última página exata
  // ────────────────────────────────────────────────────────────────────────
  describe("A5: paginação sentinela limit+1 — matriz de limites", () => {
    const PAGE_SIZE = 25;

    function buildUserRows(count: number) {
      return Array.from({ length: count }, (_, i) => ({
        id: `u-${i}`,
        email: `user${i}@test.local`,
        display_name: `User ${i}`,
        can_create_farm: true,
        created_at: "2026-08-24T10:00:00Z",
        last_sign_in_at: null,
        farms_count: "0",
      }));
    }

    const cases = [
      { label: "0 registros", backendCount: 0, expectHasNext: false },
      { label: "1 registro", backendCount: 1, expectHasNext: false },
      { label: "PAGE_SIZE - 1 registros", backendCount: PAGE_SIZE - 1, expectHasNext: false },
      // Última página com exatamente PAGE_SIZE → sem next (sentinela não aparece)
      { label: "PAGE_SIZE registros (última página exata)", backendCount: PAGE_SIZE, expectHasNext: false },
      // Backend retorna PAGE_SIZE+1 → há próxima página
      { label: "PAGE_SIZE + 1 registros (tem próxima página)", backendCount: PAGE_SIZE + 1, expectHasNext: true },
    ];

    for (const { label, backendCount, expectHasNext } of cases) {
      it(`${label} → hasNextPage=${expectHasNext}`, async () => {
        const mockClient = {
          rpc: vi.fn().mockResolvedValue({
            data: buildUserRows(backendCount),
            error: null,
          }),
        } as unknown as Pick<SupabaseClient, "rpc">;

        // Simula o padrão limit+1 adotado pelos tabs
        const data = await fetchPlatformUsers({ limit: PAGE_SIZE + 1, offset: 0 }, mockClient);
        const displayed = data.slice(0, PAGE_SIZE);
        const hasNextPage = data.length > PAGE_SIZE;

        expect(hasNextPage).toBe(expectHasNext);
        // Nunca exibe mais do que PAGE_SIZE registros
        expect(displayed.length).toBeLessThanOrEqual(PAGE_SIZE);
      });
    }
  });
});
