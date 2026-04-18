import { describe, expect, it } from "vitest";

import {
  isMovimentacaoDestinoIgualOrigem,
  shouldClearMovimentacaoDestino,
} from "@/pages/Registrar/helpers/movimentacao";

describe("movimentacao helper", () => {
  it("detecta destino igual a origem", () => {
    expect(
      isMovimentacaoDestinoIgualOrigem({
        origemLoteId: "lote-a",
        destinoLoteId: "lote-a",
      }),
    ).toBe(true);

    expect(
      isMovimentacaoDestinoIgualOrigem({
        origemLoteId: "lote-a",
        destinoLoteId: "lote-b",
      }),
    ).toBe(false);
  });

  it("limpa destino apenas quando preenchido e igual a origem", () => {
    expect(
      shouldClearMovimentacaoDestino({
        origemLoteId: "lote-a",
        destinoLoteId: "lote-a",
      }),
    ).toBe(true);

    expect(
      shouldClearMovimentacaoDestino({
        origemLoteId: "lote-a",
        destinoLoteId: "",
      }),
    ).toBe(false);
  });
});
