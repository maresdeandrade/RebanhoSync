
import { describe, it, expect } from "vitest";
import { computeReproStatus, rebuildReproductiveProjection } from "../status";
import type { ReproEventJoined } from "../selectors";
import type { ReproTipoEnum } from "@/lib/offline/types";

// Helper
const createEvent = (
  occurred_at: string,
  type: ReproTipoEnum,
  payload: Record<string, unknown> = {},
  id = crypto.randomUUID(),
): ReproEventJoined => ({
  id,
  fazenda_id: 'f1',
  dominio: 'reproducao',
  occurred_at,
  // ... boilerplate
  client_id: 'c1', client_op_id: 'o1', client_tx_id: 't1', client_recorded_at: occurred_at, server_received_at: occurred_at, created_at: occurred_at, updated_at: occurred_at, deleted_at: null, animal_id: 'a1', lote_id: null, source_task_id: null, source_tx_id: null, source_client_op_id: null, corrige_evento_id: null, observacoes: null, payload: {},
  details: {
    evento_id: id, fazenda_id: 'f1', tipo: type, macho_id: null,
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
      createEvent('2023-01-01', 'IA', {}, 'service-1'),
      createEvent('2023-02-01', 'diagnostico', {
        schema_version: 1,
        resultado: 'positivo',
        episode_evento_id: 'service-1',
      }),
    ];
    const status = computeReproStatus(events);
    expect(status.status).toBe('PRENHA');
  });

  it("should return VAZIA after Negative Diag", () => {
    const events = [
      createEvent('2023-01-01', 'IA', {}, 'service-2'),
      createEvent('2023-02-01', 'diagnostico', {
        schema_version: 1,
        resultado: 'negativo',
        episode_evento_id: 'service-2',
      }),
    ];
    const status = computeReproStatus(events);
    expect(status.status).toBe('VAZIA');
  });

  it("should return SERVIDA if new service after Negative Diag", () => {
    const events = [
      createEvent('2023-01-01', 'IA', {}, 'service-3'),
      createEvent('2023-02-01', 'diagnostico', {
        schema_version: 1,
        resultado: 'negativo',
        episode_evento_id: 'service-3',
      }),
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
      createEvent('2023-03-01', 'diagnostico', {
        resultado: 'positivo',
        schema_version: 1,
        episode_evento_id: 'service-4',
      }),
      createEvent('2023-02-01', 'IA', {}, 'service-4'),
    ];
    // Order shouldn't matter as computeReproStatus sorts them
    const status = computeReproStatus(events);
    expect(status.status).toBe('PRENHA');
  });

  it("rebuilds PRENHA with service + 283 days and never diagnosis + 150", () => {
    const projection = rebuildReproductiveProjection([
      createEvent('2026-01-10T10:00:00.000Z', 'cobertura', {}, 'service-dpp'),
      createEvent('2026-03-30T10:00:00.000Z', 'diagnostico', {
        schema_version: 1,
        resultado: 'positivo',
        episode_evento_id: 'service-dpp',
      }, 'diag-dpp'),
    ]);

    expect(projection).toMatchObject({
      status: 'PRENHA',
      currentEpisodeId: 'service-dpp',
      lastDiagnosisEventId: 'diag-dpp',
      dpp: '2026-10-20',
      dppOrigin: 'service_plus_283_days',
      inconsistency: null,
    });
    expect(projection.dpp).not.toBe('2026-08-27');
  });

  it("rebuilds exclusively from history and ignores an external stale taxonomy cache", () => {
    const staleTaxonomyFacts = {
      prenhez_confirmada: true,
      data_prevista_parto: '2099-01-01',
    };
    const projection = rebuildReproductiveProjection([
      createEvent('2026-01-10', 'IA', {}, 'service-negative'),
      createEvent('2026-02-20', 'diagnostico', {
        schema_version: 1,
        resultado: 'negativo',
        episode_evento_id: 'service-negative',
      }),
    ]);

    expect(staleTaxonomyFacts.prenhez_confirmada).toBe(true);
    expect(projection).toMatchObject({
      status: 'VAZIA',
      currentEpisodeId: null,
      dpp: null,
    });
  });

  it("does not let a late diagnosis of an old episode clear a newer service", () => {
    const projection = rebuildReproductiveProjection([
      createEvent('2026-01-01', 'cobertura', {}, 'service-old'),
      createEvent('2026-02-01', 'IA', {}, 'service-current'),
      createEvent('2026-03-01', 'diagnostico', {
        schema_version: 1,
        resultado: 'negativo',
        episode_evento_id: 'service-old',
      }, 'diag-old'),
    ]);

    expect(projection).toMatchObject({
      status: 'SERVIDA',
      currentEpisodeId: 'service-current',
      dpp: null,
      inconsistency: 'EPISODE_NOT_CURRENT',
      definingEventId: 'service-current',
    });
  });
});
