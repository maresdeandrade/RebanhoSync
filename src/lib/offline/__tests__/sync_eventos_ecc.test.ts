/** @vitest-environment jsdom */
import { vi } from "vitest";
import "fake-indexeddb/auto";
// src/lib/offline/__tests__/sync_eventos_ecc.test.ts
import { db } from "../db";
import { processGesture } from "../syncWorker";
import { getRemoteTableName, getLocalStoreName } from "../tableMap";
import { randomUUID } from "node:crypto";
import { supabase } from "@/lib/supabase";
import { env } from "@/lib/env";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "test-token", expires_at: Math.floor(Date.now() / 1000) + 3600 } }, error: null }),
      refreshSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "test-token", expires_at: Math.floor(Date.now() / 1000) + 3600 } }, error: null })
    }
  }
}));

vi.mock("@/lib/env", () => ({
  env: { supabaseFunctionsUrl: "http://localhost" }
}));

/** Helper to create a minimal gesture for a given table and action. */
async function createGesture({
  table,
  action,
  record,
}: {
  table: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  record: Record<string, unknown>;
}) {
  const client_tx_id = randomUUID();
  await db.queue_gestures.add({
    client_id: "test-client",
    client_tx_id,
    fazenda_id: "fazenda-123",
    status: "PENDING",
    created_at: new Date().toISOString(),
  });

  await db.queue_ops.add({
    client_tx_id,
    client_op_id: randomUUID(),
    table,
    action,
    record,
    created_at: new Date().toISOString(),
  });

  // Return a minimal gesture shape needed by processGesture
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client_tx_id, fazenda_id: "fazenda-123" } as any;
}

describe("syncWorker eventos_ecc integration", () => {
  beforeAll(async () => {
    await db.open();
  });

  afterAll(async () => {
    await db.delete();
  });

  it("maps remote and local store correctly", () => {
    expect(getRemoteTableName("event_eventos_ecc")).toBe("eventos_ecc");
    expect(getLocalStoreName("eventos_ecc")).toBe("event_eventos_ecc");
  });

  it("creates proper payload for INSERT", async () => {
    const record = {
      event_id: "ev-1",
      animal_id: "an-1",
      ecc: 3.5,
    };
    const gesture = await createGesture({
      table: "event_eventos_ecc",
      action: "INSERT",
      record,
    });

    // Ensure fetch is defined and mocked
    if (typeof global.fetch !== "function") {
// eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).fetch = vi.fn();
    }
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ status: "APPLIED", op_id: "op1" }] }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    await processGesture(gesture);
    expect(fetchMock).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    const op = body.ops[0];
    expect(op.table).toBe("eventos_ecc");
    // The client payload does not include fazenda_id; server will inject it later.
    expect(op.record.event_id).toBe("ev-1");
    expect(op.record.animal_id).toBe("an-1");
    expect(op.record.ecc).toBe(3.5);
    fetchMock.mockRestore();
  });
});
