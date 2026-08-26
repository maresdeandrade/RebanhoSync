export type AdminErrorCode = "FORBIDDEN" | "OFFLINE" | "NETWORK" | "UNKNOWN";

export class AdminApiError extends Error {
  readonly code: AdminErrorCode;
  readonly originalError?: unknown;

  constructor(code: AdminErrorCode, message: string, originalError?: unknown) {
    super(message);
    this.name = "AdminApiError";
    this.code = code;
    this.originalError = originalError;
  }
}

export interface PlatformMetrics {
  totalUsers: number;
  newUsers30d: number;
  totalFarms: number;
  totalActiveAnimals: number;
  pendingValidInvites: number;
}

export interface PlatformUserListItem {
  id: string;
  email: string;
  displayName: string | null;
  canCreateFarm: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  farmsCount: number;
}

export interface PlatformUserFarmMembership {
  fazenda_id: string;
  fazenda_nome: string;
  role: "owner" | "manager" | "cowboy";
  is_primary: boolean;
  accepted_at: string | null;
}

export interface PlatformUserDetail {
  id: string;
  email: string;
  displayName: string | null;
  phone: string | null;
  canCreateFarm: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  farms: PlatformUserFarmMembership[];
}

export interface PlatformFarmListItem {
  id: string;
  nome: string;
  codigo: string | null;
  municipio: string | null;
  estado: string | null;
  areaTotalHa: number | null;
  createdAt: string;
  ownerId: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  activeAnimalsCount: number;
  membersCount: number;
}

export interface PlatformInviteListItem {
  id: string;
  fazendaId: string;
  fazendaNome: string;
  invitedBy: string;
  inviterName: string | null;
  inviterEmail: string | null;
  email: string | null;
  phone: string | null;
  role: "owner" | "manager" | "cowboy";
  status: "pending" | "accepted" | "rejected" | "cancelled";
  isExpired: boolean;
  expiresAt: string;
  createdAt: string;
}

export type InviteStatusFilter =
  | "all"
  | "pending"
  | "expired"
  | "accepted"
  | "rejected"
  | "cancelled";

export interface AdminSetCanCreateFarmResult {
  userId: string;
  previousCanCreateFarm: boolean;
  canCreateFarm: boolean;
  changed: boolean;
}
