import Dexie from "dexie";

import { removeActiveFarmId } from "@/lib/storage";

import { db } from "./db";
import { evaluateLocalOwnership, type LocalOwnershipStatus } from "./ownership";
import { stopSyncWorker } from "./syncWorker";

export const UNKNOWN_LOCAL_RESET_CONFIRMATION =
  "DELETE_UNVERIFIABLE_LOCAL_DATABASE";

export type UnknownLocalResetResult = "CANCELLED" | "DATABASE_DELETED";

export class UnknownLocalResetError extends Error {
  readonly ownershipStatus: LocalOwnershipStatus;

  constructor(ownershipStatus: LocalOwnershipStatus) {
    super(`Unknown local reset unavailable: ${ownershipStatus}`);
    this.name = "UnknownLocalResetError";
    this.ownershipStatus = ownershipStatus;
  }
}

function reloadApplication() {
  if (typeof window !== "undefined") window.location.reload();
}

export async function resetUnknownLocalDatabase(options: {
  confirmation?: string;
  reload?: () => void;
} = {}): Promise<UnknownLocalResetResult> {
  if (options.confirmation !== UNKNOWN_LOCAL_RESET_CONFIRMATION) {
    return "CANCELLED";
  }

  const ownership = await evaluateLocalOwnership(null);
  if (ownership.status !== "UNKNOWN") {
    throw new UnknownLocalResetError(ownership.status);
  }

  stopSyncWorker();

  const databaseName = db.name;
  db.close();
  await Dexie.delete(databaseName);

  removeActiveFarmId();
  (options.reload ?? reloadApplication)();

  return "DATABASE_DELETED";
}
