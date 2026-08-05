import { describe, expect, it } from "vitest";
import {
  resolveReproductionDiagnosisDependency,
  sameReproductionDiagnosisRecord,
  validatePregnancyDiagnosis,
} from "./reproduction-diagnosis.ts";
import type { Operation } from "./rules.ts";

const eventOp: Operation = {
  client_op_id: "op-event",
  table: "eventos",
  action: "INSERT",
  record: {
    id: "event-diagnosis",
    fazenda_id: "farm-1",
    dominio: "reproducao",
    animal_id: "cow-1",
    occurred_at: "2026-03-01T10:00:00.000Z",
  },
};

const detailOp: Operation = {
  client_op_id: "op-detail",
  table: "eventos_reproducao",
  action: "INSERT",
  record: {
    evento_id: "event-diagnosis",
    fazenda_id: "farm-1",
    tipo: "diagnostico",
    payload: {
      schema_version: 1,
      resultado: "positivo",
      episode_evento_id: "service-1",
    },
  },
};

describe("reproduction diagnosis sync contract", () => {
  it("blocks the detail when the base event has not been applied", async () => {
    const dependency = await resolveReproductionDiagnosisDependency({
      operation: detailOp,
      operations: [eventOp, detailOp],
      processedResults: [{ op_id: "op-event", status: "REJECTED" }],
      fazendaId: "farm-1",
      loadRemoteEvent: async () => ({ data: null, error: null }),
    });

    expect(dependency).toMatchObject({
      status: "BLOCKED_DEPENDENCY",
      reason_code: "REPRODUCTION_EVENT_NOT_APPLIED",
    });
  });

  it("accepts an applied parent and validates farm, animal, type and chronology", async () => {
    const dependency = await resolveReproductionDiagnosisDependency({
      operation: detailOp,
      operations: [eventOp, detailOp],
      processedResults: [{ op_id: "op-event", status: "APPLIED" }],
      fazendaId: "farm-1",
      loadRemoteEvent: async () => ({ data: null, error: null }),
    });
    expect(dependency.status).toBe("READY");
    if (dependency.status !== "READY") return;

    expect(validatePregnancyDiagnosis({
      detail: detailOp.record,
      event: dependency.event,
      episode: {
        id: "service-1",
        fazenda_id: "farm-1",
        animal_id: "cow-1",
        occurred_at: "2026-01-01T10:00:00.000Z",
      },
      episodeType: "cobertura",
      fazendaId: "farm-1",
    })).toBeNull();
    expect(validatePregnancyDiagnosis({
      detail: detailOp.record,
      event: dependency.event,
      episode: {
        id: "service-1",
        fazenda_id: "farm-2",
        animal_id: "cow-other",
        occurred_at: "2026-04-01T10:00:00.000Z",
      },
      episodeType: "diagnostico",
      fazendaId: "farm-1",
    })).toBe("INVALID_EPISODE_REFERENCE");
  });

  it("treats identical replay as applied content and divergent identity as conflict", () => {
    const persisted = {
      ...eventOp.record,
      client_id: "client-1",
      client_op_id: "op-event",
      client_tx_id: "tx-1",
      client_recorded_at: "2026-03-01T10:00:00.000Z",
      server_received_at: "server-only",
    };
    expect(sameReproductionDiagnosisRecord("eventos", persisted, {
      ...persisted,
      client_recorded_at: "2026-03-01T10:00:00+00:00",
      server_received_at: "ignored",
    })).toBe(true);
    expect(sameReproductionDiagnosisRecord("eventos", persisted, {
      ...persisted,
      observacoes: "divergent",
    })).toBe(false);
  });
});
