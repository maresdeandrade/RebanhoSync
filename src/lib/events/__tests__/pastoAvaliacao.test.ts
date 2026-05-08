import { buildEventGesture } from "@/lib/events/buildEventGesture";
import { EventValidationError } from "@/lib/events/validators";
import { TABLE_MAP } from "@/lib/offline/tableMap";

const baseInput = (overrides: object = {}) => ({
  dominio: "pastagem" as const,
  fazendaId: "farm-1",
  pastoId: "pasto-1",
  loteId: "lote-1",
  ocupacaoId: "ocupacao-1",
  momento: "ronda" as const,
  alturaCm: 28,
  coberturaSolo: "excelente" as const,
  invasorasNivel: "leve" as const,
  eccLoteMedio: 3.5,
  fezesScore: "aneladas" as const,
  aguaStatus: "limpo" as const,
  suplementoTipo: "mineral",
  suplementoQuantidade: 2,
  suplementoUnidade: "kg" as const,
  observacoes: "Pasto em bom estado.",
  payload: { origem: "teste" },
  ...overrides,
});

describe("eventos de avaliacao/ronda de pasto", () => {
  it("cria evento base e detalhe de avaliacao de pasto", () => {
    const result = buildEventGesture(baseInput());

    expect(result.ops).toHaveLength(2);
    expect(result.ops.map((op) => op.table)).toEqual([
      "eventos",
      "eventos_pasto_avaliacao",
    ]);
    expect(result.ops[0].record).toMatchObject({
      dominio: "pastagem",
      animal_id: null,
      lote_id: "lote-1",
      observacoes: "Pasto em bom estado.",
      payload: { origem: "teste" },
    });
    expect(result.ops[1].record).toMatchObject({
      evento_id: result.eventId,
      fazenda_id: "farm-1",
      pasto_id: "pasto-1",
      lote_id: "lote-1",
      ocupacao_id: "ocupacao-1",
      momento: "ronda",
      altura_cm: 28,
      cobertura_solo: "excelente",
      invasoras_nivel: "leve",
      ecc_lote_medio: 3.5,
      ecc_escala: "1_5",
      fezes_score: "aneladas",
      agua_status: "limpo",
      suplemento_tipo: "mineral",
      suplemento_quantidade: 2,
      suplemento_unidade: "kg",
      observacoes: "Pasto em bom estado.",
      payload: { origem: "teste" },
    });
  });

  it("permite avaliacao sem ocupacao aberta", () => {
    const result = buildEventGesture(baseInput({ loteId: null, ocupacaoId: null }));

    expect(result.ops[0].record.lote_id).toBeNull();
    expect(result.ops[1].record.lote_id).toBeNull();
    expect(result.ops[1].record.ocupacao_id).toBeNull();
  });

  it("bloqueia pastoId obrigatorio", () => {
    expect(() => buildEventGesture(baseInput({ pastoId: "" }))).toThrow(
      EventValidationError,
    );
  });

  it("bloqueia momento obrigatorio", () => {
    expect(() =>
      buildEventGesture(baseInput({ momento: "" as "ronda" })),
    ).toThrow(EventValidationError);
  });

  it("bloqueia alturaCm menor ou igual a zero", () => {
    expect(() => buildEventGesture(baseInput({ alturaCm: 0 }))).toThrow(
      EventValidationError,
    );
  });

  it("bloqueia eccLoteMedio fora de 1 a 5", () => {
    expect(() => buildEventGesture(baseInput({ eccLoteMedio: 0.9 }))).toThrow(
      EventValidationError,
    );
    expect(() => buildEventGesture(baseInput({ eccLoteMedio: 5.1 }))).toThrow(
      EventValidationError,
    );
  });

  it("bloqueia categorias invalidas", () => {
    expect(() =>
      buildEventGesture(baseInput({ coberturaSolo: "alta" as "excelente" })),
    ).toThrow(EventValidationError);
    expect(() =>
      buildEventGesture(baseInput({ invasorasNivel: "muito_alta" as "alta" })),
    ).toThrow(EventValidationError);
    expect(() =>
      buildEventGesture(baseInput({ fezesScore: "pastosa" as "aneladas" })),
    ).toThrow(EventValidationError);
    expect(() =>
      buildEventGesture(baseInput({ aguaStatus: "barrenta" as "limpo" })),
    ).toThrow(EventValidationError);
    expect(() =>
      buildEventGesture(baseInput({ suplementoUnidade: "g" as "kg" })),
    ).toThrow(EventValidationError);
  });

  it("bloqueia suplementoQuantidade negativa", () => {
    expect(() =>
      buildEventGesture(baseInput({ suplementoQuantidade: -1 })),
    ).toThrow(EventValidationError);
  });

  it("nao cria UPDATE em pastos, lotes ou pasto_ocupacoes", () => {
    const result = buildEventGesture(baseInput());

    expect(
      result.ops.filter(
        (op) =>
          op.action === "UPDATE" &&
          ["pastos", "lotes", "pasto_ocupacoes"].includes(op.table),
      ),
    ).toHaveLength(0);
  });

  it("TABLE_MAP contem eventos_pasto_avaliacao", () => {
    expect(TABLE_MAP.eventos_pasto_avaliacao).toBe(
      "event_eventos_pasto_avaliacao",
    );
  });
});
