import { db } from "@/lib/offline/db";
import { requireTenantSensitiveAccess } from "@/lib/offline/localReadBoundary";
import type { TelemetryFlushCursor } from "@/lib/offline/types";

const LEGACY_PREFIX = "rebanhosync:telemetry-flush:";

function isLegacyTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

function isLegacyIds(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(id => typeof id === "string" && id.length > 0);
}

function legacyCursor(fazendaId: string): TelemetryFlushCursor | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const value = JSON.parse(localStorage.getItem(`${LEGACY_PREFIX}${fazendaId}`) ?? "null");
    if (!value || !isLegacyTimestamp(value.createdAt) || !isLegacyIds(value.idsAtCursor)) return null;
    return {
      fazenda_id: fazendaId, created_at: value.createdAt,
      ids_at_cursor: [...new Set<string>(value.idsAtCursor)], updated_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function removeLegacyCursor(fazendaId: string) {
  try {
    if (typeof localStorage !== "undefined") localStorage.removeItem(`${LEGACY_PREFIX}${fazendaId}`);
  } catch {
    // Cleanup is optional. A committed durable cursor always wins over legacy storage.
  }
}

export async function readTelemetryFlushCursor(fazendaId: string): Promise<TelemetryFlushCursor | null> {
  await requireTenantSensitiveAccess();
  const current = await db.telemetry_flush_cursors.get(fazendaId);
  if (current) return current;
  const legacy = legacyCursor(fazendaId);
  if (!legacy) return null;
  await requireTenantSensitiveAccess();
  const migrated = await db.transaction("rw", db.telemetry_flush_cursors, async () => {
    // Another tab may have confirmed or imported this farm while ownership was checked.
    const existing = await db.telemetry_flush_cursors.get(fazendaId);
    if (existing) return existing;
    await db.telemetry_flush_cursors.put(legacy);
    return legacy;
  });
  removeLegacyCursor(fazendaId);
  return migrated;
}

export async function writeTelemetryFlushCursor(fazendaId: string, createdAt: string, ids: string[]): Promise<void> {
  await requireTenantSensitiveAccess();
  await db.transaction("rw", db.telemetry_flush_cursors, async () => {
    const previous = await db.telemetry_flush_cursors.get(fazendaId);
    if (previous && previous.created_at > createdAt) return;
    const idsAtCursor = previous?.created_at === createdAt
      ? [...new Set([...previous.ids_at_cursor, ...ids])]
      : [...new Set(ids)];
    await db.telemetry_flush_cursors.put({
      fazenda_id: fazendaId, created_at: createdAt, ids_at_cursor: idsAtCursor,
      updated_at: new Date().toISOString(),
    });
  });
  // No success is returned before the IndexedDB transaction has committed.
  removeLegacyCursor(fazendaId);
}
