
import { describe, it, expect } from "vitest";
import { findLinkedServiceForDiagnostic, findLinkedServiceForParto } from "../linking";
import type { ReproEventJoined } from "../selectors";

// Mock Helper
const createEvent = (
  id: string, 
  occurred_at: string, 
  type: string, 
  payload: any = {}
): ReproEventJoined => ({
  id,
  fazenda_id: 'fazenda-1',
  dominio: 'reproducao',
  occurred_at,
  client_id: 'client-1',
  client_op_id: 'op-1',
  client_tx_id: 'tx-1',
  client_recorded_at: occurred_at,
  server_received_at: occurred_at,
  created_at: occurred_at,
  updated_at: occurred_at,
  deleted_at: null,
  animal_id: 'animal-1',
  lote_id: null,
  source_task_id: null,
  source_tx_id: null,
  source_client_op_id: null,
  corrige_evento_id: null,
  observacoes: null,
  payload: {},
  details: {
    evento_id: id,
    fazenda_id: 'fazenda-1',
    tipo: type as any,
    macho_id: null,
    payload,
    client_id: 'client-1',
    client_op_id: 'op-1',
    client_tx_id: 'tx-1',
    client_recorded_at: occurred_at,
    server_received_at: occurred_at,
    created_at: occurred_at,
    updated_at: occurred_at,
    deleted_at: null,
  }
});

describe("Repro Linking Algorithm A (Diagnostic)", () => {
  it("should find the latest service before diagnostic", () => {
    const events = [
      createEvent('s1', '2023-01-01', 'IA'),
      createEvent('s2', '2023-02-01', 'cobertura'),
      createEvent('s3', '2023-03-01', 'IA'),
    ];

    // Diag at 2023-02-15 -> Should pick s2 (Feb 1)
    const linked = findLinkedServiceForDiagnostic(events, '2023-02-15');
    expect(linked?.id).toBe('s2');
  });

  it("should return null if no service exists before diagnostic", () => {
    const events = [
      createEvent('s1', '2023-03-01', 'IA'), // Future
    ];
    const linked = findLinkedServiceForDiagnostic(events, '2023-02-01');
    expect(linked).toBeNull();
  });
});

describe("Repro Linking Algorithm B (Parto)", () => {
  it("should prefer service with POSITIVE diagnostic", () => {
    const events = [
      createEvent('s1', '2023-01-01', 'IA'), // Older
      createEvent('d1', '2023-01-30', 'diagnostico', { schema_version: 1, resultado: 'positivo', episode_evento_id: 's1' }),
      createEvent('s2', '2023-02-01', 'IA'), // Newer but no diag
    ];

    // Parto at 2023-10-01. even if s2 is closer, d1 confirms s1.
    // Wait, s2 is OPEN. And s1 is CONFIRMED.
    // Logic: Prefer Positive Diag.
    const result = findLinkedServiceForParto(events, '2023-10-01');
    expect(result.method).toBe('auto_B');
    expect(result.event?.id).toBe('s1');
  });

  it("should fallback to latest OPEN service if no positive diag", () => {
    const events = [
      createEvent('s1', '2023-01-01', 'IA'), 
      createEvent('s2', '2023-02-01', 'IA'), // Latest open
    ];

    const result = findLinkedServiceForParto(events, '2023-10-01');
    expect(result.method).toBe('auto_B');
    expect(result.event?.id).toBe('s2');
  });

  it("should ignore services already linked to OTHER partos", () => {
    const events = [
      createEvent('s1', '2023-01-01', 'IA'),
      createEvent('p1', '2023-10-01', 'parto', { schema_version: 1, episode_evento_id: 's1' }),
      createEvent('s2', '2023-11-01', 'IA'), // Only available one
    ];

    // New parto at 2024-08-01
    const result = findLinkedServiceForParto(events, '2024-08-01');
    expect(result.event?.id).toBe('s2');
  });

  it("should prioritize LINKED positive diagnostic over date-based match (Algo B)", () => {
    const service1 = createEvent('s1', '2023-01-01', 'IA');
    const service2 = createEvent('s2', '2023-02-01', 'IA');
    
    // Diag linked to Service 1 (Older), but occurred later? 
    // Scenario: Cow was inseminated Jan 1, Diag Pos on Mar 1.
    // Then Inseminated Feb 1 (Mistake?), Diag Neg on Mar 2.
    // Let's test: Parto on Oct 1.
    // We have a Positive Diag linked to Service 1.
    // We have an Open Service 2 (newer).
    // Algo B should pick Service 1 because of the Positive Diag link.
    
    const diagPos = createEvent('d1', '2023-03-01', 'diagnostico', {
        schema_version: 1,
        resultado: 'positivo',
        episode_evento_id: service1.id // Link to Service 1
    });

    const events: ReproEventJoined[] = [service1, service2, diagPos];
    
    // Parto on Oct 1
    const match = findLinkedServiceForParto(events, '2023-10-01');
    
    expect(match.event?.id).toBe(service1.id);
    expect(match.method).toBe('auto_B'); 
  });

  it("should exclude services already linked to a prior parto (Algo A)", () => {
      // Service 1 -> Parto 1.
      // Diag 2 -> Should NOT link to Service 1.
      const service1 = createEvent('s1', '2023-01-01', 'IA');
      const parto1 = createEvent('p1', '2023-10-01', 'parto', {
          schema_version: 1,
          episode_evento_id: service1.id
      });
      
      const diag2 = createEvent('d2', '2023-11-01', 'diagnostico');
      
      const events: ReproEventJoined[] = [service1, parto1];
      
      const match = findLinkedServiceForDiagnostic(events, '2023-11-01');
      expect(match).toBeNull(); // Service 1 is taken.
  });
});
