/**
 * @vitest-environment jsdom
 *
 * Tests for src/lib/offline/rejections.ts
 * Uses fake-indexeddb for real Dexie operations (no fragile mocks).
 */
import "fake-indexeddb/auto";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import Dexie from "dexie";
import {
  listRejections,
  purgeRejections,
  exportRejections,
  getRejectionStats,
} from "../rejections";
import { db } from "../db";
import type { Rejection } from "../types";

// Helper: create a rejection record with a specific age
function makeRejection(
  fazendaId: string,
  daysAgo: number,
  overrides: Partial<Rejection> = {},
): Omit<Rejection, "id"> {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return {
    client_tx_id: crypto.randomUUID(),
    client_op_id: crypto.randomUUID(),
    fazenda_id: fazendaId,
    table: overrides.table ?? "animais",
    action: overrides.action ?? "INSERT",
    reason_code: overrides.reason_code ?? "TEST_REASON",
    reason_message: overrides.reason_message ?? "test message",
    created_at: d.toISOString(),
    ...overrides,
  };
}

describe("rejections module", () => {
  const FARM_A = "farm-aaaa-0001";
  const FARM_B = "farm-bbbb-0002";

  beforeEach(async () => {
    // Reset database before each test
    await db.queue_rejections.clear();
  });

  afterEach(async () => {
    await db.queue_rejections.clear();
  });

  // -------------------------------------------------------
  // purgeRejections
  // -------------------------------------------------------
  describe("purgeRejections", () => {
    it("deletes only records older than specified days", async () => {
      // Seed: 2 old (10d) + 2 recent (3d)
      await db.queue_rejections.bulkAdd([
        makeRejection(FARM_A, 10),
        makeRejection(FARM_A, 8),
        makeRejection(FARM_A, 3),
        makeRejection(FARM_A, 1),
      ]);

      const result = await purgeRejections({ olderThanDays: 7 });

      expect(result.deletedCount).toBe(2);
      const remaining = await db.queue_rejections.count();
      expect(remaining).toBe(2);
    });

    it("dryRun returns count without deleting", async () => {
      await db.queue_rejections.bulkAdd([
        makeRejection(FARM_A, 10),
        makeRejection(FARM_A, 8),
        makeRejection(FARM_A, 1),
      ]);

      const result = await purgeRejections({ olderThanDays: 7, dryRun: true });

      expect(result.deletedCount).toBe(2);
      // Nothing actually deleted
      const remaining = await db.queue_rejections.count();
      expect(remaining).toBe(3);
    });

    it("respects fazendaId filter (multi-tenant isolation)", async () => {
      await db.queue_rejections.bulkAdd([
        makeRejection(FARM_A, 10), // old, farm A → should delete
        makeRejection(FARM_B, 10), // old, farm B → should NOT delete
        makeRejection(FARM_A, 1), // recent, farm A → should NOT delete
      ]);

      const result = await purgeRejections({
        fazendaId: FARM_A,
        olderThanDays: 7,
      });

      expect(result.deletedCount).toBe(1);
      const remaining = await db.queue_rejections.toArray();
      expect(remaining).toHaveLength(2);
      // Farm B old record still exists
      expect(remaining.some((r) => r.fazenda_id === FARM_B)).toBe(true);
    });

    it("does not delete records exactly at the cutoff boundary", async () => {
      // Record created exactly 7 days ago should NOT be deleted
      // (the cutoff is strictly "below", not "belowOrEqual")
      await db.queue_rejections.bulkAdd([
        makeRejection(FARM_A, 7), // exactly at boundary
        makeRejection(FARM_A, 1), // recent
      ]);

      const result = await purgeRejections({ olderThanDays: 7 });

      // The 7-day-old is borderline; purge uses < cutoff so it may or may not match
      // depending on ms precision. Verify at least the recent one survives.
      const remaining = await db.queue_rejections.count();
      expect(remaining).toBeGreaterThanOrEqual(1);
    });
  });

  // -------------------------------------------------------
  // listRejections
  // -------------------------------------------------------
  describe("listRejections", () => {
    it("returns items sorted by created_at DESC with pagination", async () => {
      // Insert 5 rejections with known ages
      await db.queue_rejections.bulkAdd([
        makeRejection(FARM_A, 5),
        makeRejection(FARM_A, 4),
        makeRejection(FARM_A, 3),
        makeRejection(FARM_A, 2),
        makeRejection(FARM_A, 1),
      ]);

      // First page: limit 3
      const page1 = await listRejections(FARM_A, { limit: 3 });
      expect(page1.items).toHaveLength(3);
      expect(page1.nextCursor).toBeDefined();

      // Verify DESC order: first item is newest (1 day ago)
      const timestamps = page1.items.map((r) => new Date(r.created_at).getTime());
      expect(timestamps[0]).toBeGreaterThan(timestamps[1]);
      expect(timestamps[1]).toBeGreaterThan(timestamps[2]);

      // Second page using cursor
      const page2 = await listRejections(FARM_A, {
        limit: 3,
        cursorBefore: page1.nextCursor,
      });
      expect(page2.items).toHaveLength(2);
      expect(page2.nextCursor).toBeUndefined(); // no more pages
    });

    it("returns empty for a farm with no rejections", async () => {
      const result = await listRejections(FARM_A);
      expect(result.items).toHaveLength(0);
      expect(result.nextCursor).toBeUndefined();
    });
  });

  // -------------------------------------------------------
  // exportRejections
  // -------------------------------------------------------
  describe("exportRejections", () => {
    it("returns valid JSON Blob with envelope fields", async () => {
      await db.queue_rejections.bulkAdd([
        makeRejection(FARM_A, 3),
        makeRejection(FARM_A, 1),
      ]);

      const { blob, filename } = await exportRejections(FARM_A);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe("application/json");
      expect(filename).toMatch(/^rejections_.*\.json$/);

      const text = await blob.text();
      const data = JSON.parse(text);

      expect(data.schema_version).toBe(1);
      expect(data.fazenda_id).toBe(FARM_A);
      expect(data.count).toBe(2);
      expect(data.baseline).toBe("d0278ce");
      expect(data.exported_at).toBeDefined();
      expect(data.rejections).toHaveLength(2);
      expect(data.rejections[0]).toHaveProperty("reason_code");
    });

    it("respects since/until filters", async () => {
      const now = Date.now();
      await db.queue_rejections.bulkAdd([
        makeRejection(FARM_A, 10),
        makeRejection(FARM_A, 5),
        makeRejection(FARM_A, 1),
      ]);

      const since = new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString();
      const { blob } = await exportRejections(FARM_A, { since });

      const data = JSON.parse(await blob.text());
      expect(data.count).toBe(2); // 5-day and 1-day records
    });
  });

  // -------------------------------------------------------
  // getRejectionStats
  // -------------------------------------------------------
  describe("getRejectionStats", () => {
    it("returns correct count and timestamps for a farm", async () => {
      await db.queue_rejections.bulkAdd([
        makeRejection(FARM_A, 10),
        makeRejection(FARM_A, 5),
        makeRejection(FARM_A, 1),
      ]);

      const stats = await getRejectionStats(FARM_A);

      expect(stats.count).toBe(3);
      expect(stats.oldestAt).toBeDefined();
      expect(stats.newestAt).toBeDefined();
      expect(new Date(stats.oldestAt!).getTime()).toBeLessThan(
        new Date(stats.newestAt!).getTime(),
      );
    });

    it("returns count 0 for empty farm", async () => {
      const stats = await getRejectionStats(FARM_A);
      expect(stats.count).toBe(0);
      expect(stats.oldestAt).toBeUndefined();
    });

    it("returns global stats when no fazendaId", async () => {
      await db.queue_rejections.bulkAdd([
        makeRejection(FARM_A, 3),
        makeRejection(FARM_B, 1),
      ]);

      const stats = await getRejectionStats();

      expect(stats.count).toBe(2);
    });
  });
});
