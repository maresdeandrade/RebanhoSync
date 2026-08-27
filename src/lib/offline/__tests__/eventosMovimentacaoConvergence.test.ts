/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rows: new Map<string, unknown[]>() }));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      select: () => ({
        eq: async (_column: string, fazendaId: string) => ({
          data: (mocks.rows.get(table) ?? []).filter(
            (row) =>
              (row as { fazenda_id?: string }).fazenda_id === fazendaId,
          ),
          error: null,
        }),
      }),
    })),
  },
}));

import { db } from "../db";
import { DEFAULT_REMOTE_TABLES, pullDataForFarm } from "../pull";
import { STANDARD_EVENT_DETAIL_REMOTE_TABLES } from "../tableMap";
import type { Evento, EventoMovimentacao, Operation } from "../types";

const farmA = "10000000-0000-4000-8000-000000000001";
const farmB = "10000000-0000-4000-8000-000000000002";
const occurredAt = "2026-08-25T10:00:00.000Z";

function baseMovementEvent(
  id: string,
  fazendaId: string,
  overrides: Record<string, unknown> = {},
): Evento {
  return {
    id,
    fazenda_id: fazendaId,
    dominio: "movimentacao",
    tipo: "movimentacao_lote",
    occurred_at: occurredAt,
    animal_id: null,
    lote_id: "lote-origem-1",
    payload: { motivo: "manejo_rotacional" },
    created_at: occurredAt,
    client_id: "test-client",
    client_op_id: id,
    client_tx_id: id,
    client_recorded_at: occurredAt,
    deleted_at: null,
    ...overrides,
  } as Evento;
}

function movementDetail(
  eventoId: string,
  fazendaId: string,
  overrides: Record<string, unknown> = {},
): EventoMovimentacao {
  return {
    evento_id: eventoId,
    fazenda_id: fazendaId,
    from_lote_id: "lote-origem-1",
    to_lote_id: "lote-destino-2",
    from_pasto_id: "pasto-origem-1",
    to_pasto_id: "pasto-destino-2",
    payload: { motivo: "rotacao_piquete" },
    client_id: "test-client",
    client_op_id: eventoId,
    client_tx_id: eventoId,
    client_recorded_at: occurredAt,
    created_at: occurredAt,
    updated_at: occurredAt,
    deleted_at: null,
    ...overrides,
  } as EventoMovimentacao;
}

function pendingOperation(
  table: string,
  record: Record<string, unknown>,
): Operation {
  const clientOpId = crypto.randomUUID();
  const clientTxId = crypto.randomUUID();
  return {
    client_op_id: clientOpId,
    client_tx_id: clientTxId,
    table,
    action: "INSERT",
    record: {
      ...record,
      client_id: "client-local",
      client_op_id: clientOpId,
      client_tx_id: clientTxId,
      client_recorded_at: occurredAt,
    },
    sync_state: "PENDING",
    created_at: occurredAt,
  };
}

async function clearStores() {
  await db.transaction(
    "rw",
    [
      db.queue_ops,
      db.event_eventos,
      db.event_eventos_movimentacao,
      db.state_animais,
      db.state_lotes,
      db.state_pastos,
    ],
    async () => {
      await db.queue_ops.clear();
      await db.event_eventos.clear();
      await db.event_eventos_movimentacao.clear();
      await db.state_animais.clear();
      await db.state_lotes.clear();
      await db.state_pastos.clear();
    },
  );
}

