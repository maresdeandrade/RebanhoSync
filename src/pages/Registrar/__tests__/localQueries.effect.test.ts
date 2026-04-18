import { describe, expect, it, vi } from "vitest";
import {
  loadRegistrarAnimaisNoLoteEffect,
  loadRegistrarBullByIdEffect,
  loadRegistrarContrapartesEffect,
  loadRegistrarProtocoloItensEffect,
  loadRegistrarProtocolosEffect,
  loadRegistrarRegulatorySurfaceSourceEffect,
  loadRegistrarSingleActiveBullInLoteEffect,
  loadRegistrarVeterinaryProductsEffect,
} from "@/pages/Registrar/effects/localQueries";

describe("localQueries effects", () => {
  it("carrega bull por id com fallback null", async () => {
    const loadBullById = vi.fn(async () => undefined);
    const bull = await loadRegistrarBullByIdEffect({
      machoId: "animal-1",
      loadBullById,
    });

    expect(loadBullById).toHaveBeenCalledWith("animal-1");
    expect(bull).toBeNull();
  });

  it("carrega source regulatorio apenas com fazenda ativa", async () => {
    const loadSource = vi.fn(async () => ({ config: null }));

    const none = await loadRegistrarRegulatorySurfaceSourceEffect({
      activeFarmId: null,
      loadSource,
    });
    const loaded = await loadRegistrarRegulatorySurfaceSourceEffect({
      activeFarmId: "farm-1",
      loadSource,
    });

    expect(none).toBeNull();
    expect(loadSource).toHaveBeenCalledTimes(1);
    expect(loadSource).toHaveBeenCalledWith("farm-1");
    expect(loaded).toEqual({ config: null });
  });

  it("resolve animais por lote e sem lote", async () => {
    const loadSemLoteAnimais = vi.fn(async () => [{ id: "A" }]);
    const loadAnimaisByLote = vi.fn(async () => [{ id: "B" }]);

    const empty = await loadRegistrarAnimaisNoLoteEffect({
      selectedLoteId: "",
      semLoteOption: "__sem_lote__",
      loadSemLoteAnimais,
      loadAnimaisByLote,
    });
    const semLote = await loadRegistrarAnimaisNoLoteEffect({
      selectedLoteId: "__sem_lote__",
      semLoteOption: "__sem_lote__",
      loadSemLoteAnimais,
      loadAnimaisByLote,
    });
    const byLote = await loadRegistrarAnimaisNoLoteEffect({
      selectedLoteId: "lote-1",
      semLoteOption: "__sem_lote__",
      loadSemLoteAnimais,
      loadAnimaisByLote,
    });

    expect(empty).toEqual([]);
    expect(semLote).toEqual([{ id: "A" }]);
    expect(byLote).toEqual([{ id: "B" }]);
    expect(loadSemLoteAnimais).toHaveBeenCalledTimes(1);
    expect(loadAnimaisByLote).toHaveBeenCalledWith("lote-1");
  });

  it("carrega protocolos, contrapartes, itens e catalogo com loaders injetados", async () => {
    const loadProtocolosByFarm = vi.fn(async () => [{ id: "p1" }]);
    const loadContrapartesByFarm = vi.fn(async () => [{ id: "c1" }]);
    const loadItensByProtocolo = vi.fn(async () => [{ id: "i1" }]);
    const loadProducts = vi.fn(async () => [{ id: "v1" }]);

    const protocolos = await loadRegistrarProtocolosEffect({
      activeFarmId: "farm-1",
      loadProtocolosByFarm,
    });
    const contrapartes = await loadRegistrarContrapartesEffect({
      activeFarmId: "farm-1",
      loadContrapartesByFarm,
    });
    const itens = await loadRegistrarProtocoloItensEffect({
      protocoloId: "p1",
      activeFarmId: "farm-1",
      sanitaryType: "vacinacao",
      loadItensByProtocolo,
    });
    const produtos = await loadRegistrarVeterinaryProductsEffect({ loadProducts });

    expect(protocolos).toEqual([{ id: "p1" }]);
    expect(contrapartes).toEqual([{ id: "c1" }]);
    expect(itens).toEqual([{ id: "i1" }]);
    expect(produtos).toEqual([{ id: "v1" }]);
  });

  it("auto-seleciona bull apenas quando existe exatamente um elegivel", async () => {
    const loadBullsInLote = vi.fn(async () => [{ id: "bull-1", identificacao: "Touro 1" }]);

    const skip = await loadRegistrarSingleActiveBullInLoteEffect({
      tipoManejo: "reproducao",
      selectedLoteId: "lote-1",
      semLoteOption: "__sem_lote__",
      selectedBullId: "manual",
      loadBullsInLote,
    });
    const picked = await loadRegistrarSingleActiveBullInLoteEffect({
      tipoManejo: "reproducao",
      selectedLoteId: "lote-1",
      semLoteOption: "__sem_lote__",
      selectedBullId: null,
      loadBullsInLote,
    });

    expect(skip).toBeNull();
    expect(picked).toEqual({ id: "bull-1", identificacao: "Touro 1" });
  });
});
