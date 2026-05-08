/**
 * Tests for MudarPastoLote gesture — Two Rails enforcement.
 *
 * Critérios cobertos:
 *  1. buildEventGesture gera evento de movimentacao ao mudar pasto do lote.
 *  2. Evento preenche from_pasto_id e to_pasto_id corretamente.
 *  3. Evento preenche from_lote_id e to_lote_id com lote.id.
 *  4. Estado atual lotes.pasto_id é atualizado via op UPDATE lotes (opt-in).
 *  5. Movimento para o mesmo pasto é bloqueado pelo validador.
 *  6. Movimento null→null (lote sem pasto, destino "Nenhum") é bloqueado.
 *  7. Remover do pasto (from=X, to=null) emite UPDATE lotes.pasto_id=null.
 *  8. applyLoteStateUpdate=true é opt-in — sem ele, UPDATE lotes não é emitido.
 *  9. movementKind="lote_pasto" permite fromLoteId === toLoteId.
 * 10. Sem movementKind, fromLoteId === toLoteId lança ValidationError.
 * 11. UPDATE lotes não ocorre sem movementKind="lote_pasto", mesmo com applyLoteStateUpdate=true.
 */
import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { EventValidationError } from "@/lib/events/validators";

const FAZENDA_ID = "fazenda-1";
const LOTE_ID = "lote-1";
const PASTO_ORIGEM = "pasto-a";
const PASTO_DESTINO = "pasto-b";

/** Helper: input padrão de movimentação lote→pasto com pasto de origem */
const baseLotePastoInput = (overrides: object = {}) => ({
  dominio: "movimentacao" as const,
  fazendaId: FAZENDA_ID,
  loteId: LOTE_ID,
  fromLoteId: LOTE_ID,
  toLoteId: LOTE_ID,
  movementKind: "lote_pasto" as const,
  fromPastoId: PASTO_ORIGEM,
  toPastoId: PASTO_DESTINO,
  allowDestinationNull: true,
  applyAnimalStateUpdate: false,
  ...overrides,
});

