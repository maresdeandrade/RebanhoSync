/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/offline/db";
import { supabase } from "@/lib/supabase";
import type { PilotMetricEvent } from "@/lib/offline/types";
import {
  buildPilotMetricsSummary,
  flushPilotMetrics,
  trackPilotMetric,
} from "../pilotMetrics";

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

    await db.metrics_events.clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await db.metrics_events.clear();
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
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: {
        session: {
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
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(supabase.auth, "getSession").mockResolvedValue({
      data: {
        session: {
          access_token: "token-1",
        },
      },
      error: null,
    } as never);
    vi.spyOn(supabase.auth, "refreshSession").mockResolvedValue({
      data: {
        session: {
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
});
