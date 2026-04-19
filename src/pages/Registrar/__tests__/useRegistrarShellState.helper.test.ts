/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useRegistrarShellState } from "@/pages/Registrar/useRegistrarShellState";

describe("useRegistrarShellState", () => {
  it("centraliza selecao local e limpa animais ao trocar lote", () => {
    const { result } = renderHook(() =>
      useRegistrarShellState({ semLoteOption: "__sem_lote__" }),
    );

    act(() => {
      result.current.setSelectedAnimais(["a1", "a2"]);
      result.current.onSelectedLoteIdChange("lote-1");
    });

    expect(result.current.selectedLoteId).toBe("lote-1");
    expect(result.current.selectedAnimais).toEqual([]);
  });

  it("deduplica selecao visivel e limpa destino de movimentacao quando conflita com origem", async () => {
    const { result } = renderHook(() =>
      useRegistrarShellState({ semLoteOption: "__sem_lote__" }),
    );

    act(() => {
      result.current.setMovimentacaoData({ toLoteId: "lote-1" });
      result.current.onSelectedLoteIdChange("lote-1");
      result.current.onSelectVisibleAnimais(["a1", "a1", "a2"]);
    });

    expect(result.current.selectedAnimais).toEqual(["a1", "a2"]);

    await waitFor(() => {
      expect(result.current.movimentacaoData.toLoteId).toBe("");
    });
  });

  it("calcula derives locais de nutricao e reproducao", () => {
    const { result } = renderHook(() =>
      useRegistrarShellState({ semLoteOption: "__sem_lote__" }),
    );

    act(() => {
      result.current.setTipoManejo("reproducao");
      result.current.setSelectedAnimais(["a1", "a2"]);
      result.current.setReproducaoData((prev) => ({ ...prev, tipo: "parto" }));
      result.current.setNutricaoData({ alimentoNome: "", quantidadeKg: "0" });
    });

    expect(result.current.partoRequiresSingleMatrix).toBe(true);
    expect(result.current.nutricaoAlimentoMissing).toBe(true);
    expect(result.current.nutricaoQuantidadeInvalida).toBe(true);
  });
});
