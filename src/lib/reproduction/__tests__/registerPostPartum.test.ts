import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => {
        if (Dexie.currentTransaction)
          throw new Error("AUTH_CALL_INSIDE_TRANSACTION");
        return { data: { session: { user: { id: "user-i03" } } }, error: null };
      }),
    },
  },
}));
import { db } from "@/lib/offline/db";
import { establishLocalOwnership } from "@/lib/offline/ownership";
import { buildCalfJourneyAgendaOps } from "../calfJourney";
import {
  registerPostPartumGesture,
  type PostPartumContext,
} from "../registerPostPartum";
import type {
  Animal,
  AgendaItem,
  SanitarioAgendaLocalV2,
  Operation,
} from "@/lib/offline/types";

const farm = "11111111-1111-4111-8111-111111111111";
const calfId = "22222222-2222-4222-8222-222222222222";
const motherId = "33333333-3333-4333-8333-333333333333";
const birthId = "44444444-4444-4444-8444-444444444444";
const now = "2026-04-01T12:00:00.000Z";
const calf = {
  id: calfId,
  fazenda_id: farm,
  identificacao: "CRIA",
  nome: null,
  lote_id: null,
  pai_id: null,
  mae_id: motherId,
  sexo: "F",
  status: "ativo",
  data_nascimento: "2026-04-01",
  data_entrada: null,
  data_saida: null,
  rfid: null,
  especie: null,
  origem: "nascimento",
  raca: null,
  papel_macho: null,
  habilitado_monta: false,
  observacoes: null,
  client_id: "i03",
  client_op_id: "seed-calf",
  client_tx_id: null,
  client_recorded_at: now,
  server_received_at: now,
  deleted_at: null,
  revision: 1,
  payload: { generated_from: "evento_parto", birth_event_id: birthId },
  created_at: now,
  updated_at: now,
} as Animal;
const input = {
  fazendaId: farm,
  mother: { id: motherId, identificacao: "MAE" },
  calves: [calf],
  drafts: [
    {
      calfId,
      identificacao: "FINAL",
      nome: "",
      loteId: null,
      pesoKg: "32",
      curaUmbigo: false,
    },
  ],
  occurredAt: now,
};
let context: PostPartumContext;
const readContext = () => context;
const hookCleanups: (() => void)[] = [];
async function enable() {
  localStorage.setItem("rebanhosync:sanitario-v2-push", "local");
  await db.sync_sanitario_v2_cutovers.put({
    key: `${farm}:2`,
    fazenda_id: farm,
    contract_version: 2,
    status: "APPLIED",
    prepared_at: now,
    applying_at: null,
    applied_at: now,
    failed_at: null,
    last_error: null,
    updated_at: now,
  });
}
function beforeCreate(callback: () => void) {
  const handler = () => {
    callback();
  };
  db.ops_sanitario_agenda_v2.hook("creating", handler);
  hookCleanups.push(() =>
    db.ops_sanitario_agenda_v2.hook("creating").unsubscribe(handler),
  );
}
beforeEach(async () => {
  for (const table of db.tables) await table.clear();
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  vi.stubGlobal("fetch", () => {
    throw new Error("NETWORK_FORBIDDEN");
  });
  vi.stubEnv("VITE_SUPABASE_URL", "http://localhost:54321");
  vi.stubEnv("VITE_BACKEND_ENV", "development");
  context = { fazendaId: farm, userId: "user-i03", role: "owner" };
  await establishLocalOwnership({ user: { id: "user-i03" } } as never);
  await db.state_animais.bulkPut([
    calf,
    { ...calf, id: motherId, identificacao: "MAE", mae_id: null },
  ]);
});
afterEach(() => {
  hookCleanups.splice(0).forEach((cleanup) => cleanup());
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("registro prospectivo pós-parto", () => {
  it.each([false, true])(
    "persists umbilical facts and stable replay when the screen snapshot has a prior cure=%s",
    async (staleCure) => {
      await enable();
      const snapshot = staleCure
        ? {
            ...calf,
            payload: {
              ...calf.payload,
              neonatal_setup: { umbigo_curado_at: now },
            },
          }
        : calf;
      const submission = {
        ...input,
        calves: [snapshot],
        drafts: [{ ...input.drafts[0], curaUmbigo: true }],
      };
      const result = await registerPostPartumGesture(submission, readContext);
      expect(result.umbigoCount).toBe(1);
      const details = await db.event_eventos_sanitario.toArray();
      expect(details).toHaveLength(1);
      expect(details[0].produto).toBe("Cura de umbigo");
      expect(await db.event_eventos.get(details[0].evento_id)).toMatchObject({
        dominio: "sanitario",
        animal_id: calfId,
      });
      expect(await db.event_eventos_pesagem.count()).toBe(1);
      expect(await db.ops_sanitario_agenda_v2.count()).toBe(1);
      expect(await db.state_agenda_itens.count()).toBe(3);
      const operations = await db.queue_ops.toArray();
      expect(
        operations.filter((op) => op.table === "eventos_sanitario"),
      ).toHaveLength(1);
      const replay = await registerPostPartumGesture(submission, readContext);
      expect(replay.txId).toBe(result.txId);
      expect(replay.replayed).toBe(true);
      expect(await db.queue_ops.toArray()).toEqual(operations);
      expect(await db.event_eventos_sanitario.count()).toBe(1);
      expect(await db.event_eventos.count()).toBe(2);
    },
  );
  it("rolls back rebuilt sanitary facts after a stale-cure snapshot and recovers on retry", async () => {
    await enable();
    const submission = {
      ...input,
      calves: [
        {
          ...calf,
          payload: {
            ...calf.payload,
            neonatal_setup: { umbigo_curado_at: now },
          },
        },
      ],
      drafts: [{ ...input.drafts[0], curaUmbigo: true }],
    };
    const before = await db.state_animais.get(calfId);
    beforeCreate(() => {
      throw new Error("REBUILT_SANITARY_WRITE_FAILURE");
    });
    await expect(
      registerPostPartumGesture(submission, readContext),
    ).rejects.toThrow("REBUILT_SANITARY_WRITE_FAILURE");
    expect(await db.state_animais.get(calfId)).toEqual(before);
    for (const table of [
      db.queue_ops,
      db.queue_gestures,
      db.event_eventos,
      db.event_eventos_sanitario,
      db.event_eventos_pesagem,
      db.state_agenda_itens,
      db.ops_sanitario_agenda_v2,
      db.ops_sanitario_agenda_animais_v2,
    ]) {
      expect(await table.count()).toBe(0);
    }
    hookCleanups.splice(0).forEach((cleanup) => cleanup());
    await registerPostPartumGesture(submission, readContext);
    expect(await db.event_eventos_sanitario.count()).toBe(1);
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(1);
  });
  it("persists movement introduced by a newer Dexie lot despite an unchanged screen draft", async () => {
    const lot = "55555555-5555-4555-8555-555555555555";
    await db.state_lotes.put({
      id: lot,
      fazenda_id: farm,
      status: "ativo",
      nome: "Bezerreiro",
    } as never);
    await db.state_animais.update(calfId, {
      movement_version: 0,
      movement_head_event_id: null,
    });
    // The screen already shows the destination, but the current animal is still outside that lot.
    await registerPostPartumGesture(
      {
        ...input,
        calves: [{ ...calf, lote_id: lot }],
        drafts: [{ ...input.drafts[0], loteId: lot }],
      },
      readContext,
    );
    const moves = (await db.queue_ops.toArray()).filter(
      (op) => op.table === "movement_v1",
    );
    expect(moves).toHaveLength(1);
    expect(moves[0].record).toMatchObject({
      from_lote_id: null,
      to_lote_id: lot,
    });
    expect(await db.event_eventos_movimentacao.count()).toBe(1);
    expect((await db.state_animais.get(calfId))?.lote_id).toBe(lot);
  });
  it("gate OFF keeps valid facts/non-sanitary work and creates no local-only sanitary intent", async () => {
    const result = await registerPostPartumGesture(input, readContext);
    expect(result.sanitary.created).toBe(0);
    expect(result.sanitary.unavailable).toBe(7);
    expect(result.sanitary.reason).toBe("gate_off");
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(0);
    expect(await db.state_agenda_itens.count()).toBe(3);
    expect(await db.event_eventos_pesagem.count()).toBe(1);
    expect(
      (await db.queue_ops.toArray()).some((op) => op.table === "sanitario_v2"),
    ).toBe(false);
  });
  it("gate ON queues only canonical sanitary commands with the facts in one gesture", async () => {
    await enable();
    const result = await registerPostPartumGesture(input, readContext);
    expect(result.sanitary.created).toBe(7);
    const ops = await db.queue_ops.toArray();
    expect(ops.filter((op) => op.table === "agenda_itens")).toHaveLength(3);
    expect(ops.filter((op) => op.table === "sanitario_v2")).toHaveLength(7);
    expect(
      ops
        .filter((op) => op.table === "sanitario_v2")
        .every(
          (op) =>
            op.record.command === "create_agenda" &&
            op.record.payload.animal_ids[0] === calfId,
        ),
    ).toBe(true);
    expect(new Set(ops.map((op) => op.client_tx_id))).toEqual(
      new Set([result.txId]),
    );
  });
  it("a role allowed to record facts does not gain sanitary planning rights", async () => {
    await enable();
    context.role = "cowboy";
    const result = await registerPostPartumGesture(input, readContext);
    expect(result.sanitary.reason).toBe("planning_forbidden");
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(0);
    expect(await db.event_eventos_pesagem.count()).toBe(1);
  });
  it("missing cutover refuses sanitary creation without discarding facts", async () => {
    localStorage.setItem("rebanhosync:sanitario-v2-push", "local");
    const result = await registerPostPartumGesture(input, readContext);
    expect(result.sanitary.reason).toBe("cutover_unavailable");
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(0);
    expect(await db.event_eventos.count()).toBe(1);
  });
  it.each(["cancelada", "executada", "programada"])(
    "preserves an existing %s V2 row, revision and schedule",
    async (status) => {
      await enable();
      const draft = buildCalfJourneyAgendaOps({
        fazendaId: farm,
        calf,
        mother: input.mother,
      }).sanitarioAgendaV2[6];
      const row = {
        ...draft.agenda,
        fazenda_id: farm,
        revision: 9,
        status,
        data_programada: "2026-04-20",
        client_op_id: "original-op",
      } as SanitarioAgendaLocalV2;
      await db.ops_sanitario_agenda_v2.put(row);
      await registerPostPartumGesture(input, readContext);
      expect(await db.ops_sanitario_agenda_v2.get(row.id)).toEqual(row);
      expect(await db.ops_sanitario_agenda_v2.count()).toBe(7);
    },
  );
  it("tombstones and a legacy pending operation suppress matching intentions without rewriting either", async () => {
    await enable();
    const drafts = buildCalfJourneyAgendaOps({
      fazendaId: farm,
      calf,
      mother: input.mother,
    }).sanitarioAgendaV2;
    const row = {
      ...drafts[6].agenda,
      fazenda_id: farm,
      deleted_at: now,
    } as SanitarioAgendaLocalV2;
    await db.ops_sanitario_agenda_v2.put(row);
    const old = {
      client_op_id: "legacy-op",
      client_tx_id: "legacy-tx",
      table: "agenda_itens",
      action: "INSERT",
      sync_state: "REJECTED",
      record: {
        id: "legacy-agenda",
        fazenda_id: farm,
        animal_id: calfId,
        dedup_key: drafts[0].agenda.dedup_key,
        dominio: "sanitario",
        status: "agendado",
      },
    } as Operation;
    await db.queue_ops.put(old);
    await registerPostPartumGesture(input, readContext);
    expect(await db.queue_ops.get(old.client_op_id)).toEqual(old);
    expect(await db.ops_sanitario_agenda_v2.get(row.id)).toEqual(row);
    expect(
      await db.ops_sanitario_agenda_v2
        .where("dedup_key")
        .equals(drafts[0].agenda.dedup_key!)
        .count(),
    ).toBe(0);
  });
  it("a terminal legacy tombstone suppresses its milestone", async () => {
    await enable();
    await db.state_agenda_itens.put({
      id: "old",
      fazenda_id: farm,
      animal_id: calfId,
      tipo: "revisao_neonatal",
      dedup_key: `calf_journey:${calfId}:revisao_neonatal`,
      status: "cancelado",
      deleted_at: now,
    } as AgendaItem);
    await registerPostPartumGesture(input, readContext);
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(6);
    expect((await db.state_agenda_itens.get("old"))?.deleted_at).toBe(now);
  });
  it("two concurrent submissions create each sanitary intent once", async () => {
    await enable();
    await Promise.all([
      registerPostPartumGesture(input, readContext),
      registerPostPartumGesture(
        { ...input, occurredAt: "2026-04-01T12:00:01.000Z" },
        readContext,
      ),
    ]);
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(7);
    expect(
      (await db.queue_ops.toArray()).filter(
        (op) => op.table === "sanitario_v2",
      ),
    ).toHaveLength(7);
  });
  it("replay preserves operation IDs and captured revisions, including after a local reopen", async () => {
    await enable();
    await registerPostPartumGesture(input, readContext);
    const before = await db.queue_ops.toArray();
    await db.close();
    await db.open();
    const replay = await registerPostPartumGesture(input, readContext);
    expect(replay.replayed).toBe(true);
    expect(await db.queue_ops.toArray()).toEqual(before);
  });
  it("an intermediate write failure rolls back facts, queue and intentions together", async () => {
    await enable();
    let writes = 0;
    beforeCreate(() => {
      if (++writes === 3) throw new Error("I03_WRITE_FAILURE");
    });
    await expect(
      registerPostPartumGesture(input, readContext),
    ).rejects.toThrow();
    expect(await db.queue_ops.count()).toBe(0);
    expect(await db.queue_gestures.count()).toBe(0);
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(0);
    expect(await db.event_eventos.count()).toBe(0);
    expect((await db.state_animais.get(calfId))?.identificacao).toBe("CRIA");
  });
  it.each(["farm", "session"])(
    "a %s change during persistence rolls back the submission",
    async (change) => {
      await enable();
      beforeCreate(() => {
        context = {
          ...context,
          ...(change === "farm" ? { fazendaId: "other" } : { userId: "other" }),
        };
      });
      await expect(
        registerPostPartumGesture(input, readContext),
      ).rejects.toThrow("POSTPARTUM_CONTEXT_CHANGED");
      expect(await db.queue_ops.count()).toBe(0);
      expect(await db.event_eventos.count()).toBe(0);
    },
  );
  it("accepted historical facts and rejection evidence remain untouched", async () => {
    const fact = {
      id: birthId,
      fazenda_id: farm,
      dominio: "reproducao",
      payload: { historical: true },
    };
    await db.event_eventos.put(fact as never);
    await db.queue_rejections.add({
      client_tx_id: "old",
      client_op_id: "old-op",
      fazenda_id: farm,
      table: "agenda_itens",
      action: "INSERT",
      reason_code: "CHECK_CONSTRAINT_VIOLATION",
      reason_message: "legacy",
      created_at: now,
    });
    await registerPostPartumGesture(input, readContext);
    expect(await db.event_eventos.get(birthId)).toEqual(fact);
    expect(await db.queue_rejections.count()).toBe(1);
  });
  it("refuses a mismatched birth link instead of changing the calf's origin", async () => {
    await expect(
      registerPostPartumGesture(
        { ...input, birthEventId: "another-birth" },
        readContext,
      ),
    ).rejects.toThrow("POSTPARTUM_BIRTH_LINK_MISMATCH");
    expect(await db.queue_ops.count()).toBe(0);
  });
  it("never overwrites an agenda ID already held by another farm", async () => {
    await enable();
    const draft = buildCalfJourneyAgendaOps({
      fazendaId: farm,
      calf,
      mother: input.mother,
    }).sanitarioAgendaV2[6];
    const other = {
      ...draft.agenda,
      fazenda_id: "other-farm",
      revision: 11,
    } as SanitarioAgendaLocalV2;
    await db.ops_sanitario_agenda_v2.put(other);
    await expect(registerPostPartumGesture(input, readContext)).rejects.toThrow(
      "POSTPARTUM_AGENDA_SCOPE_MISMATCH",
    );
    expect(await db.ops_sanitario_agenda_v2.get(other.id)).toEqual(other);
    expect(await db.queue_ops.count()).toBe(0);
  });
  it("does not commit new sanitary work if the gate turns OFF during persistence", async () => {
    await enable();
    beforeCreate(() =>
      localStorage.removeItem("rebanhosync:sanitario-v2-push"),
    );
    await expect(registerPostPartumGesture(input, readContext)).rejects.toThrow(
      "POSTPARTUM_PLANNING_CONTEXT_CHANGED",
    );
    expect(await db.queue_ops.count()).toBe(0);
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(0);
  });
  it("replay does not depend on JSON property ordering", async () => {
    await enable();
    const first = await registerPostPartumGesture(input, readContext);
    const draft = input.drafts[0];
    const replay = await registerPostPartumGesture(
      {
        ...input,
        drafts: [
          {
            curaUmbigo: draft.curaUmbigo,
            pesoKg: draft.pesoKg,
            loteId: draft.loteId,
            nome: draft.nome,
            identificacao: draft.identificacao,
            calfId,
          },
        ],
      },
      readContext,
    );
    expect(replay.txId).toBe(first.txId);
    expect(replay.replayed).toBe(true);
    expect(await db.event_eventos_pesagem.count()).toBe(1);
  });
  it.each([false, true])(
    "preserves canonical neonatal movement, concurrent retry and replay with gate ON=%s",
    async (gateOn) => {
      if (gateOn) await enable();
      await db.state_animais.update(calfId, {
        movement_version: 0,
        movement_head_event_id: null,
      });
      const lot = "55555555-5555-4555-8555-555555555555";
      await db.state_lotes.put({
        id: lot,
        fazenda_id: farm,
        status: "ativo",
        nome: "Bezerreiro",
      } as never);
      const neonatalInput = {
        ...input,
        drafts: [{ ...input.drafts[0], loteId: lot }],
      };
      const results = await Promise.all([
        registerPostPartumGesture(neonatalInput, readContext),
        registerPostPartumGesture(neonatalInput, readContext),
      ]);
      expect(results[0].txId).toBe(results[1].txId);
      expect(results.map((result) => result.replayed).sort()).toEqual([
        false,
        true,
      ]);
      const persisted = await db.queue_ops.toArray();
      db.close();
      await db.open();
      expect(
        (await registerPostPartumGesture(neonatalInput, readContext)).replayed,
      ).toBe(true);
      expect(await db.queue_ops.toArray()).toEqual(persisted);
      const moves = (await db.queue_ops.toArray()).filter(
        (op) => op.table === "movement_v1",
      );
      expect(moves).toHaveLength(1);
      expect(moves[0].record.to_lote_id).toBe(lot);
      expect((await db.state_animais.get(calfId))?.lote_id).toBe(lot);
      expect(await db.event_eventos_movimentacao.count()).toBe(1);
      expect(await db.event_eventos_pesagem.count()).toBe(1);
      expect(await db.ops_sanitario_agenda_v2.count()).toBe(gateOn ? 7 : 0);
      expect(
        persisted.filter((op) => op.table === "sanitario_v2"),
      ).toHaveLength(gateOn ? 7 : 0);
    },
  );
  it("rolls back a neonatal movement with a later failure and recovers on retry", async () => {
    await enable();
    await db.state_animais.update(calfId, {
      movement_version: 0,
      movement_head_event_id: null,
    });
    const lot = "55555555-5555-4555-8555-555555555555";
    await db.state_lotes.put({
      id: lot,
      fazenda_id: farm,
      status: "ativo",
      nome: "Bezerreiro",
    } as never);
    const neonatalInput = {
      ...input,
      drafts: [{ ...input.drafts[0], loteId: lot }],
    };
    const originalCalf = await db.state_animais.get(calfId);
    let writes = 0;
    beforeCreate(() => {
      if (++writes === 3) throw new Error("INJECTED_NEONATAL_FAILURE");
    });
    await expect(
      registerPostPartumGesture(neonatalInput, readContext),
    ).rejects.toThrow("INJECTED_NEONATAL_FAILURE");
    expect(await db.state_animais.get(calfId)).toEqual(originalCalf);
    for (const table of [
      db.queue_ops,
      db.queue_gestures,
      db.event_eventos,
      db.event_eventos_movimentacao,
      db.event_eventos_pesagem,
      db.state_agenda_itens,
      db.ops_sanitario_agenda_v2,
      db.ops_sanitario_agenda_animais_v2,
    ]) {
      expect(await table.count()).toBe(0);
    }
    hookCleanups.splice(0).forEach((cleanup) => cleanup());
    db.close();
    await db.open();
    const recovered = await registerPostPartumGesture(
      neonatalInput,
      readContext,
    );
    expect(recovered.replayed).toBe(false);
    expect(await db.event_eventos_movimentacao.count()).toBe(1);
    expect(await db.ops_sanitario_agenda_v2.count()).toBe(7);
    expect(
      (await db.queue_ops.toArray()).filter((op) => op.table === "movement_v1"),
    ).toHaveLength(1);
  });
});