describe("B4 — Convergencia de eventos_movimentacao", () => {
  beforeEach(async () => {
    mocks.rows.clear();
    await clearStores();
  });

  afterEach(clearStores);

  it("contrato canonico: eventos_movimentacao integra STANDARD_EVENT_DETAIL_REMOTE_TABLES e DEFAULT_REMOTE_TABLES", () => {
    expect(STANDARD_EVENT_DETAIL_REMOTE_TABLES).toContain("eventos_movimentacao");
    expect(DEFAULT_REMOTE_TABLES).toContain("eventos_movimentacao");
  });

  it("Cenario 1 — bootstrap limpo: recupera evento pai e detalhe factual de movimentacao", async () => {
    const eventId = "mov-event-bootstrap-1";
    mocks.rows.set("eventos", [baseMovementEvent(eventId, farmA)]);
    mocks.rows.set("eventos_movimentacao", [movementDetail(eventId, farmA)]);

    // Dexie vazio antes do pull
    expect(await db.event_eventos.count()).toBe(0);
    expect(await db.event_eventos_movimentacao.count()).toBe(0);

    // Executa pull padrao
    await pullDataForFarm(farmA);

    // Ambos presentes
    const pulledEvent = await db.event_eventos.get(eventId);
    const pulledDetail = await db.event_eventos_movimentacao.get(eventId);

    expect(pulledEvent).toBeDefined();
    expect(pulledEvent?.id).toBe(eventId);
    expect(pulledDetail).toBeDefined();
    expect(pulledDetail?.evento_id).toBe(eventId);
    expect(pulledDetail?.from_lote_id).toBe("lote-origem-1");
    expect(pulledDetail?.to_lote_id).toBe("lote-destino-2");
  });

  it("Cenario 2 — idempotencia: multiplos pulls consecutivos nao duplicam detalhes factuais", async () => {
    const eventId = "mov-event-idempotent";
    mocks.rows.set("eventos", [baseMovementEvent(eventId, farmA)]);
    mocks.rows.set("eventos_movimentacao", [movementDetail(eventId, farmA)]);

    // Primeiro pull
    await pullDataForFarm(farmA);
    expect(await db.event_eventos_movimentacao.count()).toBe(1);

    // Segundo pull imediato
    await pullDataForFarm(farmA);
    expect(await db.event_eventos_movimentacao.count()).toBe(1);

    // Terceiro pull em modo merge
    await pullDataForFarm(farmA, DEFAULT_REMOTE_TABLES, { mode: "merge" });
    expect(await db.event_eventos_movimentacao.count()).toBe(1);

    const stored = await db.event_eventos_movimentacao.get(eventId);
    expect(stored?.evento_id).toBe(eventId);
  });

  it("Cenario 3 — pendencia local: pull nao sobrescreve movimentacao PENDING local", async () => {
    const eventId = "mov-event-pending";
    const localRecord = movementDetail(eventId, farmA, {
      from_pasto_id: "pasto-local-pendente",
      to_pasto_id: "pasto-destino-local",
    });

    const op = pendingOperation("eventos_movimentacao", localRecord);
    await db.queue_ops.add(op);
    await db.event_eventos_movimentacao.put(op.record as unknown as EventoMovimentacao);

    // Remote possui versao diferente/antiga
    mocks.rows.set("eventos_movimentacao", [
      movementDetail(eventId, farmA, {
        from_pasto_id: "pasto-remoto-antigo",
        to_pasto_id: "pasto-remoto-antigo-dest",
      }),
    ]);

    // Pull em modo replace
    await pullDataForFarm(farmA, ["eventos_movimentacao"], { mode: "replace" });

    // O registro local pendente foi protegido e NAO sobrescrito
    const preserved = await db.event_eventos_movimentacao.get(eventId);
    expect(preserved?.from_pasto_id).toBe("pasto-local-pendente");
    expect(preserved?.to_pasto_id).toBe("pasto-destino-local");

    // E a operacao continua na fila
    expect(await db.queue_ops.get(op.client_op_id)).toBeDefined();
  });

  it("Cenario 4 — multi-device: dispositivo B recupera movimentacao realizada pelo dispositivo A", async () => {
    // Dispositivo A registrou e enviou ao servidor:
    const eventId = "mov-device-a-to-server";
    const serverEvents = [
      baseMovementEvent(eventId, farmA, {
        lote_id: "lote-X",
      }),
    ];
    const serverDetails = [
      movementDetail(eventId, farmA, {
        from_lote_id: "lote-X",
        to_lote_id: "lote-Y",
        from_pasto_id: "pasto-1",
        to_pasto_id: "pasto-2",
      }),
    ];
    const serverLotes = [
      {
        id: "lote-X",
        fazenda_id: farmA,
        nome: "Lote X",
        pasto_id: "pasto-2",
        deleted_at: null,
      },
    ];

    mocks.rows.set("eventos", serverEvents);
    mocks.rows.set("eventos_movimentacao", serverDetails);
    mocks.rows.set("lotes", serverLotes);

    // Dispositivo B faz pull:
    await pullDataForFarm(farmA, ["eventos", "eventos_movimentacao", "lotes"]);

    // Dispositivo B possui o historico factual exato X -> Y:
    const histDetail = await db.event_eventos_movimentacao.get(eventId);
    expect(histDetail).toBeDefined();
    expect(histDetail?.from_lote_id).toBe("lote-X");
    expect(histDetail?.to_lote_id).toBe("lote-Y");

    // E o estado atual do lote reflete o pasto-2:
    const currentLote = await db.state_lotes.get("lote-X");
    expect(currentLote?.pasto_id).toBe("pasto-2");
  });

  it("Cenario 5 — reinstalacao: bootstrap em dispositivo limpo reconstroi historico completo", async () => {
    const events = [
      baseMovementEvent("mov-1", farmA, { occurred_at: "2026-08-01T08:00:00.000Z" }),
      baseMovementEvent("mov-2", farmA, { occurred_at: "2026-08-15T08:00:00.000Z" }),
    ];
    const details = [
      movementDetail("mov-1", farmA, {
        from_pasto_id: "pasto-A",
        to_pasto_id: "pasto-B",
        occurred_at: "2026-08-01T08:00:00.000Z",
      }),
      movementDetail("mov-2", farmA, {
        from_pasto_id: "pasto-B",
        to_pasto_id: "pasto-C",
        occurred_at: "2026-08-15T08:00:00.000Z",
      }),
    ];

    mocks.rows.set("eventos", events);
    mocks.rows.set("eventos_movimentacao", details);

    // Dispositivo recem-instalado (Dexie zerado)
    await pullDataForFarm(farmA);

    // Historico factual completo recuperado em ordem
    const allEvents = await db.event_eventos.toArray();
    const allDetails = await db.event_eventos_movimentacao.toArray();

    expect(allEvents.length).toBe(2);
    expect(allDetails.length).toBe(2);

    const mov1 = allDetails.find((d) => d.evento_id === "mov-1");
    const mov2 = allDetails.find((d) => d.evento_id === "mov-2");

    expect(mov1?.from_pasto_id).toBe("pasto-A");
    expect(mov1?.to_pasto_id).toBe("pasto-B");
    expect(mov2?.from_pasto_id).toBe("pasto-B");
    expect(mov2?.to_pasto_id).toBe("pasto-C");
  });

  it("Cenario 6 — isolamento tenant: detalhes de fazenda A nunca vazam para fazenda B", async () => {
    mocks.rows.set("eventos_movimentacao", [
      movementDetail("mov-farm-a", farmA),
      movementDetail("mov-farm-b", farmB),
    ]);

    // Pull para fazenda A
    await pullDataForFarm(farmA, ["eventos_movimentacao"]);

    const storedForFarmA = await db.event_eventos_movimentacao.toArray();
    expect(storedForFarmA.length).toBe(1);
    expect(storedForFarmA[0].fazenda_id).toBe(farmA);
    expect(storedForFarmA[0].evento_id).toBe("mov-farm-a");

    // Limpar e puxar para fazenda B
    await db.event_eventos_movimentacao.clear();
    await pullDataForFarm(farmB, ["eventos_movimentacao"]);

    const storedForFarmB = await db.event_eventos_movimentacao.toArray();
    expect(storedForFarmB.length).toBe(1);
    expect(storedForFarmB[0].fazenda_id).toBe(farmB);
    expect(storedForFarmB[0].evento_id).toBe("mov-farm-b");
  });

  it("Cenario 7 — ordem e integridade: contrato de dependencia pai-detail preservado", async () => {
    const eventId = "mov-order-check";
    mocks.rows.set("eventos", [baseMovementEvent(eventId, farmA)]);
    mocks.rows.set("eventos_movimentacao", [movementDetail(eventId, farmA)]);

    // Executa pull
    await pullDataForFarm(farmA, ["eventos", "eventos_movimentacao"]);

    const parentEvent = await db.event_eventos.get(eventId);
    const childDetail = await db.event_eventos_movimentacao.get(eventId);

    // O detalhe referencia diretamente o evento pai atraves de evento_id
    expect(childDetail?.evento_id).toBe(parentEvent?.id);
    expect(childDetail?.fazenda_id).toBe(parentEvent?.fazenda_id);
  });
});
