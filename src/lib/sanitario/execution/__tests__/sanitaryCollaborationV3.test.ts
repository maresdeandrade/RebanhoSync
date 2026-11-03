// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { db, LOCAL_OWNERSHIP_KEY } from "@/lib/offline/db";
import { setSanitarioV2PushEnabled } from "@/lib/offline/sanitarioV2Cutover";
import {
  allocateSanitarySequenceV3,
  currentParticipationV3,
  manageSanitaryAgendaV3,
} from "../sanitaryCollaborationV3";
vi.mock("@/lib/env", () => ({
  env: { supabaseUrl: "http://127.0.0.1:56421" },
}));
const actor = crypto.randomUUID(),
  farm = crypto.randomUUID(),
  agenda = crypto.randomUUID();
vi.mock("@/lib/offline/localReadBoundary", () => ({
  getCurrentLocalReadOwnership: vi.fn(),
}));
import { getCurrentLocalReadOwnership } from "@/lib/offline/localReadBoundary";
const context = {
  fazendaId: farm,
  agendaId: agenda,
  actorUserId: actor,
  clientId: "device",
  projectRef: "local",
};
const tables = [
  db.local_sanitario_participacoes,
  db.ops_sanitario_agenda_v2,
  db.local_ownership,
  db.queue_ops,
  db.queue_gestures,
  db.sync_sanitario_v2_cutovers,
];
beforeEach(async () => {
  vi.stubEnv("VITE_SUPABASE_URL", "http://127.0.0.1:56421");
  vi.stubEnv("VITE_BACKEND_ENV", "development");
  await db.open();
  for (const table of tables) await table.clear();
  vi.mocked(getCurrentLocalReadOwnership).mockResolvedValue({
    status: "OWNED",
    currentUserId: actor,
    ownerUserId: actor,
  });
  await db.local_ownership.put({
    key: LOCAL_OWNERSHIP_KEY,
    owner_user_id: actor,
  });
  await db.ops_sanitario_agenda_v2.put({
    id: agenda,
    fazenda_id: farm,
    status: "programada",
    obrigacao_origem_agenda_id: agenda,
  } as never);
  await db.sync_sanitario_v2_cutovers.put({
    key: `${farm}:3`,
    fazenda_id: farm,
    contract_version: 3,
    status: "APPLIED",
  } as never);
  setSanitarioV2PushEnabled(true, "local");
});
afterEach(async () => {
  for (const table of tables) await table.clear();
  setSanitarioV2PushEnabled(false, "local");
});
const allocate = () =>
  db.transaction(
    "rw",
    [db.local_ownership, db.local_sanitario_participacoes],
    () => allocateSanitarySequenceV3(farm, agenda, "device"),
  );
it("reading does not enroll; concurrent allocations survive restart without sequence reuse", async () => {
  expect(await currentParticipationV3(context)).toBeUndefined();
  const [a, b] = await Promise.all([allocate(), allocate()]);
  expect(a.participation_id).toBe(b.participation_id);
  expect([a.participation_sequence, b.participation_sequence].sort()).toEqual([
    1, 2,
  ]);
  db.close();
  await db.open();
  expect((await allocate()).participation_sequence).toBe(3);
});
it("individual completion and immutable queue commit together; retry does not enroll twice", async () => {
  const id = crypto.randomUUID();
  await manageSanitaryAgendaV3(context, "participate", {}, id);
  await manageSanitaryAgendaV3(context, "participate", {}, id);
  await allocate();
  await manageSanitaryAgendaV3(context, "complete");
  expect(await db.queue_ops.count()).toBe(2);
  const completion = (await db.queue_ops.toArray()).find(
    (x) => x.record.payload.action === "complete",
  )!;
  expect(completion.record.payload).toMatchObject({
    participation_id: id,
    final_sequence: 1,
  });
  expect((await db.ops_sanitario_agenda_v2.get(agenda))?.status).toBe(
    "programada",
  );
  await expect(allocate()).rejects.toThrow("Concluiu");
});
it("retains completed segment identity when explicitly resuming", async () => {
  await manageSanitaryAgendaV3(context, "participate");
  const original = await currentParticipationV3(context);
  await manageSanitaryAgendaV3(context, "complete");
  await manageSanitaryAgendaV3(context, "participate");
  expect((await currentParticipationV3(context))?.id).not.toBe(original?.id);
  expect(
    await db.local_sanitario_participacoes.get(original!.id),
  ).toBeDefined();
});
it("farm-switch or ownership change leaves no partial participation or queue", async () => {
  await expect(
    manageSanitaryAgendaV3(
      {
        ...context,
        assertCurrentContext: () => {
          throw Error("farm-switch");
        },
      },
      "participate",
    ),
  ).rejects.toThrow("farm-switch");
  await db.local_ownership.put({
    key: LOCAL_OWNERSHIP_KEY,
    owner_user_id: "other",
  });
  await expect(
    manageSanitaryAgendaV3(context, "participate"),
  ).rejects.toThrow();
  expect(await db.local_sanitario_participacoes.count()).toBe(0);
  expect(await db.queue_ops.count()).toBe(0);
});
it("rejects divergent replay without replacing the original decision envelope", async () => {
  const id = crypto.randomUUID();
  await manageSanitaryAgendaV3(
    context,
    "request_continuation",
    { reason: "A" },
    id,
  );
  await expect(
    manageSanitaryAgendaV3(
      context,
      "request_continuation",
      { reason: "B" },
      id,
    ),
  ).rejects.toThrow("DIVERGENT_PAYLOAD");
  expect((await db.queue_ops.get(id))?.record.payload.reason).toBe("A");
});
