import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { db, LOCAL_OWNERSHIP_KEY, type LocalOwnership } from "./db";
import { requireLocalOwnership } from "./ownership";

type FarmAccess = NonNullable<LocalOwnership["verified_farms"]>[string];
export type OfflineFarmRole = NonNullable<FarmAccess["role"]>;

export function isConnectivityFailure(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const { status, message } = error as { status?: number; message?: string };
  return (!status || status === 0) && /failed to fetch|fetch failed|network|load failed|offline/i.test(message ?? "");
}

export async function rememberVerifiedFarm(
  userId: string, farmId: string, role: FarmAccess["role"],
  metadata?: Record<string, unknown> | null,
  isCurrent: (owner: LocalOwnership) => boolean = () => true,
) {
  await db.transaction("rw", db.local_ownership, async () => {
    await requireLocalOwnership(userId);
    const owner = (await db.local_ownership.get(LOCAL_OWNERSHIP_KEY))!;
    if (!isCurrent(owner)) return;
    const previous = owner.verified_farms?.[farmId];
    await db.local_ownership.update(LOCAL_OWNERSHIP_KEY, {
      verified_farms: { ...owner.verified_farms, [farmId]: {
        ...previous, role, verified_at: new Date().toISOString(),
        ...(metadata === undefined ? {} : { metadata }),
      } },
    });
  });
}

export async function recoverOfflineFarm(userId: string, farmId: string) {
  return db.transaction("rw", db.local_ownership, async () => {
    await requireLocalOwnership(userId);
    const owner = (await db.local_ownership.get(LOCAL_OWNERSHIP_KEY))!;
    const access = owner.verified_farms?.[farmId];
    if (!access?.verified_at || !["owner", "manager", "cowboy"].includes(access.role ?? "")) return null;
    // This snapshot authorizes local continuity only. Keep the remote barrier
    // across restarts and subsequent batches until logout, never as a grant.
    await db.local_ownership.update(LOCAL_OWNERSHIP_KEY, { offline_revalidation_required: true });
    return access;
  });
}

export async function forgetOfflineFarms(userId: string) {
  await db.transaction("rw", db.local_ownership, async () => {
    const owner = await db.local_ownership.get(LOCAL_OWNERSHIP_KEY);
    if (owner?.owner_user_id === userId) {
      await db.local_ownership.update(LOCAL_OWNERSHIP_KEY, {
        verified_farms: {}, offline_revalidation_required: true,
        farm_access_revision: (owner.farm_access_revision ?? 0) + 1,
      });
    }
  });
}

export async function revalidateRecoveredFarmForSync(session: Session, farmId: string) {
  const owner = await db.local_ownership.get(LOCAL_OWNERSHIP_KEY);
  // The existing online path still uses Edge Auth/RLS. Once local permissions
  // have been recovered offline, every subsequent batch additionally revalidates
  // them before transmission, including after another worker restart.
  if (!owner?.offline_revalidation_required) return;
  await requireLocalOwnership(session.user.id);
  const { data, error } = await supabase.auth.getUser();
  if (isConnectivityFailure(error)) throw new Error("Failed to fetch remote session authorization");
  if (error || data.user?.id !== session.user.id) {
    throw new Error("HTTP 401 - remote session revalidation required");
  }
  const result = await supabase.from("user_fazendas").select("role")
    .eq("user_id", session.user.id).eq("fazenda_id", farmId)
    .is("deleted_at", null).maybeSingle();
  if (result.error) throw new Error("Failed to fetch remote farm authorization");
  const role = result.data?.role;
  const validRole = role === "owner" || role === "manager" || role === "cowboy" ? role : null;
  const current = await supabase.auth.getSession();
  if (current.data.session?.user.id !== session.user.id) throw new Error("HTTP 401 - auth context changed");
  await requireLocalOwnership(session.user.id);
  const revision = owner.farm_access_revision ?? 0;
  await rememberVerifiedFarm(session.user.id, farmId, validRole, undefined,
    latest => (latest.farm_access_revision ?? 0) === revision);
  const latest = await db.local_ownership.get(LOCAL_OWNERSHIP_KEY);
  if ((latest?.farm_access_revision ?? 0) !== revision) throw new Error("HTTP 401 - auth context changed");
  if (!validRole) throw new Error("HTTP 403 - farm access revoked; local operations preserved");
}
