import { describe, expect, it } from "vitest";
import {
  hasPendingSanitaryPlanningDependencyV2,
  mapQueuedSanitaryPlanV2,
  queuedSanitaryPlanV2,
} from "../sanitaryPlanningSyncV2";
import type { Operation } from "@/lib/offline/types";

const key = "sanitary_agenda_automation_v2";
const operation = (): Operation => ({
  client_op_id: crypto.randomUUID(),
  client_tx_id: crypto.randomUUID(),
  op_order: 0,
  table: "fazenda_sanidade_config",
  action: "UPDATE",
  created_at: "2026-10-17T00:00:00Z",
  record: {
    fazenda_id: "farm",
    payload: { unrelated: "preserved", [key]: { revision: 3, enabled: true } },
  },
  before_snapshot: {
    fazenda_id: "farm",
    payload: { unrelated: "preserved", [key]: { revision: 2, enabled: false } },
  },
});
describe("immutable legacy plan transport", () => {
  it("retains operation identities and derives CAS from the queued revision", () => {
    const op = operation(),
      before = structuredClone(op);
    const envelope = mapQueuedSanitaryPlanV2(op, "farm");
    expect(envelope).toMatchObject({
      command: "set_automation_plan",
      expected_revision: 2,
      client_op_id: op.client_op_id,
      domain_op_id: op.client_op_id,
      client_tx_id: op.client_tx_id,
    });
    expect(op).toEqual(before);
    expect(mapQueuedSanitaryPlanV2(op, "farm")).toEqual(envelope);
  });
  it("does not discard profile fields or reclassify a profile update containing a plan", () => {
    const op = operation();
    op.record.payload.unrelated = "new profile value";
    expect(queuedSanitaryPlanV2(op)).toBeNull();
    op.record.payload.unrelated = "preserved";
    op.record.uf = "DF";
    expect(queuedSanitaryPlanV2(op)).toBeNull();
  });
  it("leaves malformed or ambiguous older queue shapes untouched", () => {
    const op = operation();
    delete op.before_snapshot;
    expect(mapQueuedSanitaryPlanV2(op, "farm")).toBeNull();
    op.before_snapshot = { payload: { [key]: { revision: 3 } } };
    expect(mapQueuedSanitaryPlanV2(op, "farm")).toBeNull();
  });
  it("does not let a later plan or generated Agenda overtake a pending plan, including retry", () => {
    const parent = operation(),
      child = operation();
    parent.sync_state = "RETRYABLE";
    child.record.payload[key].revision = 4;
    child.before_snapshot.payload[key].revision = 3;
    expect(hasPendingSanitaryPlanningDependencyV2(child, [parent])).toBe(true);
    expect(hasPendingSanitaryPlanningDependencyV2(parent, [child])).toBe(false);
    const create = operation();
    create.record = {
      domain: "sanitario_v2",
      fazenda_id: "farm",
      command: "create_agenda",
      payload: {
        agenda: { id: "agenda", metadata: { automationPlanRevision: 3 } },
      },
    };
    expect(hasPendingSanitaryPlanningDependencyV2(create, [parent])).toBe(true);
    parent.record.fazenda_id = "other-farm";
    expect(hasPendingSanitaryPlanningDependencyV2(create, [parent])).toBe(
      false,
    );
  });
  it("preserves schedule/cancellation order across gestures without changing rejected operations", () => {
    const create = operation(),
      schedule = operation(),
      cancel = operation();
    create.record = {
      domain: "sanitario_v2",
      command: "create_agenda",
      payload: { agenda: { id: "agenda" } },
    };
    schedule.record = {
      domain: "sanitario_v2",
      command: "reschedule_agenda",
      expected_revision: 0,
      payload: { agenda_id: "agenda" },
    };
    cancel.record = {
      domain: "sanitario_v2",
      command: "close_agenda",
      expected_revision: 1,
      payload: { closure: { agenda_id: "agenda" } },
    };
    expect(hasPendingSanitaryPlanningDependencyV2(schedule, [create])).toBe(
      true,
    );
    expect(hasPendingSanitaryPlanningDependencyV2(cancel, [schedule])).toBe(
      true,
    );
    expect(hasPendingSanitaryPlanningDependencyV2(schedule, [cancel])).toBe(
      false,
    );
    schedule.sync_state = "REJECTED";
    expect(hasPendingSanitaryPlanningDependencyV2(cancel, [schedule])).toBe(
      false,
    );
  });
});
