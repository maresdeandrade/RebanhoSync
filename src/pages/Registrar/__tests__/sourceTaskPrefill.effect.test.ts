import { describe, expect, it, vi } from "vitest";
import { loadRegistrarSourceTaskPrefillEffect } from "@/pages/Registrar/effects/sourceTaskPrefill";

describe("sourceTaskPrefill effect", () => {
  it("retorna null fora do contexto sanitario", async () => {
    const loadAgendaItem = vi.fn();

    const result = await loadRegistrarSourceTaskPrefillEffect({
      sourceTaskId: "agenda-1",
      tipoManejo: "pesagem",
      loadAgendaItem,
    });

    expect(result).toBeNull();
    expect(loadAgendaItem).not.toHaveBeenCalled();
  });

  it("carrega dados de prefill sanitario", async () => {
    const loadAgendaItem = vi.fn(async () => ({
      id: "agenda-1",
      dominio: "sanitario",
      protocol_item_version_id: "item-2",
      source_ref: {
        protocolo_id: "protocolo-1",
        tipo: "vacinacao",
        produto: "Produto A",
      },
      payload: {
        produto: "Produto B",
      },
    }));

    const result = await loadRegistrarSourceTaskPrefillEffect({
      sourceTaskId: "agenda-1",
      tipoManejo: null,
      loadAgendaItem,
    });

    expect(loadAgendaItem).toHaveBeenCalledWith("agenda-1");
    expect(result).toMatchObject({
      protocoloIdFromTask: "protocolo-1",
      protocoloItemIdFromTask: "item-2",
      produtoFromTask: "Produto A",
      tipoFromTask: "vacinacao",
    });
  });
});
