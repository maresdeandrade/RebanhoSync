import { db } from "./db";
import type { Rejection } from "./types";

// =========================================================
// REJECTIONS API — DLQ management for queue_rejections
// TD-001 (M0): list, export, purge (TTL), stats
//
// Design goals:
// - Index-backed queries only (no sortBy / no full scans by default)
// - Cursor pagination by created_at (DESC)
// - Purge uses primaryKeys() to avoid loading full records into memory
// - Safe handling of missing ids / missing created_at (backfill should exist, but be defensive)
// =========================================================

const DEFAULT_BASELINE = "d0278ce";

// ---------------------------------------------------------
// listRejections — cursor-based pagination, DESC by created_at
// Uses compound index [fazenda_id+created_at].
// ---------------------------------------------------------

export interface ListRejectionsOpts {
  limit?: number;
  /** ISO string cursor: load items BEFORE this timestamp */
  cursorBefore?: string;
}

export interface ListRejectionsResult {
  items: Rejection[];
  nextCursor?: string;
}

export async function listRejections(
  fazendaId: string,
  opts: ListRejectionsOpts = {},
): Promise<ListRejectionsResult> {
  const limit = opts.limit ?? 20;

  const collection = opts.cursorBefore
    ? // Range: [fazendaId, ""] .. [fazendaId, cursorBefore) (exclusive upper bound)
      db.queue_rejections
        .where("[fazenda_id+created_at]")
        .between([fazendaId, ""], [fazendaId, opts.cursorBefore], true, false)
        .reverse()
    : // Full range for farm (DESC)
      db.queue_rejections
        .where("[fazenda_id+created_at]")
        .between([fazendaId, ""], [fazendaId, "\uffff"], true, true)
        .reverse();

  // +1 to detect "has more"
  const items = await collection.limit(limit + 1).toArray();
  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;

  const last = page[page.length - 1];

  return {
    items: page,
    nextCursor: hasMore ? last?.created_at ?? undefined : undefined,
  };
}

// ---------------------------------------------------------
// getRejectionStats — lightweight stats via index queries
// ---------------------------------------------------------

export interface RejectionStats {
  count: number;
  oldestAt?: string;
  newestAt?: string;
}

export async function getRejectionStats(
  fazendaId?: string,
): Promise<RejectionStats> {
  if (fazendaId) {
    const range = db.queue_rejections
      .where("[fazenda_id+created_at]")
      .between([fazendaId, ""], [fazendaId, "\uffff"], true, true);

    const count = await range.count();
    if (count === 0) return { count: 0 };

    // Compound index is ASC by created_at within farm:
    // first() = oldest, last() = newest
    const [oldest, newest] = await Promise.all([range.first(), range.last()]);

    return {
      count,
      oldestAt: oldest?.created_at,
      newestAt: newest?.created_at,
    };
  }

  // Global stats: requires created_at index to exist.
  const count = await db.queue_rejections.count();
  if (count === 0) return { count: 0 };

  const [oldest, newest] = await Promise.all([
    db.queue_rejections.orderBy("created_at").first(),
    db.queue_rejections.orderBy("created_at").last(),
  ]);

  return {
    count,
    oldestAt: oldest?.created_at,
    newestAt: newest?.created_at,
  };
}

// ---------------------------------------------------------
// exportRejections — JSON envelope with Blob for download
// ---------------------------------------------------------

export interface ExportRejectionsOpts {
  since?: string;
  until?: string;
  /** override baseline for the export envelope (optional) */
  baseline?: string;
}

export async function exportRejections(
  fazendaId: string,
  opts: ExportRejectionsOpts = {},
): Promise<{ blob: Blob; filename: string }> {
  const lower = opts.since ?? "";
  const upper = opts.until ?? "\uffff";

  // Note: export is intentionally allowed to read all matching records.
  // TTL keeps the dataset bounded; UI can optionally provide since/until.
  const rejections = await db.queue_rejections
    .where("[fazenda_id+created_at]")
    .between([fazendaId, lower], [fazendaId, upper], true, true)
    .toArray();

  const envelope = {
    schema_version: 1,
    exported_at: new Date().toISOString(),
    baseline: opts.baseline ?? DEFAULT_BASELINE,
    fazenda_id: fazendaId,
    count: rejections.length,
    filters: {
      since: opts.since ?? null,
      until: opts.until ?? null,
    },
    rejections,
  };

  const json = JSON.stringify(envelope, null, 2);
  const blob = new Blob([json], { type: "application/json" });

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `rejections_${fazendaId.slice(0, 8)}_${dateStr}_${rejections.length}.json`;

  return { blob, filename };
}

// ---------------------------------------------------------
// purgeRejections — TTL-based deletion with optional dryRun
// Uses primaryKeys() (lighter than toArray()).
// ---------------------------------------------------------

export interface PurgeRejectionsOpts {
  fazendaId?: string;
  olderThanDays: number;
  dryRun?: boolean;
}

export interface PurgeRejectionsResult {
  deletedCount: number;
  oldestRemainingAt?: string;
}

export async function purgeRejections(
  opts: PurgeRejectionsOpts,
): Promise<PurgeRejectionsResult> {
  const cutoffISO = new Date(
    Date.now() - opts.olderThanDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Prefer fetching only primary keys to avoid pulling full rows into memory.
  const keys = opts.fazendaId
    ? await db.queue_rejections
        .where("[fazenda_id+created_at]")
        .between([opts.fazendaId, ""], [opts.fazendaId, cutoffISO], true, false)
        .primaryKeys()
    : await db.queue_rejections.where("created_at").below(cutoffISO).primaryKeys();

  // Defensive: filter to numeric ids only
  const toDeleteIds = (keys as Array<number | unknown>).filter(
    (k): k is number => typeof k === "number",
  );

  if (!opts.dryRun && toDeleteIds.length > 0) {
    await db.queue_rejections.bulkDelete(toDeleteIds);
  }

  // Find oldest remaining record (use indexes)
  let oldestRemainingAt: string | undefined;
  if (opts.fazendaId) {
    const oldest = await db.queue_rejections
      .where("[fazenda_id+created_at]")
      .between([opts.fazendaId, ""], [opts.fazendaId, "\uffff"], true, true)
      .first();
    oldestRemainingAt = oldest?.created_at;
  } else {
    const oldest = await db.queue_rejections.orderBy("created_at").first();
    oldestRemainingAt = oldest?.created_at;
  }

  return { deletedCount: toDeleteIds.length, oldestRemainingAt };
}

// ---------------------------------------------------------
// triggerDownload — browser helper to save Blob as file
// ---------------------------------------------------------

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}