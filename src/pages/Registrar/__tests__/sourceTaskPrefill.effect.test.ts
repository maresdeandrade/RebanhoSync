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

  it("completa protocolo, tipo e produto pelo item da agenda quando source_ref nao traz esses campos", async () => {
    const loadAgendaItem = vi.fn(async () => ({
      id: "agenda-1",
      dominio: "sanitario",
      protocol_item_version_id: "item-2",
      source_ref: {},
      payload: {},
    }));
    const loadProtocolItem = vi.fn(async () => ({
      id: "item-2",
      protocolo_id: "protocolo-2",
      tipo: "vacinacao",
      produto: "Vacina Raiva Herbivoros",
      payload: {},
    }));

    const result = await loadRegistrarSourceTaskPrefillEffect({
      sourceTaskId: "agenda-1",
      tipoManejo: "sanitario",
      loadAgendaItem,
      loadProtocolItem,
    });

    expect(loadProtocolItem).toHaveBeenCalledWith("item-2");
    expect(result).toMatchObject({
      protocoloIdFromTask: "protocolo-2",
      protocoloItemIdFromTask: "item-2",
      produtoFromTask: "Vacina Raiva Herbivoros",
      tipoFromTask: "vacinacao",
    });
  });

  it("aceita protocol_item_id como chave alternativa do source_ref", async () => {
    const loadAgendaItem = vi.fn(async () => ({
      id: "agenda-1",
      dominio: "sanitario",
      protocol_item_version_id: null,
      source_ref: {
        protocol_item_id: "item-2",
      },
      payload: {},
    }));
    const loadProtocolItem = vi.fn(async () => ({
      id: "item-2",
      protocolo_id: "protocolo-2",
      tipo: "vacinacao",
      produto: "Vacina Raiva Herbivoros",
      payload: {},
    }));

    const result = await loadRegistrarSourceTaskPrefillEffect({
      sourceTaskId: "agenda-1",
      tipoManejo: "sanitario",
      loadAgendaItem,
      loadProtocolItem,
    });

    expect(result).toMatchObject({
      protocoloIdFromTask: "protocolo-2",
      protocoloItemIdFromTask: "item-2",
      produtoFromTask: "Vacina Raiva Herbivoros",
      tipoFromTask: "vacinacao",
    });
  });
});
