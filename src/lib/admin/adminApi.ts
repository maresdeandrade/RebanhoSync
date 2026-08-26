import { supabase } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AdminApiError,
  type AdminSetCanCreateFarmResult,
  type InviteStatusFilter,
  type PlatformFarmListItem,
  type PlatformInviteListItem,
  type PlatformMetrics,
  type PlatformUserDetail,
  type PlatformUserFarmMembership,
  type PlatformUserListItem,
} from "./adminTypes";

interface RawPlatformMetricsRow {
  total_users: string | number;
  new_users_30d: string | number;
  total_farms: string | number;
  total_active_animals: string | number;
  pending_valid_invites: string | number;
}

interface RawPlatformUserRow {
  id: string;
  email: string;
  display_name?: string | null;
  can_create_farm?: boolean | null;
  created_at: string;
  last_sign_in_at?: string | null;
  farms_count?: string | number;
}

interface RawPlatformUserDetailRow {
  id: string;
  email: string;
  display_name?: string | null;
  phone?: string | null;
  can_create_farm?: boolean | null;
  is_superadmin?: boolean | null;
  created_at: string;
  last_sign_in_at?: string | null;
  farms?: PlatformUserFarmMembership[];
}

interface RawPlatformFarmRow {
  id: string;
  nome: string;
  codigo?: string | null;
  municipio?: string | null;
  estado?: string | null;
  area_total_ha?: string | number | null;
  created_at: string;
  owner_id?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  active_animals_count?: string | number;
  members_count?: string | number;
}

interface RawPlatformInviteRow {
  id: string;
  fazenda_id: string;
  fazenda_nome: string;
  invited_by: string;
  inviter_name?: string | null;
  inviter_email?: string | null;
  email?: string | null;
  phone?: string | null;
  role: "owner" | "manager" | "cowboy";
  status: "pending" | "accepted" | "rejected" | "cancelled";
  is_expired?: boolean;
  expires_at: string;
  created_at: string;
}

interface RawSetCanCreateFarmRow {
  user_id: string;
  previous_can_create_farm: boolean;
  can_create_farm: boolean;
  changed: boolean;
}

function isDeviceOffline(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.onLine === "boolean" && !navigator.onLine;
}

/**
 * Converte erros do cliente ou do Supabase em instâncias de AdminApiError.
 *
 * Ordem de precedência (hardened — A5):
 * 1. AdminApiError já tipado → retorna diretamente (idempotente)
 * 2. Código explícito de autorização/backend (42501, Forbidden, Access denied, permission denied)
 *    — deve ter prioridade MESMO se navigator.onLine mudar para false durante o tratamento
 * 3. Erros HTTP/RPC conhecidos de rede (Failed to fetch, NetworkError, 503, 504)
 * 4. Dispositivo offline (fallback de rede quando nenhum código explícito precedeu)
 * 5. UNKNOWN — qualquer outro erro não classificado
 */
export function parseAdminError(error: unknown): AdminApiError {
  // 1. Já é uma instância tipada — retorna sem reprocessar
  if (error instanceof AdminApiError) {
    return error;
  }

  const errObj = error as { code?: string; message?: string; status?: number };
  const message = errObj?.message ?? (error instanceof Error ? error.message : "Erro inesperado");
  const code = errObj?.code;

  // 2. Código explícito de autorização do backend — prioridade máxima
  //    42501 recebido pelo backend = FORBIDDEN, independente de navigator.onLine
  if (
    code === "42501" ||
    message.includes("Forbidden") ||
    message.includes("Access denied") ||
    message.includes("permission denied")
  ) {
    return new AdminApiError("FORBIDDEN", "Acesso não autorizado ao recurso administrativo", error);
  }

  // 3. Erros de transporte HTTP/RPC conhecidos
  if (
    message.includes("Failed to fetch") ||
    message.includes("NetworkError") ||
    message.includes("network") ||
    errObj?.status === 0 ||
    errObj?.status === 503 ||
    errObj?.status === 504
  ) {
    return new AdminApiError("NETWORK", "Falha de comunicação com o servidor", error);
  }

  // 4. Dispositivo offline — fallback quando não há código explícito acima
  if (isDeviceOffline()) {
    return new AdminApiError("OFFLINE", "Dispositivo sem conexão com a internet", error);
  }

  // 5. UNKNOWN — erro não classificado
  return new AdminApiError("UNKNOWN", message, error);
}

