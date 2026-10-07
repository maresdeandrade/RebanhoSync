import { env } from "@/lib/env";
import { db } from "@/lib/offline/db";
import { requireTenantSensitiveAccess } from "@/lib/offline/localReadBoundary";
import type {
  PilotMetricEvent,
  PilotMetricEventName,
  PilotMetricStatus,
} from "@/lib/offline/types";
import { supabase } from "@/lib/supabase";
import { readTelemetryFlushCursor, writeTelemetryFlushCursor } from "./telemetryFlushCursor";

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

const TELEMETRY_FLUSH_BATCH_SIZE = 100;
const TELEMETRY_REQUEST_TIMEOUT_MS = 15_000;

async function getTelemetryAccessToken(): Promise<string | null> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (!sessionError && session?.access_token) {
    return session.access_token;
  }

  const {
    data: { session: refreshedSession },
    error: refreshError,
  } = await supabase.auth.refreshSession();

  if (refreshError || !refreshedSession?.access_token) {
    return null;
  }

  return refreshedSession.access_token;
}

async function loadTelemetryBatch(fazendaId: string): Promise<PilotMetricEvent[]> {
  const cursor = await readTelemetryFlushCursor(fazendaId);
  const collection = cursor
    ? db.metrics_events
        .where("[fazenda_id+created_at]")
        .between([fazendaId, cursor.created_at], [fazendaId, "\uffff"], true, true)
    : db.metrics_events
        .where("[fazenda_id+created_at]")
        .between([fazendaId, ""], [fazendaId, "\uffff"], true, true);

  const rows = await collection
    .limit(TELEMETRY_FLUSH_BATCH_SIZE + (cursor?.ids_at_cursor.length ?? 0) + 5)
    .toArray();

  const filteredRows = cursor
    ? rows.filter(
        (event) =>
          event.created_at !== cursor.created_at ||
          !cursor.ids_at_cursor.includes(event.id),
      )
    : rows;

  return filteredRows.slice(0, TELEMETRY_FLUSH_BATCH_SIZE);
}

async function flushTelemetryBatch(
  accessToken: string,
  events: PilotMetricEvent[],
): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TELEMETRY_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${env.supabaseFunctionsUrl}/telemetry-ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabasePublishableKey,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ events }),
      signal: controller.signal,
    });

    if (!response.ok) return false;
    const receipt = await response.json();
    // Duplicate IDs are accepted by ingest's ignoreDuplicates upsert, so a
    // replay may insert zero rows. HTTP success alone is not a receipt.
    return receipt?.success === true && Number.isInteger(receipt.inserted) &&
      receipt.inserted >= 0 && receipt.inserted <= events.length;
  } catch {
    console.debug("[pilot-metrics] telemetry delivery unconfirmed");
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function flushTelemetryForFarm(fazendaId: string): Promise<number> {
  const pendingEvents = await loadTelemetryBatch(fazendaId);
  if (pendingEvents.length === 0) return 0;

  let accessToken = await getTelemetryAccessToken();
  if (!accessToken) return 0;

  let flushed = await flushTelemetryBatch(accessToken, pendingEvents);
  if (!flushed) {
    accessToken = await getTelemetryAccessToken();
    if (!accessToken) return 0;
    flushed = await flushTelemetryBatch(accessToken, pendingEvents);
  }

  if (!flushed) {
    throw new Error("Falha ao enviar telemetria remota.");
  }

  const lastCreatedAt =
    pendingEvents[pendingEvents.length - 1]?.created_at ?? new Date().toISOString();
  const idsAtCursor = pendingEvents
    .filter((event) => event.created_at === lastCreatedAt)
    .map((event) => event.id);

  await writeTelemetryFlushCursor(fazendaId, lastCreatedAt, idsAtCursor);

  return pendingEvents.length;
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

/**
 * flushPilotMetrics uploads locally buffered pilot telemetry in bounded batches.
 * The local Dexie store remains append-only and acts as the offline buffer.
 */
export async function flushPilotMetrics(): Promise<void> {
  if (typeof indexedDB === "undefined" || typeof fetch === "undefined") return;
  try {
    await requireTenantSensitiveAccess();
  } catch {
    return;
  }

  const farmIds = (await db.metrics_events.orderBy("fazenda_id").uniqueKeys()).filter(
    (value): value is string => typeof value === "string" && value.length > 0,
  );

  for (const fazendaId of farmIds) {
    let hasMore = true;

    while (hasMore) {
      const flushedCount = await flushTelemetryForFarm(fazendaId);
      hasMore = flushedCount === TELEMETRY_FLUSH_BATCH_SIZE;
    }
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
