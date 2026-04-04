import { describe, expect, it } from "vitest";
import type { PilotMetricEvent } from "@/lib/offline/types";
import { buildPilotMetricsSummary } from "../pilotMetrics";

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
});
