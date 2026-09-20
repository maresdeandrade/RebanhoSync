/**
 * F24.2D1C — Auth/session recovery normalization: recoverable session flows
 * keep pushing; non-recoverable auth errors preserve local work terminaly
 * until a valid session exists; 403 stays authorization-terminal.
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: {
          session: {
            user: { id: "user-auth" },
            access_token: "auth-token",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
        error: null,
      })),
      refreshSession: vi.fn(),
    },
  },
}));

vi.mock("../pull", () => ({
  DEFAULT_REMOTE_TABLES: [],
  pullDataForFarm: vi.fn(async () => undefined),
  pullInitialData: vi.fn(async () => undefined),
  pullSanitarioAgendaV2: vi.fn(async () => undefined),
  pullSanitarioV2CutoverState: vi.fn(async () => undefined),
}));

vi.mock("@/lib/telemetry/pilotMetrics", () => ({
  flushPilotMetrics: vi.fn(async () => undefined),
  trackPilotMetric: vi.fn(async () => undefined),
}));

import { supabase } from "@/lib/supabase";
import { createGesture } from "../ops";
import { db } from "../db";
import { establishLocalOwnership } from "../ownership";
import {
  processGesture,
  recoverErroredGesturesOnce,
} from "../syncWorker";

const farmId = "farm-auth";

function validSession() {
  return {
    user: { id: "user-auth" },
    access_token: "auth-token",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  };
}

function mockAuth({
  session = validSession() as unknown,
  sessionError = null,
  refreshedSession = validSession() as unknown,
  refreshError = null,
}: {
  session?: unknown;
  sessionError?: { message: string } | null;
  refreshedSession?: unknown;
  refreshError?: { message: string } | null;
} = {}) {
  vi.mocked(supabase.auth.getSession).mockReset();
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session },
    error: sessionError,
  } as never);
  vi.mocked(supabase.auth.refreshSession).mockReset();
  vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
    data: { session: refreshedSession },
    error: refreshError,
  } as never);
}

function appliedResponse(opId: string) {
  return new Response(
    JSON.stringify({ results: [{ op_id: opId, status: "APPLIED" }] }),
    { status: 200 },
  );
}

function unauthorizedResponse() {
  return new Response(JSON.stringify({ error: "jwt expired" }), {
    status: 401,
  });
}

async function queueOpId(txId: string) {
  const ops = await db.queue_ops.where("client_tx_id").equals(txId).toArray();
  expect(ops).toHaveLength(1);
  return ops[0].client_op_id;
}

async function seedTerminalErrorGesture(
  txId: string,
  lastError: string,
  retryCount = 3,
) {
  await db.queue_gestures.add({
    client_tx_id: txId,
    fazenda_id: farmId,
    client_id: "client-auth",
    status: "ERROR",
    sync_result: "ERROR",
    completed_at: "2026-09-19T10:00:00.000Z",
    last_error: lastError,
    retry_count: retryCount,
    created_at: "2026-09-19T09:59:00.000Z",
  });
}

async function loadGesture(txId: string) {
  const gesture = await db.queue_gestures.get(txId);
  if (!gesture) throw new Error("gesture not found");
  return gesture;
}

describe("F24.2D1C — auth/session recovery normalization", () => {
  beforeEach(async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    await Promise.all([
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.queue_rejections.clear(),
      db.sync_reconcile_obligations.clear(),
      db.local_ownership.clear(),
    ]);
    await establishLocalOwnership({ user: { id: "user-auth" } });
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    await Promise.all([
      db.queue_gestures.clear(),
      db.queue_ops.clear(),
      db.queue_rejections.clear(),
      db.sync_reconcile_obligations.clear(),
      db.local_ownership.clear(),
    ]);
  });

  it("T1 — sessão ausente bloqueia replay sem tentar refresh", async () => {
    mockAuth({
      session: null,
      sessionError: { message: "session missing" },
      refreshedSession: validSession(),
      refreshError: null,
    });
    const txId = await createGesture(farmId, [
      {
        table: "lotes",
        action: "INSERT",
        record: { id: "lote-auth-refresh", fazenda_id: farmId },
      },
    ]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await processGesture(await loadGesture(txId));

    expect(vi.mocked(supabase.auth.refreshSession)).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "PENDING",
    });
    expect(await db.queue_ops.where("client_tx_id").equals(txId).count()).toBe(
      1,
    );
  });

  it("T2 — access_token sem user.id bloqueia e preserva a fila", async () => {
    mockAuth({
      session: { access_token: "token-without-user" },
      sessionError: null,
      refreshedSession: null,
      refreshError: { message: "invalid refresh token" },
    });
    const txId = await createGesture(farmId, [
      {
        table: "lotes",
        action: "INSERT",
        record: { id: "lote-auth-fail", fazenda_id: farmId },
      },
    ]);
    vi.stubGlobal("fetch", vi.fn());

    await processGesture(await loadGesture(txId));

    const gesture = await db.queue_gestures.get(txId);
    expect(gesture).toMatchObject({
      status: "PENDING",
    });
    expect(gesture?.retry_count ?? 0).toBe(0);
    expect(gesture?.last_error).toBeUndefined();
    expect(await db.queue_ops.where("client_tx_id").equals(txId).count()).toBe(
      1,
    );
    expect(vi.mocked(fetch as unknown as vi.Mock)).not.toHaveBeenCalled();
  });

  it("T3 — primeiro 401 + refresh OK + segundo request OK: ACK normal", async () => {
    mockAuth({ refreshedSession: validSession(), refreshError: null });
    const txId = await createGesture(farmId, [
      {
        table: "lotes",
        action: "INSERT",
        record: { id: "lote-401-retry", fazenda_id: farmId },
      },
    ]);
    const opId = await queueOpId(txId);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(unauthorizedResponse())
      .mockResolvedValueOnce(appliedResponse(opId));
    vi.stubGlobal("fetch", fetchMock);

    await processGesture(await loadGesture(txId));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(vi.mocked(supabase.auth.refreshSession)).toHaveBeenCalledTimes(1);
    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "DONE",
      sync_result: "APPLIED",
    });
    expect(await db.queue_ops.where("client_tx_id").equals(txId).count()).toBe(
      0,
    );
  });

  it("T4 — 401 + refresh OK + segundo 401: terminal imediato, sem loop de retry", async () => {
    mockAuth({ refreshedSession: validSession(), refreshError: null });
    const txId = await createGesture(farmId, [
      {
        table: "lotes",
        action: "INSERT",
        record: { id: "lote-401-401", fazenda_id: farmId },
      },
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => unauthorizedResponse()),
    );

    await processGesture(await loadGesture(txId));
    await processGesture(await loadGesture(txId));

    const gesture = await db.queue_gestures.get(txId);
    expect(gesture).toMatchObject({
      status: "ERROR",
      sync_result: "ERROR",
    });
    expect(gesture?.retry_count ?? 0).toBe(0);
    expect(gesture?.last_error?.toLowerCase()).toContain("http 401");
    expect(await db.queue_ops.where("client_tx_id").equals(txId).count()).toBe(
      1,
    );
  });

  it("T5 — 401 + refresh falha: trabalho local preservado", async () => {
    mockAuth({
      refreshedSession: null,
      refreshError: { message: "refresh token expired" },
    });
    const txId = await createGesture(farmId, [
      {
        table: "lotes",
        action: "INSERT",
        record: { id: "lote-401-refresh-fail", fazenda_id: farmId },
      },
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => unauthorizedResponse()),
    );

    await processGesture(await loadGesture(txId));

    const gesture = await db.queue_gestures.get(txId);
    expect(gesture).toMatchObject({
      status: "ERROR",
      sync_result: "ERROR",
    });
    expect(gesture?.retry_count ?? 0).toBe(0);
    expect(gesture?.last_error?.toLowerCase()).toContain(
      "http 401 - refresh failed",
    );
    expect(await db.queue_ops.where("client_tx_id").equals(txId).count()).toBe(
      1,
    );
  });

  it("T6 — sem sessão utilizável nenhuma gesture ERROR é reclassificada", async () => {
    mockAuth({
      session: null,
      sessionError: { message: "session missing" },
      refreshedSession: null,
      refreshError: { message: "invalid refresh token" },
    });
    await seedTerminalErrorGesture(
      "tx-auth-blocked",
      "Max retries: HTTP 401 - refresh failed: no session",
    );
    await seedTerminalErrorGesture(
      "tx-transient-503",
      "Max retries: HTTP 503 - Service Unavailable",
    );
    for (const txId of ["tx-auth-blocked", "tx-transient-503"]) {
      await db.queue_ops.add({
        client_tx_id: txId,
        client_op_id: `op-${txId}`,
        table: "lotes",
        action: "INSERT",
        record: { id: `lote-${txId}`, fazenda_id: farmId },
        sync_state: "PENDING",
        created_at: "2026-09-19T09:59:00.000Z",
      });
    }

    await recoverErroredGesturesOnce();

    expect(await db.queue_gestures.get("tx-auth-blocked")).toMatchObject({
      status: "ERROR",
      sync_result: "ERROR",
    });
    expect(await db.queue_ops.get("op-tx-auth-blocked")).toBeDefined();
    expect(await db.queue_gestures.get("tx-transient-503")).toMatchObject({
      status: "ERROR",
      sync_result: "ERROR",
    });
    expect(await db.queue_ops.get("op-tx-transient-503")).toBeDefined();
  });

  it("T7 — nova sessão válida: mesma gesture/op identity volta ao fluxo e ACK", async () => {
    mockAuth({
      session: null,
      sessionError: { message: "session missing" },
      refreshedSession: null,
      refreshError: { message: "refresh token expired" },
    });
    const txId = await createGesture(farmId, [
      {
        table: "lotes",
        action: "INSERT",
        record: { id: "lote-auth-recovery", fazenda_id: farmId },
      },
    ]);
    const opId = await queueOpId(txId);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => unauthorizedResponse()),
    );
    await processGesture(await loadGesture(txId));
    expect((await db.queue_gestures.get(txId))?.status).toBe("PENDING");

    mockAuth({ session: validSession(), sessionError: null });
    const fetchMock = vi.fn(async () => appliedResponse(opId));
    vi.stubGlobal("fetch", fetchMock);

    await processGesture(await loadGesture(txId));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(
      (fetchMock.mock.calls[0]?.[1] as { body: string }).body,
    );
    expect(body.client_tx_id).toBe(txId);
    expect(JSON.stringify(body)).toContain(opId);
    expect(await db.queue_gestures.get(txId)).toMatchObject({
      status: "DONE",
      sync_result: "APPLIED",
    });
  });

  it("T8 — 403 permanece terminal e não é recuperado por auth", async () => {
    mockAuth({ session: validSession(), sessionError: null });
    const txId = await createGesture(farmId, [
      {
        table: "lotes",
        action: "INSERT",
        record: { id: "lote-forbidden", fazenda_id: farmId },
      },
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ error: "Forbidden - no access to this farm" }),
            { status: 403 },
          ),
      ),
    );

    await processGesture(await loadGesture(txId));

    await recoverErroredGesturesOnce();

    const gesture = await db.queue_gestures.get(txId);
    expect(gesture).toMatchObject({
      status: "ERROR",
      sync_result: "ERROR",
    });
    expect(gesture?.retry_count ?? 0).toBe(0);
    expect(await db.queue_ops.where("client_tx_id").equals(txId).count()).toBe(
      1,
    );
  });
});
