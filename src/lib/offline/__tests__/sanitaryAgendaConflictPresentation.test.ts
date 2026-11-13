import { describe, expect, it } from "vitest";
import { findUnreconciledSanitaryAgendaConflicts } from "../sanitaryAgendaConflictPresentation";
import type { Operation } from "../types";
import type { ReconciliationObligation } from "../reconciliationTypes";

describe("sanitary agenda conflict presentation", () => {
  it("atribui ao reagendamento rejeitado a Agenda da fazenda com reconciliação pendente", () => {
    const op = { client_op_id: "op", client_tx_id: "tx", table: "sanitario_v2", sync_state: "REJECTED", blocked_reason: "SANITARIO_AGENDA_REVISION_CONFLICT", record: { domain: "sanitario_v2", command: "reschedule_agenda", fazenda_id: "farm-a", expected_revision: 1, payload: { agenda_id: "agenda-a" } } } as Operation;
    const obligation = { fazenda_id: "farm-a", scope: "sanitario-v2", diagnostics: { origins: [{ client_tx_id: "tx", client_op_ids: ["op"] }] } } as ReconciliationObligation;
    expect(findUnreconciledSanitaryAgendaConflicts("farm-a", [op], [obligation])).toEqual(new Map([["agenda-a", "tx"]]));
    expect(findUnreconciledSanitaryAgendaConflicts("farm-b", [op], [obligation]).size).toBe(0);
    expect(findUnreconciledSanitaryAgendaConflicts("farm-a", [op], []).size).toBe(0);
  });
});
