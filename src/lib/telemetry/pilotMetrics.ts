import { db } from "@/lib/offline/db";
import type {
  PilotMetricEvent,
  PilotMetricEventName,
  PilotMetricStatus,
} from "@/lib/offline/types";

export interface TrackPilotMetricInput {
  fazendaId: string | null | undefined;
  eventName: PilotMetricEventName;
  status?: PilotMetricStatus;
  route?: string | null;
  entity?: string | null;
  quantity?: number | null;
  reasonCode?: string | null;
  payload?: Record<string, unknown>;
}

export interface PilotMetricCount {
  label: string;
  count: number;
}

export interface PilotMetricsSummary {
  activeDays: number;
  totalEvents: number;
  pageViews: number;
  importsCompleted: number;
  importedRecords: number;
  reportExports: number;
  reportPrints: number;
  reportsShared: number;
  syncSuccesses: number;
  syncFailures: number;
  topRoutes: PilotMetricCount[];
  importsByEntity: PilotMetricCount[];
  failuresByType: PilotMetricCount[];
}

export async function trackPilotMetric(
  input: TrackPilotMetricInput,
): Promise<void> {
  if (!input.fazendaId) return;
  if (typeof indexedDB === "undefined") return;

  const event: PilotMetricEvent = {
    id: crypto.randomUUID(),
    fazenda_id: input.fazendaId,
    event_name: input.eventName,
    status: input.status ?? "info",
    route: input.route ?? null,
    entity: input.entity ?? null,
    quantity: input.quantity ?? null,
    reason_code: input.reasonCode ?? null,
    payload: input.payload ?? {},
    created_at: new Date().toISOString(),
  };

  try {
    await db.metrics_events.put(event);
  } catch (error) {
    console.warn("[pilot-metrics] failed to persist event", error);
  }
}

function toSortedCounts(map: Map<string, number>, limit = 5): PilotMetricCount[] {
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, limit);
}

import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";

export async function flushPilotMetrics(): Promise<void> {
  if (typeof indexedDB === "undefined") return;

  try {
    const events = await db.metrics_events.toArray();
    if (events.length === 0) return;

    // Get current session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
       // Cannot flush without session, will try again later
       return;
    }

    const response = await fetch(`${env.supabaseFunctionsUrl}/telemetry-ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseAnonKey,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ events }),
    });

    if (response.ok) {
      // Successfully sent, delete them from local store
      const sentIds = events.map((e) => e.id);
      await db.metrics_events.bulkDelete(sentIds);
    } else {
       // Only log non-transient warnings if in dev
       if (import.meta.env.DEV) {
          console.warn("[pilot-metrics] Failed to flush telemetry:", response.status);
       }
    }
  } catch (error) {
    // Network errors during offline usage are expected. Suppress spam.
  }
}

export function buildPilotMetricsSummary(
  events: PilotMetricEvent[],
): PilotMetricsSummary {
  const activeDays = new Set<string>();
  const routeCounts = new Map<string, number>();
  const importCounts = new Map<string, number>();
  const failureCounts = new Map<string, number>();

  let pageViews = 0;
  let importsCompleted = 0;
  let importedRecords = 0;
  let reportExports = 0;
  let reportPrints = 0;
  let syncSuccesses = 0;
  let syncFailures = 0;

  for (const event of events) {
    activeDays.add(event.created_at.slice(0, 10));

    if (event.event_name === "page_view") {
      pageViews += 1;
      if (event.route) {
        routeCounts.set(event.route, (routeCounts.get(event.route) ?? 0) + 1);
      }
    }

    if (event.event_name === "import_completed") {
      importsCompleted += 1;
      importedRecords += event.quantity ?? 0;
      const entity = event.entity ?? "geral";
      importCounts.set(entity, (importCounts.get(entity) ?? 0) + (event.quantity ?? 0));
    }

    if (event.event_name === "report_exported") {
      reportExports += 1;
    }

    if (event.event_name === "report_printed") {
      reportPrints += 1;
    }

    if (event.event_name === "sync_success") {
      syncSuccesses += 1;
    }

    if (event.event_name === "sync_rejected" || event.event_name === "sync_error") {
      syncFailures += 1;
      failureCounts.set(
        event.event_name,
        (failureCounts.get(event.event_name) ?? 0) + 1,
      );
    }
  }

  return {
    activeDays: activeDays.size,
    totalEvents: events.length,
    pageViews,
    importsCompleted,
    importedRecords,
    reportExports,
    reportPrints,
    reportsShared: reportExports + reportPrints,
    syncSuccesses,
    syncFailures,
    topRoutes: toSortedCounts(routeCounts, 4),
    importsByEntity: toSortedCounts(importCounts, 4),
    failuresByType: toSortedCounts(failureCounts, 4),
  };
}
