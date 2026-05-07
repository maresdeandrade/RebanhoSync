import { describe, expect, it } from "vitest";

import { normalizeAgendaPageData } from "@/pages/Agenda/useAgendaPageData";
import type {
  AgendaItem,
  Animal,
  CatalogoProtocoloOficial,
  CatalogoProtocoloOficialItem,
  FazendaSanidadeConfig,
  Gesture,
  Lote,
  ProtocoloSanitario,
  ProtocoloSanitarioItem,
} from "@/lib/offline/types";

function recordWithDeletedAt<T extends { deleted_at?: string | null }>(
  id: string,
  deletedAt: string | null = null,
): T {
  return { id, deleted_at: deletedAt } as unknown as T;
}

describe("normalizeAgendaPageData", () => {
  it("removes soft-deleted records from the same collections filtered by the shell", () => {
    const activeAgenda = recordWithDeletedAt<AgendaItem>("agenda-active");
    const deletedAgenda = recordWithDeletedAt<AgendaItem>(
      "agenda-deleted",
      "2026-05-01T00:00:00.000Z",
    );
    const activeAnimal = recordWithDeletedAt<Animal>("animal-active");
    const deletedAnimal = recordWithDeletedAt<Animal>(
      "animal-deleted",
      "2026-05-01T00:00:00.000Z",
    );
    const activeLote = recordWithDeletedAt<Lote>("lote-active");
    const deletedLote = recordWithDeletedAt<Lote>(
      "lote-deleted",
      "2026-05-01T00:00:00.000Z",
    );
    const activeProtocol =
      recordWithDeletedAt<ProtocoloSanitario>("protocol-active");
    const deletedProtocol = recordWithDeletedAt<ProtocoloSanitario>(
      "protocol-deleted",
      "2026-05-01T00:00:00.000Z",
    );
    const activeProtocolItem =
      recordWithDeletedAt<ProtocoloSanitarioItem>("protocol-item-active");
    const deletedProtocolItem = recordWithDeletedAt<ProtocoloSanitarioItem>(
      "protocol-item-deleted",
      "2026-05-01T00:00:00.000Z",
    );
    const activeConfig =
      recordWithDeletedAt<FazendaSanidadeConfig>("config-active");

    const result = normalizeAgendaPageData({
      itens: [activeAgenda, deletedAgenda],
      animais: [activeAnimal, deletedAnimal],
      lotes: [activeLote, deletedLote],
      protocolos: [activeProtocol, deletedProtocol],
      protocoloItens: [activeProtocolItem, deletedProtocolItem],
      sanidadeConfig: activeConfig,
    });

    expect(result.itens).toEqual([activeAgenda]);
    expect(result.animais).toEqual([activeAnimal]);
    expect(result.lotes).toEqual([activeLote]);
    expect(result.protocolos).toEqual([activeProtocol]);
    expect(result.protocoloItens).toEqual([activeProtocolItem]);
    expect(result.sanidadeConfig).toBe(activeConfig);
  });

  it("removes a soft-deleted sanity config", () => {
    const deletedConfig = recordWithDeletedAt<FazendaSanidadeConfig>(
      "config-deleted",
      "2026-05-01T00:00:00.000Z",
    );

    expect(
      normalizeAgendaPageData({ sanidadeConfig: deletedConfig }).sanidadeConfig,
    ).toBeNull();
  });

  it("preserves gestures and official catalogs as loaded", () => {
    const gesture = { client_tx_id: "tx-1" } as unknown as Gesture;
    const template = {
      id: "template-1",
      deleted_at: "2026-05-01T00:00:00.000Z",
    } as unknown as CatalogoProtocoloOficial;
    const templateItem = {
      id: "template-item-1",
      deleted_at: "2026-05-01T00:00:00.000Z",
    } as unknown as CatalogoProtocoloOficialItem;

    const result = normalizeAgendaPageData({
      gestos: [gesture],
      officialTemplates: [template],
      officialTemplateItems: [templateItem],
    });

    expect(result.gestos).toEqual([gesture]);
    expect(result.officialTemplates).toEqual([template]);
    expect(result.officialTemplateItems).toEqual([templateItem]);
  });

  it("returns empty arrays and null config when sources are absent", () => {
    expect(normalizeAgendaPageData(undefined)).toEqual({
      itens: [],
      animais: [],
      lotes: [],
      protocolos: [],
      protocoloItens: [],
      gestos: [],
      sanidadeConfig: null,
      officialTemplates: [],
      officialTemplateItems: [],
    });
  });

  it("keeps the shape expected by the agenda shell", () => {
    expect(Object.keys(normalizeAgendaPageData(null))).toEqual([
      "itens",
      "animais",
      "lotes",
      "protocolos",
      "protocoloItens",
      "gestos",
      "sanidadeConfig",
      "officialTemplates",
      "officialTemplateItems",
    ]);
  });
});
