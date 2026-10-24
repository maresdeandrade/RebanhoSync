// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { Component, type ReactNode, useEffect } from "react";
import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  collections,
  createDatabase,
  deferred,
  hooks,
  seed,
} from "./fixtures/inventorySnapshotHarness";
import type { InventorySnapshot } from "../types";

class QueryBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <span role="alert">{this.state.error.name}</span>
    ) : (
      this.props.children
    );
  }
}

describe.each(Object.entries(hooks))(
  "inventory snapshot React/Dexie: %s",
  (_, useSnapshot) => {
    let database: ReturnType<typeof createDatabase>;
    beforeEach(async () => {
      database = createDatabase();
      await database.open();
      await seed(database);
    });
    afterEach(async () => {
      cleanup();
      vi.restoreAllMocks();
      await database.delete();
    });

    it.each(Object.entries(collections))(
      "reacts to changes in %s without polling",
      async (key, table) => {
        const { result } = renderHook(() => useSnapshot("A", database));
        await waitFor(() =>
          expect(result.current?.insumos[0].id).toBe("A-insumos"),
        );
        const target = key === "produtos" ? `global-${key}` : `A-${key}`;
        await act(async () => {
          await database.table(table).update(target, { testMarker: "updated" });
        });
        await waitFor(() =>
          expect(
            result.current?.[key as keyof typeof collections][0],
          ).toMatchObject({ testMarker: "updated" }),
        );
      },
    );
    it("reacts to tombstones, pending ACKs and removal of active farm", async () => {
      const { result, rerender } = renderHook(
        ({ farm }: { farm: string | null }) => useSnapshot(farm, database),
        { initialProps: { farm: "A" } },
      );
      await waitFor(() =>
        expect(result.current?.pendingTxIds.has("A-PENDING")).toBe(true),
      );
      await act(async () => {
        await database.queue_gestures.update("A-PENDING", { status: "DONE" });
        await database.queue_gestures.update("A-ERROR", { status: "SYNCED" });
        await database.state_insumos.update("A-insumos", {
          deleted_at: "2026-10-24",
        });
      });
      await waitFor(() => {
        expect(result.current?.insumos).toEqual([]);
        expect([...result.current!.pendingTxIds].sort()).toEqual([
          "A-REJECTED",
          "A-SYNCING",
        ]);
      });
      rerender({ farm: null });
      await waitFor(() => expect(result.current).toBeNull());
    });
    it("retains the previous result while switching farms but never publishes a late A result over B", async () => {
      database.close();
      let blockA = false;
      const started = deferred<void>();
      const release = deferred<void>();
      const settled = deferred<void>();
      database.use({
        stack: "dbcore",
        name: "delay-real-A-read",
        create: (down) => ({
          ...down,
          table: (name) => {
            const table = down.table(name);
            return {
              ...table,
              query: (req) => {
                const result = table.query(req);
                if (
                  name !== "state_insumos" ||
                  req.query.range.lower !== "A" ||
                  !blockA
                )
                  return result;
                blockA = false;
                return result.then((rows) => {
                  started.resolve();
                  return release.promise.then(() => {
                    settled.resolve();
                    return rows;
                  });
                });
              },
            };
          },
        }),
      });
      await database.open();
      const history: Array<{
        farm: string;
        snapshot: InventorySnapshot | null;
      }> = [];
      const { result, rerender } = renderHook(
        ({ farm }: { farm: string }) => {
          const snapshot = useSnapshot(farm, database);
          useEffect(() => {
            history.push({ farm, snapshot });
          }, [farm, snapshot]);
          return snapshot;
        },
        { initialProps: { farm: "A" } },
      );
      await waitFor(() =>
        expect(result.current?.insumos[0].id).toBe("A-insumos"),
      );
      blockA = true;
      await act(async () => {
        await database.state_insumos.update("A-insumos", {
          nome: "late A",
        });
      });
      await started.promise;
      rerender({ farm: "B" });
      // Existing useLiveQuery contract retains the previous result until B resolves.
      expect(result.current?.insumos[0].id).toBe("A-insumos");
      await waitFor(() =>
        expect(result.current?.insumos[0].id).toBe("B-insumos"),
      );
      const firstB = history.length;
      await act(async () => {
        release.resolve();
        await settled.promise;
      });
      await act(async () => {
        await database.state_insumos.update("B-insumos", {
          nome: "after late A",
        });
      });
      await waitFor(() =>
        expect(result.current?.insumos[0]).toMatchObject({
          id: "B-insumos",
          nome: "after late A",
        }),
      );
      expect(
        history
          .slice(firstB)
          .every((entry) => entry.snapshot?.insumos[0].id === "B-insumos"),
      ).toBe(true);
    });
    it("propagates a query failure to the boundary and recovers on remount", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      database.close();
      let fail = true;
      database.use({
        stack: "dbcore",
        name: "read-failure",
        create: (down) => ({
          ...down,
          table: (name) => {
            const table = down.table(name);
            return {
              ...table,
              query: (req) =>
                table.query(req).then((rows) => {
                  if (name === "state_insumos" && fail)
                    throw new Error("inventory read failed");
                  return rows;
                }),
            };
          },
        }),
      });
      await database.open();
      function Probe() {
        const snapshot = useSnapshot("A", database);
        return (
          <output data-testid="inventory-state">
            {snapshot?.insumos[0]?.id ?? "loading"}
          </output>
        );
      }
      const { rerender } = render(
        <QueryBoundary key="failed">
          <Probe />
        </QueryBoundary>,
      );
      await waitFor(() =>
        expect(screen.getByRole("alert").textContent).toBe("Error"),
      );
      fail = false;
      rerender(
        <QueryBoundary key="recovered">
          <Probe />
        </QueryBoundary>,
      );
      await waitFor(() =>
        expect(screen.getByTestId("inventory-state").textContent).toBe(
          "A-insumos",
        ),
      );
    });
    it("keeps the existing loading result on DatabaseClosedError and recovers by reopening and remounting", async () => {
      database.close();
      const where = vi.spyOn(database.state_insumos, "where");
      const first = renderHook(() => useSnapshot("A", database));
      await waitFor(() => expect(where).toHaveBeenCalled());
      expect(first.result.current).toBeNull();
      first.unmount();
      await database.open();
      const recovered = renderHook(() => useSnapshot("A", database));
      await waitFor(() =>
        expect(recovered.result.current?.insumos[0].id).toBe("A-insumos"),
      );
    });
  },
);