describe("buildEventGesture — movimentacao lote→pasto (Two Rails)", () => {
  // ── Estrutura do evento ─────────────────────────────────────────────────

  it("gera eventos + eventos_movimentacao + UPDATE lotes quando applyLoteStateUpdate=true", () => {
    const result = buildEventGesture(baseLotePastoInput({ applyLoteStateUpdate: true }));

    expect(result.ops.map((o) => o.table)).toEqual([
      "eventos",
      "eventos_movimentacao",
      "lotes",
    ]);
  });

  it("evento base: dominio=movimentacao, lote_id=LOTE_ID, animal_id=null", () => {
    const result = buildEventGesture(baseLotePastoInput());

    const ev = result.ops[0];
    expect(ev.table).toBe("eventos");
    expect(ev.record.dominio).toBe("movimentacao");
    expect(ev.record.lote_id).toBe(LOTE_ID);
    expect(ev.record.animal_id).toBeNull();
  });

  it("eventos_movimentacao: from_pasto_id e to_pasto_id preenchidos", () => {
    const result = buildEventGesture(baseLotePastoInput());

    const det = result.ops[1];
    expect(det.table).toBe("eventos_movimentacao");
    expect(det.record.from_pasto_id).toBe(PASTO_ORIGEM);
    expect(det.record.to_pasto_id).toBe(PASTO_DESTINO);
  });

  it("eventos_movimentacao: from_lote_id e to_lote_id iguais a LOTE_ID", () => {
    const result = buildEventGesture(baseLotePastoInput());

    const det = result.ops[1];
    expect(det.record.from_lote_id).toBe(LOTE_ID);
    expect(det.record.to_lote_id).toBe(LOTE_ID);
  });

  it("payload tipo_movimentacao lote_pasto no evento base", () => {
    const result = buildEventGesture(
      baseLotePastoInput({ payload: { tipo_movimentacao: "lote_pasto" } }),
    );

    expect(result.ops[0].record.payload).toMatchObject({
      tipo_movimentacao: "lote_pasto",
    });
  });

  // ── UPDATE lotes ─────────────────────────────────────────────────────────

  it("UPDATE lotes.pasto_id=PASTO_DESTINO quando applyLoteStateUpdate=true", () => {
    const result = buildEventGesture(baseLotePastoInput({ applyLoteStateUpdate: true }));

    const loteOp = result.ops.find((o) => o.table === "lotes");
    expect(loteOp).toBeDefined();
    expect(loteOp!.action).toBe("UPDATE");
    expect(loteOp!.record.id).toBe(LOTE_ID);
    expect(loteOp!.record.pasto_id).toBe(PASTO_DESTINO);
  });

  it("UPDATE lotes.pasto_id=null ao remover do pasto (toPastoId=null, applyLoteStateUpdate=true)", () => {
    const result = buildEventGesture(
      baseLotePastoInput({ toPastoId: null, applyLoteStateUpdate: true }),
    );

    const loteOp = result.ops.find((o) => o.table === "lotes");
    expect(loteOp).toBeDefined();
    expect(loteOp!.record.pasto_id).toBeNull();
  });

  it("NÃO emite UPDATE lotes quando applyLoteStateUpdate não é passado (opt-in)", () => {
    // sem applyLoteStateUpdate=true → não deve emitir UPDATE lotes
    const result = buildEventGesture(baseLotePastoInput());

    const loteOps = result.ops.filter((o) => o.table === "lotes");
    expect(loteOps).toHaveLength(0);
  });

  it("NÃO emite UPDATE lotes quando applyLoteStateUpdate=false", () => {
    const result = buildEventGesture(baseLotePastoInput({ applyLoteStateUpdate: false }));

    expect(result.ops.filter((o) => o.table === "lotes")).toHaveLength(0);
  });

  it("NÃO emite UPDATE lotes sem movementKind='lote_pasto', mesmo com applyLoteStateUpdate=true", () => {
    // Caso: movimentação de animal com loteId passado — não deve atualizar lotes
    const result = buildEventGesture({
      dominio: "movimentacao",
      fazendaId: FAZENDA_ID,
      animalId: "animal-1",
      loteId: LOTE_ID,
      fromLoteId: "lote-a",
      toLoteId: "lote-b",
      applyLoteStateUpdate: true, // opt-in presente, mas movementKind ausente
    });

    expect(result.ops.filter((o) => o.table === "lotes")).toHaveLength(0);
  });

  // ── Bloqueios de destino inválido ────────────────────────────────────────

  it("bloqueia movimentacao para o mesmo pasto de origem (fromPastoId === toPastoId)", () => {
    expect(() =>
      buildEventGesture(baseLotePastoInput({ toPastoId: PASTO_ORIGEM })),
    ).toThrow(EventValidationError);
  });

  it("bloqueia null→null (lote sem pasto atual, destino 'Nenhum')", () => {
    // Simula lote sem pasto (fromPastoId=null) escolhendo "Nenhum" (toPastoId=null).
    // O validator de mesmo pasto cobre: fromPastoId=null && toPastoId=null → null===null → INVALID_DESTINATION.
    // MudarPastoLote.tsx também bloqueia via isMesmoPasto antes de chamar buildEventGesture.
    expect(() =>
      buildEventGesture(
        baseLotePastoInput({ fromPastoId: null, toPastoId: null }),
      ),
    ).toThrow(EventValidationError);
  });

  // ── Isolamento: animais não afetados ────────────────────────────────────

  it("NÃO inclui op de animais quando applyAnimalStateUpdate=false", () => {
    const result = buildEventGesture(baseLotePastoInput());

    expect(result.ops.filter((o) => o.table === "animais")).toHaveLength(0);
  });

  // ── Regressão: movimentacao animal normal ───────────────────────────────

  it("bloqueia fromLoteId===toLoteId sem movementKind (movimentacao animal normal)", () => {
    expect(() =>
      buildEventGesture({
        dominio: "movimentacao",
        fazendaId: FAZENDA_ID,
        animalId: "animal-1",
        fromLoteId: LOTE_ID,
        toLoteId: LOTE_ID, // mesmo lote, sem movementKind
        fromPastoId: PASTO_ORIGEM,
        toPastoId: PASTO_DESTINO,
      }),
    ).toThrow(EventValidationError);
  });
});
