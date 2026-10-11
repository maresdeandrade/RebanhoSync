/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
import { selectPostAckAnimalObservation } from "../syncWorker";
import type { Gesture, Operation, SyncOperationResult } from "../types";
const id = "10000000-0000-4000-8000-000000000001";
const gesture: Gesture = { client_tx_id: id, fazenda_id: id, client_id: "client", status: "SYNCING", created_at: "2026-10-10T00:00:00Z" };
const op: Operation = { client_op_id: id, client_tx_id: id, table: "animais", action: "UPDATE", expected_revision: 1, created_at: gesture.created_at, record: { id, observacoes: "note", fazenda_id: id, client_id: "client", client_tx_id: id, client_op_id: id, client_recorded_at: gesture.created_at } };
const result: SyncOperationResult = { op_id: id, status: "APPLIED" };
describe("closed post-ACK selector", () => {
  it("accepts exactly one recognized note UPDATE including null", () => {
    expect(selectPostAckAnimalObservation(gesture, [op], [result])).toBe(id);
    expect(selectPostAckAnimalObservation(gesture, [{ ...op, record: { ...op.record, observacoes: null } }], [result])).toBe(id);
  });
  it.each(["eventos", "eventos_comercial", "eventos_movimentacao", "eventos_sanitario", "eventos_reproducao", "agenda_itens"])("falls back for %s", table => {
    expect(selectPostAckAnimalObservation(gesture, [{ ...op, table }], [result])).toBeNull();
  });
  it.each(["INSERT", "DELETE"] as const)("falls back for %s", action => {
    expect(selectPostAckAnimalObservation(gesture, [{ ...op, action }], [result])).toBeNull();
  });
  it.each(["APPLIED_ALTERED", "CONFLICT", "RETRYABLE", "REJECTED", "BLOCKED_DEPENDENCY"] as const)("falls back for %s", status => {
    expect(selectPostAckAnimalObservation(gesture, [op], [{ ...result, status }])).toBeNull();
  });
  it("rejects additional/deferred ops and mixed or mismatched results", () => {
    expect(selectPostAckAnimalObservation(gesture, [op, { ...op, sync_state: "REJECTED" }], [result])).toBeNull();
    expect(selectPostAckAnimalObservation(gesture, [op], [result, result])).toBeNull();
    expect(selectPostAckAnimalObservation(gesture, [op], [{ ...result, op_id: "other" }])).toBeNull();
  });
  it.each([undefined, 0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1])("rejects invalid revision %s", expected_revision => {
    expect(selectPostAckAnimalObservation(gesture, [{ ...op, expected_revision }], [result])).toBeNull();
  });
  it.each(["status", "lote_id", "payload", "revision", "updated_at", "sexo", "deleted_at"])("rejects unknown/business field %s", key => {
    expect(selectPostAckAnimalObservation(gesture, [{ ...op, record: { ...op.record, [key]: null } }], [result])).toBeNull();
  });
  it.each(["id", "fazenda_id", "client_id", "client_tx_id", "client_op_id", "client_recorded_at", "observacoes"])("rejects missing metadata/field %s", key => {
    const record = { ...op.record }; delete record[key];
    expect(selectPostAckAnimalObservation(gesture, [{ ...op, record }], [result])).toBeNull();
  });
  it("rejects canonical envelopes and cross-farm identities", () => {
    for (const extra of [{ movement_group: id }, { domain_op_id: id }, { command_digest: "digest" }]) {
      expect(selectPostAckAnimalObservation(gesture, [{ ...op, ...extra }], [result])).toBeNull();
    }
    expect(selectPostAckAnimalObservation(gesture, [{ ...op, record: { ...op.record, fazenda_id: "other" } }], [result])).toBeNull();
  });
});
