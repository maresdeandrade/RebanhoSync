/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/offline/db";
import { establishLocalOwnership } from "@/lib/offline/ownership";
import { supabase } from "@/lib/supabase";
import type { PilotMetricEvent } from "@/lib/offline/types";
import {
  buildPilotMetricsSummary,
  flushPilotMetrics,
  trackPilotMetric,
} from "../pilotMetrics";
import { backlogByFarm } from "@/lib/offline/syncDiagnostics";

const ownershipSession = (userId: string) =>
  ({ user: { id: userId } }) as Parameters<
    typeof establishLocalOwnership
  >[0];

function event(overrides: Partial<PilotMetricEvent>): PilotMetricEvent {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    fazenda_id: overrides.fazenda_id ?? "farm-1",
    event_name: overrides.event_name ?? "page_view",
    status: overrides.status ?? "info",
    route: overrides.route ?? null,
    entity: overrides.entity ?? null,
    quantity: overrides.quantity ?? null,
    payload: overrides.payload ?? {},
    created_at: overrides.created_at ?? "2026-03-29T10:00:00.000Z",
  };
}

describe("buildPilotMetricsSummary", () => {
  beforeEach(async () => {
    if (!db.isOpen()) {
      await db.open();
    }

    await Promise.all([db.metrics_events.clear(), db.local_ownership.clear()]);
    await establishLocalOwnership(ownershipSession("user-metrics"));
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await Promise.all([db.metrics_events.clear(), db.local_ownership.clear()]);
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("aggregates usage, imports, reports and sync failures", () => {
    const summary = buildPilotMetricsSummary([
      event({ event_name: "page_view", route: "/home", created_at: "2026-03-28T10:00:00.000Z" }),
      event({ event_name: "page_view", route: "/home", created_at: "2026-03-28T12:00:00.000Z" }),
      event({ event_name: "page_view", route: "/relatorios", created_at: "2026-03-29T10:00:00.000Z" }),
      event({
        event_name: "import_completed",
        status: "success",
        entity: "animais",
        quantity: 25,
        created_at: "2026-03-29T10:10:00.000Z",
      }),
      event({
        event_name: "import_completed",
        status: "success",
        entity: "pastos",
        quantity: 3,
        created_at: "2026-03-29T10:15:00.000Z",
      }),
      event({ event_name: "report_exported", status: "success" }),
      event({ event_name: "report_printed", status: "success" }),
      event({ event_name: "sync_success", status: "success" }),
      event({ event_name: "sync_rejected", status: "error" }),
      event({ event_name: "sync_error", status: "error" }),
    ]);

    expect(summary).toMatchObject({
      activeDays: 2,
      totalEvents: 10,
      pageViews: 3,
      importsCompleted: 2,
      importedRecords: 28,
      reportExports: 1,
      reportPrints: 1,
      reportsShared: 2,
      syncSuccesses: 1,
      syncFailures: 2,
    });
    expect(summary.topRoutes[0]).toMatchObject({ label: "/home", count: 2 });
    expect(summary.importsByEntity[0]).toMatchObject({ label: "animais", count: 25 });
    expect(summary.failuresByType).toEqual([
      { label: "sync_error", count: 1 },
      { label: "sync_rejected", count: 1 },
    ]);
  });

  it("flushes pending pilot metrics to the remote ingest endpoint once", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, inserted: 2 }) });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: {
        session: {
          user: { id: "user-metrics" },
          access_token: "token-1",
        },
      },
      error: null,
    } as never);
    vi.spyOn(supabase.auth, "refreshSession").mockResolvedValue({
      data: {
        session: null,
      },
      error: null,
    } as never);

    await trackPilotMetric({
      fazendaId: "farm-1",
      eventName: "sync_error",
      status: "error",
      reasonCode: "HTTP_500",
    });
    await trackPilotMetric({
      fazendaId: "farm-1",
      eventName: "sync_rejected",
      status: "error",
      reasonCode: "ANTI_TELEPORTE",
    });

    await flushPilotMetrics();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, request] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(request?.body ?? "{}"));
    expect(body.events).toHaveLength(2);

    await flushPilotMetrics();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      localStorage.getItem("rebanhosync:telemetry-flush:farm-1"),
    ).toBeTruthy();
  });

  it("retries telemetry flush after an initial remote failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, inserted: 1 }) });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: {
        session: {
          user: { id: "user-metrics" },
          access_token: "token-1",
        },
      },
      error: null,
    } as never);
    vi.spyOn(supabase.auth, "refreshSession").mockResolvedValue({
      data: {
        session: {
          user: { id: "user-metrics" },
          access_token: "token-2",
        },
      },
      error: null,
    } as never);

    await trackPilotMetric({
      fazendaId: "farm-1",
      eventName: "sync_backlog",
      status: "info",
      quantity: 3,
    });

    await flushPilotMetrics();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["network", () => Promise.reject(new TypeError("Failed to fetch"))],
    ["abort", () => Promise.reject(new DOMException("Aborted", "AbortError"))],
    ["HTTP", () => Promise.resolve({ ok: false })],
    ["invalid JSON", () => Promise.resolve({ ok: true, json: async () => { throw new SyntaxError(); } })],
    ["invalid receipt", () => Promise.resolve({ ok: true, json: async () => ({ success: false, inserted: 1 }) })],
    ["missing count", () => Promise.resolve({ ok: true, json: async () => ({ success: true }) })],
    ["impossible count", () => Promise.resolve({ ok: true, json: async () => ({ success: true, inserted: 2 }) })],
  ])("keeps the checkpoint and retries the same IDs after %s failure", async (_name, fail) => {
    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: { session: { access_token: "test-token", user: { id: "user-metrics" } } }, error: null,
    } as never);
    const previous = { createdAt: "2026-03-28T10:00:00.000Z", idsAtCursor: ["delivered"] };
    const key = "rebanhosync:telemetry-flush:farm-1";
    localStorage.setItem(key, JSON.stringify(previous));
    const pending = event({ id: "retry-same-id" });
    await db.metrics_events.put(pending);
    const fetchMock = vi.fn().mockImplementation(fail);
    vi.stubGlobal("fetch", fetchMock);

    await expect(flushPilotMetrics()).rejects.toThrow("Falha ao enviar telemetria remota.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual(previous);
    expect(await db.metrics_events.get(pending.id)).toEqual(pending);

    // Lost ACK replay is accepted even when ingest inserts no new rows.
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true, inserted: 0 }) });
    await flushPilotMetrics();
    const bodies = fetchMock.mock.calls.map(([, request]) => JSON.parse(request.body));
    expect(bodies).toEqual([{ events: [pending] }, { events: [pending] }, { events: [pending] }]);
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual({ createdAt: pending.created_at, idsAtCursor: [pending.id] });
  });

  it("retains all confirmed IDs across batches sharing a timestamp", async () => {
    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: { session: { access_token: "test-token", user: { id: "user-metrics" } } }, error: null,
    } as never);
    await db.metrics_events.bulkPut(Array.from({ length: 101 }, (_, index) => event({ id: `same-time-${index}` })));
    const fetchMock = vi.fn().mockImplementation(async (_url, request) => ({
      ok: true, json: async () => ({ success: true, inserted: JSON.parse(request.body).events.length }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    await flushPilotMetrics();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await flushPilotMetrics();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(localStorage.getItem("rebanhosync:telemetry-flush:farm-1")!).idsAtCursor).toHaveLength(101);
  });

  it("aborts a hung telemetry request without confirming delivery", async () => {
    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: { session: { access_token: "test-token", user: { id: "user-metrics" } } }, error: null,
    } as never);
    await db.metrics_events.put(event({ id: "hung-request" }));
    // Accelerate only the telemetry timer; IndexedDB scheduling remains real.
    const schedule = globalThis.setTimeout;
    vi.spyOn(globalThis, "setTimeout").mockImplementation((callback, delay, ...args) =>
      schedule(callback, delay === 15_000 ? 0 : delay, ...args));
    vi.stubGlobal("fetch", vi.fn().mockImplementation((_url, request) => new Promise((_resolve, reject) => {
      request.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })));
    await expect(flushPilotMetrics()).rejects.toThrow("Falha ao enviar telemetria remota.");
    expect(localStorage.getItem("rebanhosync:telemetry-flush:farm-1")).toBeNull();
    expect(await db.metrics_events.get("hung-request")).toBeDefined();
  });

  it("persists backlog metrics with the count of each declared farm", async () => {
    for (const backlog of backlogByFarm([
      { fazenda_id: "farm-A" }, { fazenda_id: "farm-B" },
      { fazenda_id: "farm-A" }, { fazenda_id: "farm-B" }, { fazenda_id: "farm-B" },
    ])) {
      await trackPilotMetric({ ...backlog, eventName: "sync_backlog" });
    }
    const metrics = await db.metrics_events.toArray();
    expect(metrics.map(row => ({ farm: row.fazenda_id, quantity: row.quantity })))
      .toEqual(expect.arrayContaining([{ farm: "farm-A", quantity: 2 }, { farm: "farm-B", quantity: 3 }]));
    expect(metrics).toHaveLength(2);
  });
});
