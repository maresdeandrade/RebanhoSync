import { describe, expect, it } from "vitest";
import { hasPendingSanitaryPlanningDependencyV2 } from "../sanitaryPlanningSyncV2";
import type { Operation } from "@/lib/offline/types";

const operation = (): Operation => ({
  client_op_id: crypto.randomUUID(),
  client_tx_id: crypto.randomUUID(),
  op_order: 0,
  table: "sanitario_v2",
  action: "INSERT",
  created_at: "2026-10-17T00:00:00Z",
  record: {
    domain: "sanitario_v2",
    contract_version: 3,
    fazenda_id: "farm",
    command: "create_agenda",
    payload: { agenda: { id: crypto.randomUUID() } },
  },
});

describe("ordering of manual sanitary agenda operations", () => {
  it("keeps factual execution behind its queued agenda creation or prior reschedule", () => {
    const agendaId = "agenda-1";
    const create = operation();
    const execution = operation();
    const reschedule = operation();
    create.record = {
      domain: "sanitario_v2",
      fazenda_id: "farm",
      command: "create_agenda",
      payload: { agenda: { id: agendaId } },
    };
    execution.record = {
      domain: "sanitario_v2",
      fazenda_id: "farm",
      command: "apply_factual_core",
      expected_revision: 1,
      payload: { event: { source_sanitario_agenda_v2_id: agendaId } },
    };
    reschedule.record = {
      domain: "sanitario_v2",
      fazenda_id: "farm",
      command: "reschedule_agenda",
      expected_revision: 0,
      payload: { agenda_id: agendaId },
    };
    const before = structuredClone([create, execution, reschedule]);

    expect(hasPendingSanitaryPlanningDependencyV2(execution, [create])).toBe(true);
    expect(hasPendingSanitaryPlanningDependencyV2(execution, [reschedule])).toBe(true);
    expect([create, execution, reschedule]).toEqual(before);
    expect(hasPendingSanitaryPlanningDependencyV2(execution, [])).toBe(false);
    create.record.payload.agenda.id = "another-agenda";
    expect(hasPendingSanitaryPlanningDependencyV2(execution, [create])).toBe(false);
  });

  it("preserves schedule and cancellation order across queued manual operations", () => {
    const agendaId = "agenda-2";
    const create = operation();
    const schedule = operation();
    const cancel = operation();
    create.record = {
      domain: "sanitario_v2",
      command: "create_agenda",
      payload: { agenda: { id: agendaId } },
    };
    schedule.record = {
      domain: "sanitario_v2",
      command: "reschedule_agenda",
      expected_revision: 0,
      payload: { agenda_id: agendaId },
    };
    cancel.record = {
      domain: "sanitario_v2",
      command: "close_agenda",
      expected_revision: 1,
      payload: { closure: { agenda_id: agendaId } },
    };

    expect(hasPendingSanitaryPlanningDependencyV2(schedule, [create])).toBe(true);
    expect(hasPendingSanitaryPlanningDependencyV2(cancel, [schedule])).toBe(true);
    expect(hasPendingSanitaryPlanningDependencyV2(schedule, [cancel])).toBe(false);
    schedule.sync_state = "REJECTED";
    expect(hasPendingSanitaryPlanningDependencyV2(cancel, [schedule])).toBe(false);
  });
});
