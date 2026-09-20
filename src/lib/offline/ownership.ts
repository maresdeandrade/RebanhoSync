import type { Session } from "@supabase/supabase-js";

import {
  db,
  LOCAL_OWNERSHIP_KEY,
  type LocalOwnership,
} from "./db";

export type LocalOwnershipStatus =
  | "UNINITIALIZED"
  | "OWNED"
  | "MISMATCH"
  | "UNKNOWN";

export interface LocalOwnershipDecision {
  status: LocalOwnershipStatus;
  ownerUserId: string | null;
  currentUserId: string | null;
}

export async function requireLocalOwnership(
  currentUserId: string | null,
): Promise<void> {
  const decision = await evaluateLocalOwnership(currentUserId);
  if (decision.status !== "OWNED") {
    throw new LocalOwnershipError(decision);
  }
}

export async function isLocalOwnershipCompatible(
  currentUserId: string | null,
): Promise<boolean> {
  const decision = await evaluateLocalOwnership(currentUserId);
  return decision.status === "OWNED";
}

export class LocalOwnershipError extends Error {
  readonly decision: LocalOwnershipDecision;

  constructor(decision: LocalOwnershipDecision) {
    super(`Local ownership unavailable: ${decision.status}`);
    this.name = "LocalOwnershipError";
    this.decision = decision;
  }
}

export async function getLocalOwnership(): Promise<LocalOwnership | undefined> {
  return db.local_ownership.get(LOCAL_OWNERSHIP_KEY);
}

export async function establishLocalOwnership(
  session: Pick<Session, "user">,
): Promise<LocalOwnershipDecision> {
  const currentUserId = session.user.id;
  const existing = await getLocalOwnership();

  if (!existing) {
    const ownership: LocalOwnership = {
      key: LOCAL_OWNERSHIP_KEY,
      owner_user_id: currentUserId,
      updated_at: new Date().toISOString(),
    };
    await db.local_ownership.put(ownership);
    return { status: "OWNED", ownerUserId: currentUserId, currentUserId };
  }

  if (existing.owner_user_id === null) {
    return {
      status: "UNKNOWN",
      ownerUserId: null,
      currentUserId,
    };
  }

  const status = existing.owner_user_id === currentUserId ? "OWNED" : "MISMATCH";
  return {
    status,
    ownerUserId: existing.owner_user_id,
    currentUserId,
  };
}

export async function evaluateLocalOwnership(
  currentUserId: string | null,
): Promise<LocalOwnershipDecision> {
  const existing = await getLocalOwnership();
  if (!existing) {
    return {
      status: "UNKNOWN",
      ownerUserId: null,
      currentUserId,
    };
  }

  if (!currentUserId) {
    return {
      status: existing.owner_user_id === null ? "UNKNOWN" : "MISMATCH",
      ownerUserId: existing.owner_user_id,
      currentUserId,
    };
  }

  return {
    status:
      existing.owner_user_id === null
        ? "UNKNOWN"
        : existing.owner_user_id === currentUserId
          ? "OWNED"
          : "MISMATCH",
    ownerUserId: existing.owner_user_id,
    currentUserId,
  };
}