/**
 * Consulta a RPC is_app_admin para verificar se o usuário é SuperAdmin.
 */
export async function checkIsSuperAdmin(
  client: Pick<SupabaseClient, "rpc" | "auth"> = supabase,
): Promise<boolean> {
  try {
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData?.user) {
      return false;
    }

    const { data, error } = await client.rpc("is_app_admin");
    if (error) {
      return false;
    }

    return data === true;
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn("[adminApi] checkIsSuperAdmin error:", err);
    }
    return false;
  }
}

/**
 * Busca KPIs agregados globais da plataforma.
 */
export async function fetchPlatformMetrics(
  client: Pick<SupabaseClient, "rpc"> = supabase,
): Promise<PlatformMetrics> {
  if (isDeviceOffline()) {
    throw new AdminApiError("OFFLINE", "Dispositivo offline");
  }

  try {
    const { data, error } = await client.rpc("admin_get_platform_metrics");
    if (error) {
      throw parseAdminError(error);
    }

    if (!data || data.length === 0) {
      return {
        totalUsers: 0,
        newUsers30d: 0,
        totalFarms: 0,
        totalActiveAnimals: 0,
        pendingValidInvites: 0,
      };
    }

    const row = data[0] as RawPlatformMetricsRow;
    return {
      totalUsers: Number(row.total_users ?? 0),
      newUsers30d: Number(row.new_users_30d ?? 0),
      totalFarms: Number(row.total_farms ?? 0),
      totalActiveAnimals: Number(row.total_active_animals ?? 0),
      pendingValidInvites: Number(row.pending_valid_invites ?? 0),
    };
  } catch (err) {
    throw parseAdminError(err);
  }
}

/**
 * Lista usuários da plataforma com paginação server-side e busca debounced.
 */
export async function fetchPlatformUsers(
  params?: { search?: string; limit?: number; offset?: number },
  client: Pick<SupabaseClient, "rpc"> = supabase,
): Promise<PlatformUserListItem[]> {
  if (isDeviceOffline()) {
    throw new AdminApiError("OFFLINE", "Dispositivo offline");
  }

  try {
    const { data, error } = await client.rpc("admin_list_platform_users", {
      search: params?.search?.trim() ? params.search.trim() : null,
      limit_count: params?.limit ?? 50,
      offset_count: params?.offset ?? 0,
    });

    if (error) {
      throw parseAdminError(error);
    }

    if (!data) return [];

    return (data as RawPlatformUserRow[]).map((item) => ({
      id: item.id,
      email: item.email,
      displayName: item.display_name ?? null,
      canCreateFarm: item.can_create_farm ?? true,
      createdAt: item.created_at,
      lastSignInAt: item.last_sign_in_at ?? null,
      farmsCount: Number(item.farms_count ?? 0),
    }));
  } catch (err) {
    throw parseAdminError(err);
  }
}

/**
 * Busca detalhes de um usuário específico com suas memberships em fazendas.
 */
export async function fetchPlatformUserDetail(
  userId: string,
  client: Pick<SupabaseClient, "rpc"> = supabase,
): Promise<PlatformUserDetail> {
  if (isDeviceOffline()) {
    throw new AdminApiError("OFFLINE", "Dispositivo offline");
  }

  try {
    const { data, error } = await client.rpc("admin_get_platform_user", {
      _user_id: userId,
    });

    if (error) {
      throw parseAdminError(error);
    }

    if (!data || data.length === 0) {
      throw new AdminApiError("UNKNOWN", "Usuário não encontrado");
    }

    const row = data[0] as RawPlatformUserDetailRow;
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name ?? null,
      phone: row.phone ?? null,
      canCreateFarm: row.can_create_farm ?? true,
      isSuperAdmin: row.is_superadmin ?? false,
      createdAt: row.created_at,
      lastSignInAt: row.last_sign_in_at ?? null,
      farms: Array.isArray(row.farms) ? row.farms : [],
    };
  } catch (err) {
    throw parseAdminError(err);
  }
}

