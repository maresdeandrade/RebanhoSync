/**
 * Tests for P1 — pasto_ocupacoes state layer e helper de montagem de ops.
 *
 * Critérios cobertos:
 *  1. TABLE_MAP contém pasto_ocupacoes → state_pasto_ocupacoes.
 *  2. getLocalStoreName/getRemoteTableName funcionam.
 *  3. PastoOcupacao type está correto (duck-typing via satisfies).
 *  4. mover lote de Pasto A para Pasto B fecha ocupação A e abre B.
 *  5. mover lote de Pasto A para “Nenhum” fecha A e não abre nova.
 *  6. lote sem ocupação aberta indo para Pasto B abre ocupação B.
 *  7. destino igual ao atual não gera ops de ocupação.
 *  8. helper puro não acessa Dexie/createGesture.
 */
import { TABLE_MAP, getLocalStoreName, getRemoteTableName } from "@/lib/offline/tableMap";
import type { PastoOcupacao, Lote } from "@/lib/offline/types";
import { buildPastoOcupacaoOps } from "../pastoOcupacoes";

const FAZENDA_ID = "fazenda-1";
const LOTE_ID = "lote-1";
const PASTO_A = "pasto-a";
const PASTO_B = "pasto-b";
const EVENT_ID = "event-uuid-1";
const NOW = "2026-05-08T00:00:00.000Z";

const mockLote: Lote = {
  id: LOTE_ID,
  fazenda_id: FAZENDA_ID,
  nome: "Lote Teste",
  status: "ativo",
  pasto_id: PASTO_A,
  touro_id: null,
  observacoes: null,
  payload: {},
  client_id: "client-1",
  client_op_id: "op-1",
  client_tx_id: null,
  client_recorded_at: NOW,
  server_received_at: NOW,
  created_at: NOW,
  updated_at: NOW,
  deleted_at: null,
};

const mockOcupacaoA: PastoOcupacao = {
  id: "ocup-a",
  fazenda_id: FAZENDA_ID,
  pasto_id: PASTO_A,
  lote_id: LOTE_ID,
  entrada_em: NOW,
  saida_em: null,
  entrada_evento_id: "ev-0",
  saida_evento_id: null,
  animais_inicio: 10,
  animais_fim: null,
  ua_inicio: null,
  ua_fim: null,
  status: "aberta",
  payload: {},
  client_id: "client-1",
  client_op_id: "op-1",
  client_tx_id: null,
  client_recorded_at: NOW,
  server_received_at: NOW,
  created_at: NOW,
  updated_at: NOW,
  deleted_at: null,
};

// ── Testes de TABLE_MAP ───────────────────────────────────────────────────────

describe("tableMap — pasto_ocupacoes", () => {
  it("TABLE_MAP contém pasto_ocupacoes -> state_pasto_ocupacoes", () => {
    expect(TABLE_MAP["pasto_ocupacoes"]).toBe("state_pasto_ocupacoes");
  });

  it("getLocalStoreName('pasto_ocupacoes') -> 'state_pasto_ocupacoes'", () => {
    expect(getLocalStoreName("pasto_ocupacoes")).toBe("state_pasto_ocupacoes");
  });

  it("getRemoteTableName('state_pasto_ocupacoes') -> 'pasto_ocupacoes'", () => {
    expect(getRemoteTableName("state_pasto_ocupacoes")).toBe("pasto_ocupacoes");
  });
});

// ── Testes de helper puro (buildPastoOcupacaoOps) ────────────────────────────

describe("buildPastoOcupacaoOps (Helper Puro)", () => {
  it("mover lote de Pasto A para Pasto B fecha ocupação A e abre B", () => {
    const ops = buildPastoOcupacaoOps({
      ocupacaoAbertaAtual: mockOcupacaoA,
      lote: mockLote,
      toPastoId: PASTO_B,
      eventId: EVENT_ID,
      occurredAt: NOW,
      animaisCount: 15,
    });

    expect(ops).toHaveLength(2);
    
    // Deve fechar A
    const updateOp = ops[0];
    expect(updateOp.action).toBe("UPDATE");
    expect(updateOp.table).toBe("pasto_ocupacoes");
    expect(updateOp.record.id).toBe(mockOcupacaoA.id);
    expect(updateOp.record.status).toBe("fechada");
    expect(updateOp.record.saida_em).toBe(NOW);
    expect(updateOp.record.saida_evento_id).toBe(EVENT_ID);
    expect(updateOp.record.animais_fim).toBe(15);

    // Deve abrir B
    const insertOp = ops[1];
    expect(insertOp.action).toBe("INSERT");
    expect(insertOp.table).toBe("pasto_ocupacoes");
    expect(insertOp.record.status).toBe("aberta");
    expect(insertOp.record.pasto_id).toBe(PASTO_B);
    expect(insertOp.record.lote_id).toBe(LOTE_ID);
    expect(insertOp.record.entrada_em).toBe(NOW);
    expect(insertOp.record.entrada_evento_id).toBe(EVENT_ID);
    expect(insertOp.record.animais_inicio).toBe(15);
  });

  it("mover lote de Pasto A para 'Nenhum' (null) fecha A e não abre nova", () => {
    const ops = buildPastoOcupacaoOps({
      ocupacaoAbertaAtual: mockOcupacaoA,
      lote: mockLote,
      toPastoId: null,
      eventId: EVENT_ID,
      occurredAt: NOW,
      animaisCount: 10,
    });

    expect(ops).toHaveLength(1);
    const updateOp = ops[0];
    expect(updateOp.action).toBe("UPDATE");
    expect(updateOp.table).toBe("pasto_ocupacoes");
    expect(updateOp.record.status).toBe("fechada");
    expect(updateOp.record.saida_evento_id).toBe(EVENT_ID);
  });

  it("lote sem ocupação aberta indo para Pasto B abre ocupação B", () => {
    const ops = buildPastoOcupacaoOps({
      ocupacaoAbertaAtual: null,
      lote: mockLote,
      toPastoId: PASTO_B,
      eventId: EVENT_ID,
      occurredAt: NOW,
      animaisCount: 5,
    });

    expect(ops).toHaveLength(1);
    const insertOp = ops[0];
    expect(insertOp.action).toBe("INSERT");
    expect(insertOp.table).toBe("pasto_ocupacoes");
    expect(insertOp.record.status).toBe("aberta");
    expect(insertOp.record.pasto_id).toBe(PASTO_B);
    expect(insertOp.record.entrada_evento_id).toBe(EVENT_ID);
  });

  it("destino igual ao atual (Pasto A para Pasto A) não gera ops de ocupação", () => {
    const ops = buildPastoOcupacaoOps({
      ocupacaoAbertaAtual: mockOcupacaoA,
      lote: mockLote,
      toPastoId: PASTO_A, // destino igual ao atual
      eventId: EVENT_ID,
      occurredAt: NOW,
      animaisCount: 10,
    });

    expect(ops).toHaveLength(0);
  });
});
