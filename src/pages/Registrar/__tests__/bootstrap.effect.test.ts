import { describe, expect, it, vi } from "vitest";
import {
  refreshRegistrarSanitaryProtocolsEffect,
  refreshRegistrarVeterinaryProductsEffect,
} from "@/pages/Registrar/effects/bootstrap";

describe("bootstrap effects", () => {
  it("refresh protocolos sanitarios apenas com fazenda ativa", async () => {
    const pullDataForFarmFn = vi.fn(async () => undefined);

    await refreshRegistrarSanitaryProtocolsEffect({
      activeFarmId: null,
      pullDataForFarmFn,
    });
    await refreshRegistrarSanitaryProtocolsEffect({
      activeFarmId: "farm-1",
      pullDataForFarmFn,
    });

    expect(pullDataForFarmFn).toHaveBeenCalledTimes(1);
    expect(pullDataForFarmFn).toHaveBeenCalledWith("farm-1", [
      "protocolos_sanitarios",
      "protocolos_sanitarios_itens",
    ]);
  });

  it("refresh catalogo veterinario apenas com fazenda ativa", async () => {
    const refreshCatalogFn = vi.fn(async () => undefined);

    await refreshRegistrarVeterinaryProductsEffect({
      activeFarmId: null,
      refreshCatalogFn,
    });
    await refreshRegistrarVeterinaryProductsEffect({
      activeFarmId: "farm-1",
      refreshCatalogFn,
    });

    expect(refreshCatalogFn).toHaveBeenCalledTimes(1);
  });
});
