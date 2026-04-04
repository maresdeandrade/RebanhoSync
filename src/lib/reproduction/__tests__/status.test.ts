
import { describe, it, expect } from "vitest";
import { computeReproStatus } from "../status";
import type { ReproEventJoined } from "../selectors";
import type { ReproTipoEnum } from "@/lib/offline/types";

// Helper
const createEvent = (
  occurred_at: string, 
  type: ReproTipoEnum, 
  payload: Record<string, unknown> = {}
): ReproEventJoined => ({
  id: crypto.randomUUID(),
  fazenda_id: 'f1',
  dominio: 'reproducao',
  occurred_at,
  // ... boilerplate
  client_id: 'c1', client_op_id: 'o1', client_tx_id: 't1', client_recorded_at: occurred_at, server_received_at: occurred_at, created_at: occurred_at, updated_at: occurred_at, deleted_at: null, animal_id: 'a1', lote_id: null, source_task_id: null, source_tx_id: null, source_client_op_id: null, corrige_evento_id: null, observacoes: null, payload: {},
  details: {
    evento_id: 'x', fazenda_id: 'f1', tipo: type, macho_id: null, 
    payload,
    client_id: 'c1', client_op_id: 'o1', client_tx_id: 't1', client_recorded_at: occurred_at, server_received_at: occurred_at, created_at: occurred_at, updated_at: occurred_at, deleted_at: null,
  }
});

describe("Repro Status Calculation", () => {
  it("should return VAZIA for empty history", () => {
    const status = computeReproStatus([]);
    expect(status.status).toBe('VAZIA');
  });

  it("should return SERVIDA after single service", () => {
    const events = [createEvent('2023-01-01', 'IA')];
    const status = computeReproStatus(events);
    expect(status.status).toBe('SERVIDA');
  });

  it("should return PRENHA after Positive Diag", () => {
    const events = [
      createEvent('2023-01-01', 'IA'),
      createEvent('2023-02-01', 'diagnostico', { schema_version: 1, resultado: 'positivo' })
    ];
    const status = computeReproStatus(events);
    expect(status.status).toBe('PRENHA');
  });

  it("should return VAZIA after Negative Diag", () => {
    const events = [
      createEvent('2023-01-01', 'IA'),
      createEvent('2023-02-01', 'diagnostico', { schema_version: 1, resultado: 'negativo' })
    ];
    const status = computeReproStatus(events);
    expect(status.status).toBe('VAZIA');
  });

  it("should return SERVIDA if new service after Negative Diag", () => {
    const events = [
      createEvent('2023-01-01', 'IA'),
      createEvent('2023-02-01', 'diagnostico', { resultado: 'negativo' }), // Legacy format check too
      createEvent('2023-02-15', 'cobertura')
    ];
    const status = computeReproStatus(events);
    expect(status.status).toBe('SERVIDA');
  });

  it("should return PARIDA_PUERPERIO if parto < 60 days", () => {
    const today = new Date();
    const recentDate = new Date(today);
    recentDate.setDate(today.getDate() - 30); // 30 days ago
    
    const events = [
      createEvent('2023-01-01', 'IA'),
      createEvent(recentDate.toISOString(), 'parto')
    ];
    const status = computeReproStatus(events);
    expect(status.status).toBe('PARIDA_PUERPERIO');
  });

  it("should return PARIDA_ABERTA if parto > 60 days", () => {
    const today = new Date();
    const oldDate = new Date(today);
    oldDate.setDate(today.getDate() - 70); // 70 days ago
    
    const events = [
      createEvent(oldDate.toISOString(), 'parto')
    ];
    const status = computeReproStatus(events);
    expect(status.status).toBe('PARIDA_ABERTA');
  });

  it("should return PRENHA even if older service exists", () => {
    const events = [
      createEvent('2023-03-01', 'diagnostico', { resultado: 'positivo', schema_version: 1 }),
      createEvent('2023-02-01', 'IA')
    ];
    // Order shouldn't matter as computeReproStatus sorts them
    const status = computeReproStatus(events);
    expect(status.status).toBe('PRENHA');
  });
});
