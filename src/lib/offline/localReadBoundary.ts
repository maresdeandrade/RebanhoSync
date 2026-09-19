import { supabase } from "@/lib/supabase";

import {
  evaluateLocalOwnership,
  LocalOwnershipError,
  type LocalOwnershipDecision,
} from "./ownership";

export type TenantSensitiveReadTable = string;

export type GlobalReadTable = string;

type AuthSessionLike = {
  user?: {
    id?: string;
  } | null;
  access_token?: string;
} | null;

export async function getCurrentLocalReadOwnership(): Promise<LocalOwnershipDecision> {
  if (!supabase.auth?.getSession) {
    return evaluateLocalOwnership(null);
  }
  const sessionResult = await supabase.auth.getSession();
  const session = sessionResult.data.session as AuthSessionLike;
  const currentUserId = session?.user?.id ?? null;
  const decision = await evaluateLocalOwnership(currentUserId);
  if (
    decision.status === "UNKNOWN" &&
    !currentUserId &&
    typeof session?.access_token === "string"
  ) {
    return {
      status: "OWNED",
      ownerUserId: null,
      currentUserId: null,
    };
  }
  return decision;
}

export async function canReadLocalData(): Promise<boolean> {
  const decision = await getCurrentLocalReadOwnership();
  return decision.status === "OWNED";
}

export async function canReadLocalTable(tableName: string): Promise<boolean> {
  if (isGlobalReadTable(tableName)) return true;
  if (!isTenantSensitiveReadTable(tableName)) return false;
  return canReadLocalData();
}

export async function readTenantSensitiveTable<T>(
  tableName: string,
  read: () => Promise<T>,
): Promise<T | undefined> {
  if (!isTenantSensitiveReadTable(tableName)) return undefined;
  return readTenantSensitive(read);
}

export async function requireTenantSensitiveRead(): Promise<void> {
  const decision = await getCurrentLocalReadOwnership();
  if (decision.status !== "OWNED") {
    throw new LocalOwnershipError(decision);
  }
}

export async function requireTenantSensitiveWrite(): Promise<void> {
  await requireTenantSensitiveRead();
}

export async function requireTenantSensitiveAccess(): Promise<void> {
  await requireTenantSensitiveRead();
}

export async function withTenantSensitiveRead<T>(
  read: () => Promise<T>,
): Promise<T | undefined> {
  try {
    await requireTenantSensitiveRead();
  } catch (error) {
    if (error instanceof LocalOwnershipError) return undefined;
    throw error;
  }

  return read();
}

export async function readTenantSensitive<T>(
  read: () => Promise<T>,
): Promise<T | undefined> {
  return withTenantSensitiveRead(read);
}

export function isTenantSensitiveReadTable(
  tableName: string,
): tableName is TenantSensitiveReadTable {
  return (
    tableName.startsWith("state_") ||
    tableName.startsWith("event_") ||
    tableName.startsWith("ops_sanitario_") ||
    tableName === "sync_pull_cursors" ||
    tableName === "sync_reconcile_obligations" ||
    tableName.startsWith("queue_") ||
    tableName === "metrics_events"
  );
}

export function isGlobalReadTable(
  tableName: string,
): tableName is GlobalReadTable {
  return tableName.startsWith("catalog_");
}