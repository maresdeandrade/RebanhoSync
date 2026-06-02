/** @vitest-environment jsdom */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi, describe, expect, it, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { db } from "../db";
import { processGesture } from "../syncWorker";
import { getRemoteTableName, getLocalStoreName } from "../tableMap";
import { randomUUID } from "node:crypto";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: "test-token",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
        error: null,
      }),
      refreshSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: "test-token",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
        error: null,
      }),
    },
  },
}));

vi.mock("@/lib/env", () => ({
  env: { supabaseFunctionsUrl: "http://localhost" },
}));

async function createInsumoMovimentacaoGesture(record: Record<string, unknown>) {
  const client_tx_id = randomUUID();
  const client_op_id = randomUUID();
  
  await db.queue_gestures.add({
    client_id: "test-client",
    client_tx_id,
    fazenda_id: "fazenda-123",
    status: "PENDING",
    created_at: new Date().toISOString(),
  });

  await db.queue_ops.add({
    client_tx_id,
    client_op_id,
    table: "state_insumo_movimentacoes",
    action: "INSERT",
    record,
    created_at: new Date().toISOString(),
  });

  return { client_tx_id, client_op_id, fazenda_id: "fazenda-123" };
}

describe("syncWorker insumo_movimentacoes integration", () => {
  let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    await db.open();
  });

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleDebugSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  afterAll(async () => {
    await db.delete();
  });

  it("mapeia tabelas locais e remotas de movimentacoes corretamente", () => {
    expect(getRemoteTableName("state_insumo_movimentacoes")).toBe("insumo_movimentacoes");
    expect(getLocalStoreName("insumo_movimentacoes")).toBe("state_insumo_movimentacoes");
  });

  it("cria o payload correto para INSERT de insumo_movimentacoes com snapshot de custos e vinculo de evento", async () => {
    const record = {
      id: randomUUID(),
      insumo_id: "insumo-123",
      insumo_lote_id: "lote-456",
      tipo: "consumo_sanitario",
      quantidade_base: 10,
      unidade_base: "ml",
      source_evento_id: "evento-789",
      source_evento_dominio: "sanitario",
      custo_unitario_snapshot: 1.25,
      custo_total_snapshot: 12.50,
      payload: { origem: "teste" },
    };

    const gesture = await createInsumoMovimentacaoGesture(record);

    if (typeof global.fetch !== "function") {
      (global as any).fetch = vi.fn();
    }
    
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ status: "APPLIED", op_id: gesture.client_op_id }],
      }),
    } as any);

    // Executa a sincronizacao da transacao
    await processGesture({ client_tx_id: gesture.client_tx_id, fazenda_id: gesture.fazenda_id } as any);

    expect(fetchMock).toHaveBeenCalled();
    
    const requestBody = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    const op = requestBody.ops[0];

    // Valida mapeamento para tabela remota e schema correto
    expect(op.table).toBe("insumo_movimentacoes");
    expect(op.action).toBe("INSERT");
    expect(op.record).toMatchObject({
      insumo_id: "insumo-123",
      insumo_lote_id: "lote-456",
      tipo: "consumo_sanitario",
      quantidade_base: 10,
      unidade_base: "ml",
      source_evento_id: "evento-789",
      source_evento_dominio: "sanitario",
      custo_unitario_snapshot: 1.25,
      custo_total_snapshot: 12.50,
    });

    // A edge function sync-batch exige o client_op_id deterministico no payload
    expect(op.client_op_id).toBe(gesture.client_op_id);

    fetchMock.mockRestore();
  });

  it("garante que o retry de sync nao altera o client_op_id imutavel da movimentacao local", async () => {
    const record = {
      id: randomUUID(),
      insumo_id: "insumo-123",
      insumo_lote_id: "lote-456",
      tipo: "consumo_sanitario",
      quantidade_base: 10,
      unidade_base: "ml",
      source_evento_id: "evento-789",
      source_evento_dominio: "sanitario",
    };

    const gesture = await createInsumoMovimentacaoGesture(record);

    if (typeof global.fetch !== "function") {
      (global as any).fetch = vi.fn();
    }

    // Primeiro envio simula erro temporario
    const fetchMock = vi.spyOn(global, "fetch")
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        text: async () => "Unavailable",
      } as any)
      // Segundo envio (retry) simula sucesso
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [{ status: "APPLIED", op_id: gesture.client_op_id }],
        }),
      } as any);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation((...args) => {
        if (String(args[0]).startsWith("[sync-worker] HTTP Error:")) {
          return;
        }
        console.warn(...args);
      });

    // Primeira tentativa falha temporariamente
    await processGesture({ client_tx_id: gesture.client_tx_id, fazenda_id: gesture.fazenda_id } as any);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[sync-worker] HTTP Error:",
      503,
      "Service Unavailable",
      "- Unavailable",
    );
    
    const gestureState = await db.queue_gestures.get(gesture.client_tx_id);
    expect(gestureState?.status).toBe("PENDING"); // Re-enfileirado para retry

    // Segunda tentativa (retry) roda e passa
    await processGesture({ client_tx_id: gesture.client_tx_id, fazenda_id: gesture.fazenda_id } as any);

    expect(fetchMock).toHaveBeenCalledTimes(2);

    const call1Body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    const call2Body = JSON.parse((fetchMock.mock.calls[1][1] as any).body);

    // O client_op_id DEVE ser absolutamente identico em ambos os envios para garantir idempotencia
    expect(call1Body.ops[0].client_op_id).toBe(gesture.client_op_id);
    expect(call2Body.ops[0].client_op_id).toBe(gesture.client_op_id);

    fetchMock.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});
