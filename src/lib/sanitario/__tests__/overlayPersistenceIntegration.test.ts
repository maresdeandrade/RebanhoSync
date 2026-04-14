import { describe, it, expect } from "vitest";
import {
  buildRegulatoryOverlayConfigPayload,
  buildRegulatoryOverlayEventPayload,
  buildActiveRegulatoryOverlayEntries,
  type RegulatoryOverlayRuntimeRecord,
} from "@/lib/sanitario/compliance";
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import type {
  FazendaSanidadeConfig,
  CatalogoProtocoloOficial,
  CatalogoProtocoloOficialItem,
} from "@/lib/offline/types";

/**
 * PR3 Integration Test: Overlay Persistence
 *
 * Validates that:
 * 1. Overlay verification updates fazenda_sanidade_config.payload.overlay_runtime
 * 2. Creates an append-only conformidade event (no agenda_items generated)
 * 3. Uses segregated persistence (not touching protocol pipeline)
 */
describe("PR3: Overlay Persistence Integration", () => {
  const mockFazendaId = "farm-123";

  // Mock official protocol with overlay flag
  const mockTemplate = {
    slug: "raiva-vacinacao",
    codigo: "rv-001",
    nome: "Vacinação contra Raiva",
    descricao: "Protocolo de raiva",
    payload: {
      family_code: "brucelose:raiva",
      status_legal: "obrigatorio",
    },
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  } satisfies CatalogoProtocoloOficial;

  const mockItem = {
    codigo: "rv-001:1",
    template_slug: "raiva-vacinacao",
    indicacao: "Vacinação anual",
    payload: {
      milestone: "year_1",
      gera_agenda: true, // But overlay should override this
    },
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  } satisfies CatalogoProtocoloOficialItem;

  const mockConfig = {
    id: `config-${mockFazendaId}`,
    fazenda_id: mockFazendaId,
    payload: {
      overlay_runtime: {
        items: {} as Record<string, RegulatoryOverlayRuntimeRecord>,
        last_updated: "2026-01-01",
      },
    },
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  } satisfies FazendaSanidadeConfig;

  const mockEntry = {
    template: mockTemplate,
    item: mockItem,
    label: "Vacinação contra Raiva - Reforço",
    subarea: null,
    complianceKind: "checklist" as const,
    status: "pendente" as const,
    runtime: null,
    animalCentric: false,
    sourceScope: "oficial" as const,
    editable: false,
    customOverlayId: null,
  };

  it("updates overlay_runtime without touching protocol pipeline", () => {
    const submission = {
      status: "conforme" as const,
      occurredAt: "2026-04-12T10:30:00Z",
      responsible: "operator-1",
      notes: "Animal vacinado com sucesso",
      answers: {
        rotina_executada: true,
        pendencias_tratadas: true,
      },
    };

    const eventId = crypto.randomUUID();

    // Build overlay config payload (step 1: segregated payload update)
    const nextPayload = buildRegulatoryOverlayConfigPayload(
      mockConfig.payload,
      mockEntry,
      submission,
      eventId,
    );

    // Validate overlay_runtime was updated
    expect(nextPayload.overlay_runtime).toBeDefined();
    const overlayRuntime = nextPayload.overlay_runtime as Record<string, unknown>;
    const overlayItems = overlayRuntime.items as Record<string, unknown>;
    expect(Object.keys(overlayItems).length).toBeGreaterThan(0);

    // Validate the overlay record has correct structure
    const overlayKey = mockItem.codigo;
    expect(overlayItems[overlayKey]).toBeDefined();
    const overlayRecord = overlayItems[overlayKey] as Record<string, unknown>;
    expect(overlayRecord.status).toBe("conforme");
    expect(overlayRecord.checked_at).toBe(submission.occurredAt);
    expect(overlayRecord.source_scope).toBe("oficial");
  });

  it("creates append-only conformidade event without protocol modifications", () => {
    const submission = {
      status: "conforme" as const,
      occurredAt: "2026-04-12T10:30:00Z",
      responsible: "operator-1",
      notes: "Verificado",
      answers: { rotina_executada: true },
    };

    const eventId = crypto.randomUUID();

    // Build conformidade event (step 2: append-only event)
    const eventPayload = buildRegulatoryOverlayEventPayload(mockEntry, submission);

    // Build event gesture
    const gesture = buildEventGesture({
      dominio: "conformidade",
      fazendaId: mockFazendaId,
      occurredAt: submission.occurredAt,
      observacoes: `${mockEntry.label} registrado no overlay regulatorio`,
      complianceKind: mockEntry.complianceKind,
      payload: eventPayload,
    });

    // Validate only 'eventos' table is touched (append-only)
    const eventoOps = gesture.ops.filter((op) => op.table === "eventos");
    const otherOps = gesture.ops.filter((op) => op.table !== "eventos");

    expect(eventoOps).toHaveLength(1);
    expect(otherOps).toHaveLength(0); // No protocol pipeline ops

    // Validate evento has conformidade dominio
    const eventoOp = eventoOps[0];
    expect(eventoOp.action).toBe("INSERT");
    const eventoRecord = eventoOp.record as Record<string, unknown>;
    expect(eventoRecord.dominio).toBe("conformidade");
    expect(eventoRecord.payload).toEqual(eventPayload);
  });

  it("does not generate agenda_items from overlay submission", () => {
    const submission = {
      status: "conforme" as const,
      occurredAt: "2026-04-12T10:30:00Z",
      responsible: "operator-1",
      notes: "OK",
      answers: {} as Record<string, unknown>,
    };

    const eventId = crypto.randomUUID();

    // Build config payload
    const nextPayload = buildRegulatoryOverlayConfigPayload(
      mockConfig.payload,
      mockEntry,
      submission,
      eventId,
    );

    // Build event gesture
    const gesture = buildEventGesture({
      dominio: "conformidade",
      fazendaId: mockFazendaId,
      occurredAt: submission.occurredAt,
      observacoes: "Test",
      complianceKind: mockEntry.complianceKind,
      payload: buildRegulatoryOverlayEventPayload(mockEntry, submission),
    });

    // Validate: no agenda_itens touched
    const agendaOps = gesture.ops.filter((op) => op.table === "agenda_itens");
    expect(agendaOps).toHaveLength(0);

    // Validate: overlay_runtime exists in payload but doesn't flag for scheduling
    expect(nextPayload.overlay_runtime).toBeDefined();
    // overlay_runtime should not contain scheduling metadata
    const overlayRuntime = nextPayload.overlay_runtime as Record<string, unknown>;
    const overlayItems = overlayRuntime.items as Record<string, Record<string, unknown>>;
    expect(overlayItems).toBeDefined();
    // Items should have compliance info, not schedule info
    Object.values(overlayItems).forEach((item) => {
      expect(item.status).toMatch(/conforme|ajuste_necessario|pendente/);
      expect(item.checked_at).toBeDefined(); // Compliance timestamp, not schedule
      expect((item as Record<string, unknown>).proxima_ocorrencia).toBeUndefined(); // No scheduling field
      expect((item as Record<string, unknown>).dias_para_proxima).toBeUndefined(); // No scheduling field
    });
  });

  it("maintains overlay_runtime through multiple submissions", () => {
    let payload = { ...mockConfig.payload };

    // First submission
    const submission1 = {
      status: "ajuste_necessario" as const,
      occurredAt: "2026-04-10T10:00:00Z",
      responsible: "op-1",
      notes: "Primeira verificação",
      answers: { rotina_executada: false },
    };

    payload = buildRegulatoryOverlayConfigPayload(
      payload,
      mockEntry,
      submission1,
      crypto.randomUUID(),
    );

    expect(payload.overlay_runtime).toBeDefined();
    const overlayRuntime1 = payload.overlay_runtime as Record<string, unknown>;
    const overlayItems1 = overlayRuntime1.items as Record<string, Record<string, unknown>>;
    const item1 = overlayItems1[mockItem.codigo];
    expect(item1.status).toBe("ajuste_necessario");
    expect(item1.checked_at).toBe(submission1.occurredAt);

    // Second submission (update same item)
    const submission2 = {
      status: "conforme" as const,
      occurredAt: "2026-04-12T14:00:00Z",
      responsible: "op-1",
      notes: "Ajuste realizado",
      answers: { rotina_executada: true },
    };

    payload = buildRegulatoryOverlayConfigPayload(
      payload,
      mockEntry,
      submission2,
      crypto.randomUUID(),
    );

    // Validate update: newer submission overwrites
    const overlayRuntime2 = payload.overlay_runtime as Record<string, unknown>;
    const overlayItems2 = overlayRuntime2.items as Record<string, Record<string, unknown>>;
    const item2 = overlayItems2[mockItem.codigo];
    expect(item2.status).toBe("conforme");
    expect(item2.checked_at).toBe(submission2.occurredAt);
    expect(item2.responsible).toBe("op-1");

    // Validate item's checked_at is updated to second submission time
    expect(new Date(item2.checked_at as string).getTime()).toBeGreaterThan(
      new Date(submission1.occurredAt).getTime(),
    );
  });
});
