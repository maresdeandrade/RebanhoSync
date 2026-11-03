import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db, LOCAL_OWNERSHIP_KEY } from "../db";
import type { Gesture, Operation } from "../types";
import {
  classifySanitaryRecovery,
  recoverSanitaryFoundation,
} from "../sanitaryFoundationRecovery";

const farm = crypto.randomUUID(),
  owner = crypto.randomUUID();
const operation = (): Operation => {
  const tx = crypto.randomUUID(),
    op = crypto.randomUUID(),
    domain = crypto.randomUUID();
  return {
    client_tx_id: tx,
    client_op_id: op,
    domain_op_id: domain,
    table: "sanitario_v2",
    action: "INSERT",
    created_at: "2026-10-30T12:00:00Z",
    record: {
      domain: "sanitario_v2",
      command: "create_agenda",
      contract_version: 2,
      fazenda_id: farm,
      client_tx_id: tx,
      client_op_id: op,
      domain_op_id: domain,
      payload: {
        agenda: { id: crypto.randomUUID() },
        animal_ids: [crypto.randomUUID()],
      },
    },
  };
};
async function seed(op: Operation) {
  await db.local_ownership.put({
    key: LOCAL_OWNERSHIP_KEY,
    owner_user_id: owner,
    updated_at: new Date().toISOString(),
  });
  await db.queue_gestures.put({
    client_tx_id: op.client_tx_id,
    fazenda_id: farm,
    client_id: "fixture",
    status: "ERROR",
    created_at: op.created_at,
  } satisfies Gesture);
  await db.queue_ops.put(op);
}
const ownership = async () => ({
  status: "OWNED" as const,
  ownerUserId: owner,
  currentUserId: owner,
});
describe("sanitary foundation recovery", () => {
  afterEach(async () => {
    for (const store of db.tables) await store.clear();
  });
  it.each(["unavailable", "not_covered"] as const)(
    "lookup_failure_or_uncovered_legacy_is_preserved (%s)",
    (status) => {
      expect(
        classifySanitaryRecovery({
          ownerMatches: true,
          originalEnvelope: operation(),
          receiptLookup: { status },
          correspondence: "exact",
          incompatiblePendingProven: true,
        }),
      ).toBe("preserve");
    },
  );
  it("only_authoritative_absence_and_proven_exact_correspondence_allow_candidate", () => {
    const base = {
      ownerMatches: true,
      originalEnvelope: operation(),
      receiptLookup: { status: "absent" as const },
      correspondence: "exact" as const,
      incompatiblePendingProven: true,
    };
    expect(classifySanitaryRecovery(base)).toBe("convert_candidate");
    expect(
      classifySanitaryRecovery({ ...base, incompatiblePendingProven: false }),
    ).toBe("preserve");
    expect(classifySanitaryRecovery({ ...base, ownerMatches: false })).toBe(
      "preserve",
    );
    expect(
      classifySanitaryRecovery({ ...base, correspondence: "ambiguous" }),
    ).toBe("preserve");
  });
  it("empty_queue_requires_no_conversion_or_new_store", async () => {
    const stores = db.tables.map((t) => t.name);
    const lookup = vi.fn();
    expect(
      await recoverSanitaryFoundation(farm, { ownership, lookup }),
    ).toEqual({ reconciled: 0, preserved: 0, conversionCandidates: 0 });
    expect(lookup).not.toHaveBeenCalled();
    expect(db.tables.map((t) => t.name)).toEqual(stores);
  });
  it("lost_ack_installs_original_receipt_without_changing_envelope_and_survives_restart", async () => {
    const op = operation();
    await seed(op);
    const canonical = { agenda_id: op.record.payload.agenda.id, revision: 0 };
    const lookup = vi.fn(async () => ({
      status: "found" as const,
      canonicalResult: canonical,
    }));
    expect(
      await recoverSanitaryFoundation(farm, { ownership, lookup }),
    ).toEqual({ reconciled: 1, preserved: 0, conversionCandidates: 0 });
    expect((await db.queue_ops.get(op.client_op_id))?.record).toEqual(
      op.record,
    );
    db.close();
    await db.open();
    const restored = await db.queue_ops.get(op.client_op_id);
    expect(restored?.sanitary_receipt?.canonical_result).toEqual(canonical);
    expect(restored?.sync_state).toBe("RECONCILE");
    expect(
      (await db.sync_reconcile_obligations.toArray()).some(
        (r) => r.fazenda_id === farm,
      ),
    ).toBe(true);
    expect(
      (await recoverSanitaryFoundation(farm, { ownership, lookup }))
        .conversionCandidates,
    ).toBe(0);
    expect(await db.queue_ops.count()).toBe(1);
  });
  it.each(["UNKNOWN", "MISMATCH"] as const)(
    "unknown_or_mismatched_owner_preserves_without_send (%s)",
    async (status) => {
      const op = operation();
      await seed(op);
      const lookup = vi.fn();
      expect(
        await recoverSanitaryFoundation(farm, {
          ownership: async () => ({
            status,
            ownerUserId: null,
            currentUserId: owner,
          }),
          lookup,
        }),
      ).toEqual({ reconciled: 0, preserved: 1, conversionCandidates: 0 });
      expect(lookup).not.toHaveBeenCalled();
      expect(await db.queue_ops.get(op.client_op_id)).toEqual(op);
    },
  );
  it("uncovered_legacy_and_orphan_operations_are_inventoried_and_preserved", async () => {
    const op = operation();
    op.table = "agenda_itens";
    op.record = { fazenda_id: farm, dominio: "sanitario" };
    await db.queue_ops.put(op);
    const lookup = vi.fn(),
      onInventory = vi.fn();
    expect(
      await recoverSanitaryFoundation(farm, { ownership, lookup, onInventory }),
    ).toEqual({ reconciled: 0, preserved: 1, conversionCandidates: 0 });
    expect(lookup).not.toHaveBeenCalled();
    expect(onInventory).toHaveBeenCalledWith({
      byCommand: { not_covered: 1 },
      byState: { PENDING: 1 },
      ownership: "OWNED",
    });
    expect(await db.queue_ops.get(op.client_op_id)).toEqual(op);
  });
  it("lookup_failure_is_not_absence_and_does_not_rewrite_rejection", async () => {
    const op = { ...operation(), sync_state: "REJECTED" as const };
    await seed(op);
    await recoverSanitaryFoundation(farm, {
      ownership,
      lookup: async () => ({ status: "unavailable" }),
    });
    expect(await db.queue_ops.get(op.client_op_id)).toEqual(op);
  });
  it("farm_switch_or_owner_change_during_lookup_cannot_install_receipt", async () => {
    const op = operation();
    await seed(op);
    await recoverSanitaryFoundation(farm, {
      ownership,
      lookup: async () => {
        await db.local_ownership.update(LOCAL_OWNERSHIP_KEY, {
          owner_user_id: crypto.randomUUID(),
        });
        return {
          status: "found",
          canonicalResult: { agenda_id: op.record.payload.agenda.id },
        };
      },
    });
    expect(
      (await db.queue_ops.get(op.client_op_id))?.sanitary_receipt,
    ).toBeUndefined();
  });
  it("local_fact_without_queue_is_not_synced_by_assumption", async () => {
    await db.event_eventos.put({
      id: crypto.randomUUID(),
      fazenda_id: farm,
      dominio: "sanitario",
    } as import("../types").Evento);
    const lookup = vi.fn();
    const result = await recoverSanitaryFoundation(farm, { ownership, lookup });
    expect(result.preserved).toBe(1);
    expect(lookup).not.toHaveBeenCalled();
    expect(await db.queue_ops.count()).toBe(0);
    expect(await db.event_eventos.count()).toBe(1);
  });

  it.each(["collision", "late", "dependency"])("keeps a durable %s receipt as CONFLICT after restart, never APPLIED", async (outcome) => {
    const op = operation();
    const eventId = crypto.randomUUID();
    op.record = {
      ...op.record,
      command: "apply_factual_core",
      contract_version: 3,
      payload: { event: { id: eventId } },
    };
    await seed(op);
    await recoverSanitaryFoundation(farm, {
      ownership,
      lookup: async () => ({
        status: "found",
        canonicalResult: {
          evento_id: eventId,
          confirmed: false,
          outcome,
        },
      }),
    });
    expect(
      (await db.queue_ops.get(op.client_op_id))?.sanitary_receipt,
    ).toMatchObject({
      status: "CONFLICT",
      reason_code: outcome === "late" ? "SANITARIO_LATE_RECORD" : outcome === "dependency" ? "SANITARIO_CONTINUATION_DEPENDENCY" : "SANITARIO_OBLIGATION_COLLISION",
    });
  });
});