/**
 * Lista fazendas da plataforma com paginação server-side e busca.
 */
export async function fetchPlatformFarms(
  params?: { search?: string; limit?: number; offset?: number },
  client: Pick<SupabaseClient, "rpc"> = supabase,
): Promise<PlatformFarmListItem[]> {
  if (isDeviceOffline()) {
    throw new AdminApiError("OFFLINE", "Dispositivo offline");
  }

  try {
    const { data, error } = await client.rpc("admin_list_platform_farms", {
      search: params?.search?.trim() ? params.search.trim() : null,
      limit_count: params?.limit ?? 50,
      offset_count: params?.offset ?? 0,
    });

    if (error) {
      throw parseAdminError(error);
    }

    if (!data) return [];

    return (data as RawPlatformFarmRow[]).map((item) => ({
      id: item.id,
      nome: item.nome,
      codigo: item.codigo ?? null,
      municipio: item.municipio ?? null,
      estado: item.estado ?? null,
      areaTotalHa: item.area_total_ha !== null && item.area_total_ha !== undefined ? Number(item.area_total_ha) : null,
      createdAt: item.created_at,
      ownerId: item.owner_id ?? null,
      ownerName: item.owner_name ?? null,
      ownerEmail: item.owner_email ?? null,
      activeAnimalsCount: Number(item.active_animals_count ?? 0),
      membersCount: Number(item.members_count ?? 0),
    }));
  } catch (err) {
    throw parseAdminError(err);
  }
}

/**
 * Lista convites da plataforma com filtros de status e busca.
 */
export async function fetchPlatformInvites(
  params?: {
    statusFilter?: InviteStatusFilter;
    search?: string;
    limit?: number;
    offset?: number;
  },
  client: Pick<SupabaseClient, "rpc"> = supabase,
): Promise<PlatformInviteListItem[]> {
  if (isDeviceOffline()) {
    throw new AdminApiError("OFFLINE", "Dispositivo offline");
  }

  try {
    const filterArg =
      params?.statusFilter && params.statusFilter !== "all"
        ? params.statusFilter
        : null;

    const { data, error } = await client.rpc("admin_list_platform_invites", {
      status_filter: filterArg,
      search: params?.search?.trim() ? params.search.trim() : null,
      limit_count: params?.limit ?? 50,
      offset_count: params?.offset ?? 0,
    });

    if (error) {
      throw parseAdminError(error);
    }

    if (!data) return [];

    return (data as RawPlatformInviteRow[]).map((item) => ({
      id: item.id,
      fazendaId: item.fazenda_id,
      fazendaNome: item.fazenda_nome,
      invitedBy: item.invited_by,
      inviterName: item.inviter_name ?? null,
      inviterEmail: item.inviter_email ?? null,
      email: item.email ?? null,
      phone: item.phone ?? null,
      role: item.role,
      status: item.status,
      isExpired: item.is_expired ?? false,
      expiresAt: item.expires_at,
      createdAt: item.created_at,
    }));
  } catch (err) {
    throw parseAdminError(err);
  }
}

/**
 * Mutação atômica e idempotente da permissão can_create_farm (A4).
 */
export async function adminSetCanCreateFarm(
  targetUserId: string,
  canCreate: boolean,
  client: Pick<SupabaseClient, "rpc"> = supabase,
): Promise<AdminSetCanCreateFarmResult> {
  if (isDeviceOffline()) {
    throw new AdminApiError("OFFLINE", "Dispositivo offline");
  }

  try {
    const { data, error } = await client.rpc("admin_set_can_create_farm", {
      _target_user_id: targetUserId,
      _can_create: canCreate,
    });

    if (error) {
      throw parseAdminError(error);
    }

    if (!data || data.length === 0) {
      throw new AdminApiError("UNKNOWN", "Erro ao atualizar permissão de criação de fazenda");
    }

    const row = data[0] as RawSetCanCreateFarmRow;
    return {
      userId: row.user_id,
      previousCanCreateFarm: row.previous_can_create_farm,
      canCreateFarm: row.can_create_farm,
      changed: row.changed,
    };
  } catch (err) {
    throw parseAdminError(err);
  }
}
