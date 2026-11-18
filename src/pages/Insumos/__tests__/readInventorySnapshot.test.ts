// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  collections,
  createDatabase,
  readers,
  retainedTombstones,
  row,
  seed,
  snapshotKeys,
  statuses,
  type Collection,
} from "./fixtures/inventorySnapshotHarness";

describe.each(Object.entries(readers))(
  "inventory snapshot query: %s",
  (readerName, read) => {
    const includesSanitaryCatalog = readerName === "current";
    let database: ReturnType<typeof createDatabase>;
    beforeEach(async () => {
      database = createDatabase();
      await database.open();
      await seed(database);
    });
    afterEach(async () => {
      vi.restoreAllMocks();
      await database.delete();
    });

    it.each(["A", "B"])(
      "reads the complete snapshot scoped to farm %s and preserves distinct tombstone policies",
      async (farm) => {
        const snapshot = await read(farm, database);
        const snapshotKeysForReader = snapshotKeys.filter(
          (key) => key !== "produtosSanitariosV2" || includesSanitaryCatalog,
        );
        expect(Object.keys(snapshot!).sort()).toEqual(snapshotKeysForReader);
        for (const [key, table] of Object.entries(collections)) {
          if (key === "produtosSanitariosV2" && !includesSanitaryCatalog) continue;
          const collection = key as Collection;
          const expectedFarm =
            key === "produtos" || key === "produtosSanitariosV2"
              ? "global"
              : farm;
          const expected = [row(expectedFarm, key)];
          if (retainedTombstones.has(collection))
            expected.push(row(expectedFarm, key, true));
          expect(snapshot![collection]).toEqual(expected);
          expect(await database.table(table).count()).toBe(
            key === "produtos" || key === "produtosSanitariosV2" ? 2 : 4,
          );
        }
        expect([...snapshot!.pendingTxIds].sort()).toEqual([
          `${farm}-ERROR`,
          `${farm}-PENDING`,
          `${farm}-REJECTED`,
          `${farm}-SYNCING`,
        ]);
      },
    );
    it("makes exactly one indexed read per farm collection and one global catalog read", async () => {
      const reads: Array<{
        table: string;
        index: string;
        lower: unknown;
        upper: unknown;
      }> = [];
      database.close();
      database.use({
        stack: "dbcore",
        name: "trace-reads",
        create: (down) => ({
          ...down,
          table: (name) => {
            const table = down.table(name);
            return {
              ...table,
              query: (req) => {
                reads.push({
                  table: name,
                  index: req.query.index.name,
                  lower: req.query.range.lower,
                  upper: req.query.range.upper,
                });
                return table.query(req);
              },
            };
          },
        }),
      });
      await database.open();
      await read("A", database);
      const expectedTables = [...Object.values(collections), "queue_gestures"].filter(
        (table) => table !== collections.produtosSanitariosV2 || includesSanitaryCatalog,
      );
      expect(reads.map((r) => r.table).sort()).toEqual(expectedTables.sort());
      for (const trace of reads.filter(
        (r) =>
          r.table !== collections.produtos &&
          r.table !== collections.produtosSanitariosV2,
      )) {
        expect(trace).toMatchObject({
          index: "fazenda_id",
          lower: "A",
          upper: "A",
        });
      }
      reads.length = 0;
      expect(await read(null, database)).toBeNull();
      expect(reads).toEqual([]);
    });
    it("returns empty arrays for an absent farm but retains the global catalog", async () => {
      const snapshot = await read("empty", database);
      for (const key of Object.keys(collections) as Collection[]) {
        if (key === "produtosSanitariosV2" && !includesSanitaryCatalog) continue;
        expect(snapshot![key]).toHaveLength(
          key === "produtos" ? 2 : key === "produtosSanitariosV2" ? 1 : 0,
        );
      }
      expect(snapshot!.pendingTxIds.size).toBe(0);
    });
    it.each(statuses)(
      "keeps pending projection membership for %s",
      async (status) => {
        expect(
          (await read("A", database))!.pendingTxIds.has(`A-${status}`),
        ).toBe(!["DONE", "SYNCED"].includes(status));
      },
    );
    it("deduplicates transaction membership without mutating persisted rows", async () => {
      const before = await database.state_insumos.toArray();
      const first = (await read("A", database))!;
      first.insumos[0].payload.preserved = "changed outside Dexie";
      first.insumos.push(first.insumos[0]);
      first.pendingTxIds.add("other");
      const second = (await read("A", database))!;
      expect(second.insumos).toEqual([row("A", "insumos")]);
      expect(second.pendingTxIds.has("other")).toBe(false);
      expect(second.pendingTxIds.size).toBe(4);
      expect(await database.state_insumos.toArray()).toEqual(before);
    });
    it("propagates a real Dexie read failure and recovers after reopen", async () => {
      database.close();
      await expect(read("A", database)).rejects.toMatchObject({
        name: "DatabaseClosedError",
      });
      await database.open();
      expect((await read("A", database))!.insumos).toEqual([
        row("A", "insumos"),
      ]);
    });
  },
);
